// @ts-check
// Логика HTTP-запросов сервиса: разбор, маршруты, ответы. Хранилище приходит
// снаружи, поэтому в тестах подставляется файл в памяти.
const { createHash, timingSafeEqual } = require("node:crypto");

const { parseGuest, takenSeats } = require("./rsvp");

const MAX_JSON_BYTES = 4096;
// Сайт присылает фото уже обрезанным до 600×800 — это около 100 КБ.
const MAX_PHOTO_BYTES = 400 * 1024;
const GUEST_ID = /^[0-9a-f-]{36}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

/** @param {number} statusCode @param {unknown} [data] */
function respond(statusCode, data) {
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
    /** @type {string | Buffer} */
    body: data === undefined ? "" : JSON.stringify(data),
  };
}

/** @param {unknown} key @param {string | undefined} adminKey */
function isAdmin(key, adminKey) {
  if (!adminKey || typeof key !== "string") return false;
  const digest = (/** @type {string} */ value) =>
    createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(key), digest(adminKey));
}

/** @param {Buffer} raw */
function parseJson(raw) {
  if (raw.length > MAX_JSON_BYTES) return null;
  try {
    const body = JSON.parse(raw.toString("utf8"));
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

/** @param {Buffer} bytes */
const isJpeg = (bytes) =>
  bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/**
 * @typedef {import("./rsvp").Guest} Guest
 * @typedef {import("./rsvp").GuestInput} GuestInput
 * @typedef {object} Store
 * @property {(input: GuestInput) => Promise<ReturnType<typeof import("./rsvp").planRsvp>>} saveGuest
 * @property {() => Promise<Guest[]>} listGuests
 * @property {(id: string) => Promise<void>} removeGuest
 * @property {(id: string, jpeg: Buffer) => Promise<boolean>} savePhoto false — такой анкеты нет
 * @property {(id: string) => Promise<Buffer | null>} loadPhoto
 */

/**
 * @param {object} deps
 * @param {Store} deps.store
 * @param {string} [deps.adminKey] ключ из секретной ссылки именинника
 */
function createHandler({ store, adminKey }) {
  /**
   * @param {object} event
   * @param {string} [event.httpMethod]
   * @param {Record<string, string> | null} [event.queryStringParameters]
   * @param {string | Buffer} [event.body]
   */
  return async function handler(event) {
    const method = event.httpMethod ?? "GET";
    const query = event.queryStringParameters ?? {};
    const raw = Buffer.from(event.body ?? "");
    if (method === "OPTIONS") return respond(204);

    // Фото гостя: адрес с идентификатором анкеты, который знают только сам гость
    // и именинник, поэтому отдельной проверки доступа здесь нет.
    if ("photo" in query) {
      if (!GUEST_ID.test(query.photo)) {
        return respond(400, { error: "invalid", field: "photo" });
      }
      if (method === "GET") {
        const jpeg = await store.loadPhoto(query.photo);
        if (!jpeg) return respond(404, { error: "no_photo" });
        return {
          statusCode: 200,
          headers: { ...CORS, "Content-Type": "image/jpeg" },
          body: jpeg,
        };
      }
      if (method !== "POST") return respond(405, { error: "method" });
      if (raw.length > MAX_PHOTO_BYTES) return respond(413, { error: "too_large" });
      if (!isJpeg(raw)) return respond(400, { error: "invalid", field: "body" });
      if (!(await store.savePhoto(query.photo, raw))) {
        return respond(404, { error: "unknown_guest" });
      }
      return respond(200, { ok: true });
    }

    if (method === "GET") {
      const guests = await store.listGuests();
      const taken = takenSeats(guests);
      // С ?id= сайт заодно узнаёт, жива ли анкета гостя: именинник мог её удалить.
      if (!query.id) return respond(200, { taken });
      const guest = guests.find((item) => item.id === query.id);
      return respond(200, { taken, guest: guest ? { seat: guest.seat } : null });
    }
    if (method !== "POST") return respond(405, { error: "method" });

    const body = parseJson(raw);
    if (!body) return respond(400, { error: "invalid", field: "body" });

    switch (body.action) {
      case "rsvp": {
        const parsed = parseGuest(body.guest);
        if ("invalid" in parsed) {
          return respond(400, { error: "invalid", field: parsed.invalid });
        }
        const result = await store.saveGuest(parsed.guest);
        if (result.status === "seat_taken") {
          const { taken, seat } = result;
          return respond(409, { error: "seat_taken", taken, seat });
        }
        if (result.status === "full") return respond(409, { error: "full" });
        return respond(200, { ok: true, taken: result.taken });
      }
      case "list":
        if (!isAdmin(body.key, adminKey)) return respond(403, { error: "forbidden" });
        return respond(200, { guests: await store.listGuests() });
      case "remove":
        if (!isAdmin(body.key, adminKey)) return respond(403, { error: "forbidden" });
        if (typeof body.id !== "string") {
          return respond(400, { error: "invalid", field: "id" });
        }
        await store.removeGuest(body.id);
        return respond(200, { ok: true });
      default:
        return respond(400, { error: "invalid", field: "action" });
    }
  };
}

module.exports = { createHandler, MAX_PHOTO_BYTES };
