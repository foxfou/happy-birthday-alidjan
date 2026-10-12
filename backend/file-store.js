// @ts-check
// Хранилище гостей одним JSON-файлом. Где лежит файл — решает blob: в бакете
// объектного хранилища (s3-blob.js) или в памяти для тестов и локального запуска.
const { planRsvp } = require("./rsvp");

/**
 * @typedef {object} Blob
 * @property {() => Promise<string | null>} read содержимое файла; null — файла ещё нет
 * @property {(text: string) => Promise<void>} write
 */

/** @param {Blob} blob @returns {import("./handler").Store} */
function createFileStore(blob) {
  /** @returns {Promise<import("./rsvp").Guest[]>} */
  async function load() {
    const text = await blob.read();
    if (!text) return [];
    return JSON.parse(text).map((/** @type {any} */ guest) => ({
      ...guest,
      createdAt: new Date(guest.createdAt),
      updatedAt: new Date(guest.updatedAt),
    }));
  }

  /** @param {import("./rsvp").Guest[]} guests */
  const save = (guests) => blob.write(JSON.stringify(guests, null, 2));

  // Изменения идут строго по одному: «прочитать файл — решить — записать» нельзя
  // перемешивать, иначе двое одновременно займут одно место. Сервис при этом
  // должен работать в одном экземпляре (максимум экземпляров = 1).
  /** @type {Promise<unknown>} */
  let queue = Promise.resolve();
  /** @template T @param {() => Promise<T>} task @returns {Promise<T>} */
  function exclusive(task) {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  }

  return {
    listGuests: load,

    saveGuest: (input) =>
      exclusive(async () => {
        const guests = await load();
        const plan = planRsvp(guests, input, new Date());
        if (plan.status === "ok") {
          await save([...guests.filter((g) => g.id !== input.id), plan.guest]);
        }
        return plan;
      }),

    removeGuest: (id) =>
      exclusive(async () => {
        const guests = await load();
        await save(guests.filter((guest) => guest.id !== id));
      }),
  };
}

/** @returns {Blob} */
function memoryBlob() {
  /** @type {string | null} */
  let text = null;
  return {
    read: async () => text,
    write: async (next) => {
      text = next;
    },
  };
}

module.exports = { createFileStore, memoryBlob };
