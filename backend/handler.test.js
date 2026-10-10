// @ts-check
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createHandler } = require("./handler");
const { createMemoryStore } = require("./memory-store");

const ADMIN_KEY = "secret";
const id = (/** @type {number} */ n) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function setup() {
  const handler = createHandler({
    adminKey: ADMIN_KEY,
    store: createMemoryStore(),
  });

  /** @param {object} body @param {boolean} [base64] */
  const post = async (body, base64 = false) => {
    const json = JSON.stringify(body);
    const response = await handler({
      httpMethod: "POST",
      body: base64 ? Buffer.from(json).toString("base64") : json,
      isBase64Encoded: base64,
    });
    return { status: response.statusCode, data: JSON.parse(response.body) };
  };
  const guest = (/** @type {number} */ n, /** @type {object} */ patch = {}) => ({
    id: id(n),
    name: `Гость ${n}`,
    know: 2,
    reason: "Торт",
    skills: ["Тамада"],
    seat: null,
    ...patch,
  });
  const rsvp = (/** @type {object} */ g) => post({ action: "rsvp", guest: g });

  return { handler, post, guest, rsvp };
}

test("анкета без места записывается, место добавляется вторым запросом", async () => {
  const { rsvp, guest, handler } = setup();

  assert.deepEqual(await rsvp(guest(1)), { status: 200, data: { ok: true, taken: [] } });
  assert.deepEqual(await rsvp(guest(1, { seat: 7 })), {
    status: 200,
    data: { ok: true, taken: [7] },
  });

  const seats = await handler({ httpMethod: "GET" });
  assert.deepEqual(JSON.parse(seats.body), { taken: [7] });
  assert.equal(seats.headers["Access-Control-Allow-Origin"], "*");
});

test("занятое место нельзя занять второй раз, но своё можно сменить", async () => {
  const { rsvp, guest } = setup();
  await rsvp(guest(1, { seat: 7 }));

  assert.deepEqual(await rsvp(guest(2, { seat: 7 })), {
    status: 409,
    data: { error: "seat_taken", taken: [7], seat: null },
  });
  // Отказ не должен оставлять гостя в таблице с чужим местом.
  assert.deepEqual(await rsvp(guest(2, { seat: 3 })), {
    status: 200,
    data: { ok: true, taken: [3, 7] },
  });

  assert.deepEqual(await rsvp(guest(1, { seat: 9 })), {
    status: 200,
    data: { ok: true, taken: [3, 9] },
  });

  // При отказе в пересадке за гостем остаётся прежнее место, и сервер его называет.
  assert.deepEqual(await rsvp(guest(2, { seat: 9 })), {
    status: 409,
    data: { error: "seat_taken", taken: [3, 9], seat: 3 },
  });
});

test("опоздавшая анкета без места не стирает уже выбранное место", async () => {
  const { rsvp, guest, post } = setup();
  await rsvp(guest(1, { seat: 5 }));

  assert.deepEqual(await rsvp(guest(1, { name: "Гость 1 (правка)" })), {
    status: 200,
    data: { ok: true, taken: [5] },
  });
  const { guests } = (await post({ action: "list", key: ADMIN_KEY })).data;
  assert.equal(guests[0].name, "Гость 1 (правка)", "остальные поля обновляются");
  assert.equal(guests[0].seat, 5);
});

test("некорректные данные отклоняются с именем поля", async () => {
  const { rsvp, guest, post } = setup();
  const field = async (/** @type {object} */ patch) =>
    (await rsvp(guest(1, patch))).data.field;

  assert.equal(await field({ id: "not-a-uuid" }), "id");
  assert.equal(await field({ name: "   " }), "name");
  assert.equal(await field({ name: "x".repeat(29) }), "name");
  assert.equal(await field({ know: 5 }), "know");
  assert.equal(await field({ skills: ["a", "b", "c", "d"] }), "skills");
  assert.equal(await field({ seat: 1 }), "seat", "место именинника");
  assert.equal(await field({ seat: 11 }), "seat");
  assert.equal(await field({ seat: 2.5 }), "seat");

  assert.equal((await post({ action: "nope" })).status, 400);
  assert.equal((await post({ action: "rsvp", pad: "x".repeat(5000) })).status, 400);
});

test("тело в base64 (так функция получает text/plain) разбирается", async () => {
  const { post, guest } = setup();
  const result = await post({ action: "rsvp", guest: guest(1, { seat: 4 }) }, true);
  assert.deepEqual(result, { status: 200, data: { ok: true, taken: [4] } });
});

test("список и удаление доступны только с ключом", async () => {
  const { rsvp, guest, post } = setup();
  await rsvp(guest(1, { seat: 7 }));

  assert.equal((await post({ action: "list" })).status, 403);
  assert.equal((await post({ action: "list", key: "wrong" })).status, 403);
  assert.equal((await post({ action: "remove", key: "wrong", id: id(1) })).status, 403);

  const list = await post({ action: "list", key: ADMIN_KEY });
  assert.equal(list.status, 200);
  assert.equal(list.data.guests.length, 1);
  assert.equal(list.data.guests[0].seat, 7);
  assert.match(list.data.guests[0].createdAt, /^\d{4}-\d\d-\d\dT/);

  assert.equal((await post({ action: "remove", key: ADMIN_KEY, id: id(1) })).status, 200);
  assert.deepEqual((await rsvp(guest(2, { seat: 7 }))).data, { ok: true, taken: [7] });
});

test("без ADMIN_KEY админские действия закрыты для всех", async () => {
  const handler = createHandler({
    store: /** @type {any} */ ({}),
    adminKey: undefined,
  });
  const response = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ action: "list", key: "" }),
  });
  assert.equal(response.statusCode, 403);
});

test("preflight получает CORS-заголовки без тела", async () => {
  const { handler } = setup();
  const response = await handler({ httpMethod: "OPTIONS" });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
});
