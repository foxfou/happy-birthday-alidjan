// @ts-check
// Собирает образ сервиса и загружает его в Cloud.ru Artifact Registry: npm run deploy.
// Нужны запущенный Docker и заполненный backend/.env. Если у контейнера в Container Apps
// включено автоматическое развёртывание, новая ревизия создаётся сама.
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

process.loadEnvFile(join(__dirname, ".env"));
const { REGISTRY, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
if (!REGISTRY || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  throw new Error(
    "В backend/.env нужны REGISTRY, S3_ACCESS_KEY_ID и S3_SECRET_ACCESS_KEY",
  );
}

// Хранилищу нужен идентификатор <tenant_id>:<key_id>, реестру — только key_id.
const keyId = /** @type {string} */ (S3_ACCESS_KEY_ID.split(":").pop());
const image = `${REGISTRY}/birthday-api:latest`;

/** @param {string[]} args @param {string} [input] */
const docker = (args, input) =>
  execFileSync("docker", args, {
    input,
    stdio: [input ? "pipe" : "ignore", "inherit", "inherit"],
  });

docker(["login", REGISTRY, "--username", keyId, "--password-stdin"], S3_SECRET_ACCESS_KEY);
// Без --provenance=false Docker кладёт под тегом не сам образ, а индекс с аттестацией,
// и Container Apps не даёт выбрать такой тег.
docker([
  "build",
  "--platform", "linux/amd64",
  "--provenance=false",
  "--tag", image,
  __dirname,
]);
docker(["push", image]);
console.log(`Загружено: ${image}`);
