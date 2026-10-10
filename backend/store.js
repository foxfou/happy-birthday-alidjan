// @ts-check
// Хранилище гостей в YDB (serverless). Таблица создаётся из schema.sql (migrate.js).
const {
  Driver,
  MetadataAuthService,
  TypedValues,
  Types,
  getCredentialsFromEnv,
} = require("ydb-sdk");

const { planRsvp, takenSeats } = require("./rsvp");

/** @typedef {import("./rsvp").Guest} Guest */
/** @typedef {import("ydb-sdk").QuerySession} QuerySession */

const SELECT_ALL = `
  SELECT id, name, know, reason, skills, seat, created_at, updated_at FROM guests;`;

const UPSERT = `
  DECLARE $id AS Utf8;
  DECLARE $name AS Utf8;
  DECLARE $know AS Uint8;
  DECLARE $reason AS Utf8;
  DECLARE $skills AS Utf8;
  DECLARE $seat AS Optional<Uint8>;
  DECLARE $created_at AS Timestamp;
  DECLARE $updated_at AS Timestamp;

  UPSERT INTO guests (id, name, know, reason, skills, seat, created_at, updated_at)
  VALUES ($id, $name, $know, $reason, $skills, $seat, $created_at, $updated_at);`;

const DELETE = `
  DECLARE $id AS Utf8;
  DELETE FROM guests WHERE id = $id;`;

const METADATA_TOKEN_URL =
  "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token";

/**
 * IAM-токен сервисного аккаунта функции из сервиса метаданных. ydb-sdk умеет это
 * сам только с тяжёлым @yandex-cloud/nodejs-sdk — обходимся одним запросом.
 */
const metadataToken = {
  token: "",
  expiresAt: 0,
  getToken() {
    return Date.now() < this.expiresAt ? this.token : undefined;
  },
  async initialize() {
    const response = await fetch(METADATA_TOKEN_URL, {
      headers: { "Metadata-Flavor": "Google" },
    });
    if (!response.ok) throw new Error(`metadata: HTTP ${response.status}`);
    const { access_token, expires_in } = await response.json();
    this.token = access_token;
    // Обновляем с запасом, не дожидаясь истечения.
    this.expiresAt = Date.now() + (expires_in - 300) * 1000;
  },
};

/** @type {Promise<Driver> | undefined} */
let driverPromise;

/** Драйвер живёт между вызовами, пока экземпляр функции «тёплый». */
function getDriver() {
  driverPromise ??= (async () => {
    const driver = new Driver({
      endpoint: process.env.YDB_ENDPOINT,
      database: process.env.YDB_DATABASE,
      // Локально — токен из переменных YDB_*_CREDENTIALS, в облаке — из метаданных.
      authService: process.env.YDB_ACCESS_TOKEN_CREDENTIALS
        ? getCredentialsFromEnv()
        : new MetadataAuthService(metadataToken),
    });
    if (!(await driver.ready(10_000))) {
      throw new Error("YDB: драйвер не подключился за 10 секунд");
    }
    return driver;
  })();
  driverPromise.catch(() => (driverPromise = undefined));
  return driverPromise;
}

/** @param {QuerySession} session @returns {Promise<Guest[]>} */
async function readGuests(session) {
  const { resultSets } = await session.execute({ text: SELECT_ALL });
  const guests = [];
  for await (const resultSet of resultSets) {
    // SDK сам переводит имена колонок из snake_case в camelCase, а Timestamp — в Date.
    for await (const row of resultSet.rows) {
      guests.push({
        id: row.id,
        name: row.name,
        know: row.know,
        reason: row.reason,
        skills: JSON.parse(row.skills),
        seat: row.seat ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    }
  }
  return guests;
}

async function listGuests() {
  const driver = await getDriver();
  return driver.queryClient.doTx({
    txSettings: { snapshotReadOnly: {} },
    fn: readGuests,
  });
}

/** @type {import("./handler").Store} */
const store = {
  async takenSeats() {
    return takenSeats(await listGuests());
  },

  listGuests,

  async saveGuest(input) {
    const driver = await getDriver();
    // Чтение всех гостей и запись идут одной сериализуемой транзакцией: если кто-то
    // успел занять место между чтением и коммитом, YDB отменит её, а doTx повторит
    // всё заново — уже с новым списком занятых мест.
    return driver.queryClient.doTx({
      fn: async (session) => {
        const plan = planRsvp(await readGuests(session), input, new Date());
        if (plan.status !== "ok") return plan;

        const { guest } = plan;
        const { opFinished } = await session.execute({
          text: UPSERT,
          parameters: {
            $id: TypedValues.utf8(guest.id),
            $name: TypedValues.utf8(guest.name),
            $know: TypedValues.uint8(guest.know),
            $reason: TypedValues.utf8(guest.reason),
            $skills: TypedValues.utf8(JSON.stringify(guest.skills)),
            $seat:
              guest.seat === null
                ? TypedValues.optionalNull(Types.UINT8)
                : TypedValues.optional(TypedValues.uint8(guest.seat)),
            $created_at: TypedValues.timestamp(guest.createdAt),
            $updated_at: TypedValues.timestamp(guest.updatedAt),
          },
        });
        await opFinished;
        return plan;
      },
    });
  },

  async removeGuest(id) {
    const driver = await getDriver();
    await driver.queryClient.doTx({
      fn: async (session) => {
        const { opFinished } = await session.execute({
          text: DELETE,
          parameters: { $id: TypedValues.utf8(id) },
        });
        await opFinished;
      },
    });
  },
};

module.exports = { store };
