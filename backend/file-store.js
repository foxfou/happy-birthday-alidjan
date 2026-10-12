// @ts-check
// Хранилище гостей: анкеты одним JSON-файлом, фото — отдельными файлами рядом.
// Где лежат файлы — решает bucket: в объектном хранилище (s3-bucket.js) или
// в памяти для тестов и локального запуска.
const { planRsvp } = require("./rsvp");

const GUESTS_KEY = "guests.json";
const photoKey = (/** @type {string} */ id) => `photos/${id}.jpg`;

/**
 * @typedef {object} Bucket
 * @property {(key: string) => Promise<Buffer | null>} get null — файла нет
 * @property {(key: string, body: Buffer | string, contentType: string) => Promise<void>} put
 * @property {(key: string) => Promise<void>} remove
 */

/** @param {Bucket} bucket @returns {import("./handler").Store} */
function createFileStore(bucket) {
  /** @returns {Promise<import("./rsvp").Guest[]>} */
  async function load() {
    const file = await bucket.get(GUESTS_KEY);
    if (!file) return [];
    return JSON.parse(file.toString("utf8")).map((/** @type {any} */ guest) => ({
      ...guest,
      photo: guest.photo ?? false,
      createdAt: new Date(guest.createdAt),
      updatedAt: new Date(guest.updatedAt),
    }));
  }

  /** @param {import("./rsvp").Guest[]} guests */
  const save = (guests) =>
    bucket.put(
      GUESTS_KEY,
      JSON.stringify(guests, null, 2),
      "application/json; charset=utf-8",
    );

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
        await bucket.remove(photoKey(id));
      }),

    // Фото принимается только к существующей анкете — иначе хранилище можно
    // было бы забивать файлами под выдуманными идентификаторами.
    savePhoto: (id, jpeg) =>
      exclusive(async () => {
        const guests = await load();
        const guest = guests.find((item) => item.id === id);
        if (!guest) return false;
        await bucket.put(photoKey(id), jpeg, "image/jpeg");
        if (!guest.photo) {
          guest.photo = true;
          await save(guests);
        }
        return true;
      }),

    loadPhoto: (id) => bucket.get(photoKey(id)),
  };
}

/** @returns {Bucket} */
function memoryBucket() {
  /** @type {Map<string, Buffer>} */
  const files = new Map();
  return {
    get: async (key) => files.get(key) ?? null,
    put: async (key, body) => void files.set(key, Buffer.from(body)),
    remove: async (key) => void files.delete(key),
  };
}

module.exports = { createFileStore, memoryBucket };
