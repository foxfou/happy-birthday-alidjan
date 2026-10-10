// @ts-check
// Применяет schema.sql к базе YDB. Запускается из deploy.ps1; повторный запуск безопасен.
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const { Driver, getCredentialsFromEnv } = require("ydb-sdk");

async function main() {
  const driver = new Driver({
    endpoint: process.env.YDB_ENDPOINT,
    database: process.env.YDB_DATABASE,
    authService: getCredentialsFromEnv(),
  });
  if (!(await driver.ready(10_000))) {
    throw new Error("YDB: драйвер не подключился за 10 секунд");
  }
  const text = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await driver.queryClient.do({
    fn: async (session) => {
      const { opFinished } = await session.execute({ text });
      await opFinished;
    },
  });
  await driver.destroy();
  console.log("Схема применена.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
