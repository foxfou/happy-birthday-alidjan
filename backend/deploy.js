// @ts-check
// Выкладывает новую версию функции в Yandex Cloud: npm run deploy (из папки backend).
// Нужен установленный и настроенный yc (yc init); настройки берутся из backend/.env.
const { execFileSync } = require("node:child_process");
const { cpSync, existsSync, mkdtempSync, rmSync } = require("node:fs");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");

const SOURCES = [
  "index.js",
  "handler.js",
  "rsvp.js",
  "store.js",
  "package.json",
  "package-lock.json",
];
const REQUIRED = [
  "FUNCTION_NAME",
  "SERVICE_ACCOUNT_ID",
  "YDB_ENDPOINT",
  "YDB_DATABASE",
  "ADMIN_KEY",
];

process.loadEnvFile(join(__dirname, ".env"));
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`В backend/.env не заданы: ${missing.join(", ")}`);
}
const { FUNCTION_NAME, SERVICE_ACCOUNT_ID, YDB_ENDPOINT, YDB_DATABASE, ADMIN_KEY } =
  /** @type {Record<string, string>} */ (process.env);

// Сразу после установки yc ещё может не быть в PATH текущего терминала.
const installed = join(homedir(), "yandex-cloud", "bin", "yc.exe");
const yc = existsSync(installed) ? installed : "yc";
// Без явного адреса API команды `yc serverless` падают с «endpoint should be set».
const API = ["--endpoint", "api.cloud.yandex.net:443"];

/** @param {string[]} args */
const run = (args) =>
  execFileSync(yc, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

console.log("1/2 Схема базы…");
const token = run(["iam", "create-token"]).trim();
execFileSync(process.execPath, [join(__dirname, "migrate.js")], {
  stdio: "inherit",
  env: { ...process.env, YDB_ACCESS_TOKEN_CREDENTIALS: token },
});

console.log("2/2 Новая версия функции…");
// В облако уходит только код: зависимости оно ставит само по package-lock.json.
const stage = mkdtempSync(join(tmpdir(), "birthday-fn-"));
try {
  for (const file of SOURCES) cpSync(join(__dirname, file), join(stage, file));
  const version = JSON.parse(
    run([
      "serverless", "function", "version", "create", ...API,
      "--function-name", FUNCTION_NAME,
      "--runtime", "nodejs22",
      "--entrypoint", "index.handler",
      "--memory", "256MB",
      "--execution-timeout", "10s",
      "--service-account-id", SERVICE_ACCOUNT_ID,
      "--source-path", stage,
      "--environment",
      `YDB_ENDPOINT=${YDB_ENDPOINT},YDB_DATABASE=${YDB_DATABASE},ADMIN_KEY=${ADMIN_KEY}`,
      "--format", "json",
    ]),
  );
  console.log(`Готово: версия ${version.id}, статус ${version.status}.`);
  console.log(`Адрес: https://functions.yandexcloud.net/${version.function_id}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
