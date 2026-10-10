// @ts-check
// HTTP-слой функции: разбор запроса, маршруты, ответы. База приходит снаружи,
// поэтому в тестах подставляется хранилище в памяти.
const { createHash, timingSafeEqual } = require("node:crypto");

const { parseGuest } = require("./rsvp");

const MAX_BODY_BYTES = 4096;

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

/** @param {{ body?: string, isBase64Encoded?: boolean }} event */
function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return null;
  try {
    const body = JSON.parse(raw);
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

/**
 * @typedef {import("./rsvp").Guest} Guest
 * @typedef {import("./rsvp").GuestInput} GuestInput
 * @typedef {object} Store
 * @property {() => Promise<number[]>} takenSeats
 * @property {(input: GuestInput) => Promise<ReturnType<typeof import("./rsvp").planRsvp>>} saveGuest
 * @property {() => Promise<Guest[]>} listGuests
 * @property {(id: string) => Promise<void>} removeGuest
 */

/**
 * @param {object} deps
 * @param {Store} deps.store
 * @param {string} [deps.adminKey] ключ из секретной ссылки именинника
 */
function createHandler({ store, adminKey }) {
  /** @param {{ httpMethod?: string, body?: string, isBase64Encoded?: boolean }} event */
  return async function handler(event) {
    const method = event.httpMethod ?? "GET";
    if (method === "OPTIONS") return respond(204);
    if (method === "GET") return respond(200, { taken: await store.takenSeats() });
    if (method !== "POST") return respond(405, { error: "method" });

    const body = parseBody(event);
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

module.exports = { createHandler };
