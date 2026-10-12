// @ts-check
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createFileStore, memoryBucket } = require("./file-store");
const { createHandler } = require("./handler");

const ADMIN_KEY = "secret";
const id = (/** @type {number} */ n) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function setup(bucket = memoryBucket()) {
  const handler = createHandler({
    adminKey: ADMIN_KEY,
    store: createFileStore(bucket),
  });

  /** @param {object} body */
  const post = async (body) => {
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify(body),
    });
    return { status: response.statusCode, data: JSON.parse(String(response.body)) };
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
  assert.deepEqual(JSON.parse(String(seats.body)), { taken: [7] });
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

test("одновременные запросы на одно место: проходит ровно один", async () => {
  // Медленное хранилище: без очереди оба запроса прочитали бы пустой файл и оба записались.
  const fast = memoryBucket();
  const pause = () => new Promise((resolve) => setTimeout(resolve, 15));
  const { rsvp, guest, post } = setup({
    get: async (key) => (await pause(), fast.get(key)),
    put: async (...args) => (await pause(), fast.put(...args)),
    remove: fast.remove,
  });

  const results = await Promise.all([
    rsvp(guest(1, { seat: 10 })),
    rsvp(guest(2, { seat: 10 })),
    rsvp(guest(3, { seat: 10 })),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);

  const { guests } = (await post({ action: "list", key: ADMIN_KEY })).data;
  assert.equal(guests.length, 1, "проигравшие в файл не попали");
});

test("анкеты переживают перезапуск сервиса: всё состояние в файле", async () => {
  const bucket = memoryBucket();
  await setup(bucket).rsvp({
    id: id(1),
    name: "Гость 1",
    know: 2,
    reason: "Торт",
    skills: [],
    seat: 7,
  });

  // Новый обработчик поверх того же файла — как новый экземпляр контейнера.
  const { rsvp, guest, handler } = setup(bucket);
  assert.equal((await rsvp(guest(2, { seat: 7 }))).status, 409);
  const seats = await handler({ httpMethod: "GET" });
  assert.deepEqual(JSON.parse(String(seats.body)), { taken: [7] });
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

test("по id сайт узнаёт, есть ли анкета на сервере и какое за ней место", async () => {
  const { handler, rsvp, guest, post } = setup();
  const status = async (/** @type {number} */ n) => {
    const response = await handler({
      httpMethod: "GET",
      queryStringParameters: { id: id(n) },
    });
    return JSON.parse(String(response.body));
  };

  assert.deepEqual(await status(1), { taken: [], guest: null });
  await rsvp(guest(1));
  assert.deepEqual(await status(1), { taken: [], guest: { seat: null } });
  await rsvp(guest(1, { seat: 4 }));
  assert.deepEqual(await status(1), { taken: [4], guest: { seat: 4 } });

  // Именинник удалил анкету — сайт гостя увидит это и начнёт приглашение заново.
  await post({ action: "remove", key: ADMIN_KEY, id: id(1) });
  assert.deepEqual(await status(1), { taken: [], guest: null });
});

test("фото: принимается к существующей анкете, отдаётся и удаляется вместе с ней", async () => {
  const { handler, rsvp, guest, post } = setup();
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);
  /** @param {string} method @param {string} photo @param {Buffer} [body] */
  const photo = (method, photo, body) =>
    handler({ httpMethod: method, queryStringParameters: { photo }, body });
  const error = async (/** @type {ReturnType<typeof photo>} */ response) => {
    const { statusCode, body } = await response;
    return [statusCode, JSON.parse(String(body)).error];
  };

  assert.deepEqual(await error(photo("POST", id(1), jpeg)), [404, "unknown_guest"]);
  await rsvp(guest(1));
  assert.deepEqual(await error(photo("GET", id(1))), [404, "no_photo"]);

  assert.deepEqual(await error(photo("POST", id(1), Buffer.from("not a jpeg"))), [400, "invalid"]);
  const huge = Buffer.concat([jpeg, Buffer.alloc(400 * 1024)]);
  assert.deepEqual(await error(photo("POST", id(1), huge)), [413, "too_large"]);
  assert.deepEqual(await error(photo("POST", "../guests.json", jpeg)), [400, "invalid"]);

  assert.equal((await photo("POST", id(1), jpeg)).statusCode, 200);
  const served = await photo("GET", id(1));
  assert.equal(served.headers["Content-Type"], "image/jpeg");
  assert.deepEqual(served.body, jpeg);

  // Повторная анкета (например, с местом) не должна сбрасывать отметку о фото.
  await rsvp(guest(1, { seat: 6 }));
  const { guests } = (await post({ action: "list", key: ADMIN_KEY })).data;
  assert.deepEqual([guests[0].photo, guests[0].seat], [true, 6]);

  await post({ action: "remove", key: ADMIN_KEY, id: id(1) });
  assert.deepEqual(await error(photo("GET", id(1))), [404, "no_photo"]);
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
