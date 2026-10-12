// @ts-check
// Файлы сервиса в S3-совместимом объектном хранилище (Cloud.ru Object Storage).
const { AwsClient } = require("aws4fetch");

const TIMEOUT_MS = 8000;

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {import("./file-store").Bucket}
 */
function createS3Bucket({
  S3_ENDPOINT = "https://s3.cloud.ru",
  S3_REGION = "ru-central-1",
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
}) {
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error("Нужны S3_BUCKET, S3_ACCESS_KEY_ID и S3_SECRET_ACCESS_KEY");
  }
  const aws = new AwsClient({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    service: "s3",
    region: S3_REGION,
    retries: 2,
  });

  /** @param {string} action @param {string} key @param {RequestInit} [init] */
  async function request(action, key, init) {
    const response = await aws.fetch(`${S3_ENDPOINT}/${S3_BUCKET}/${key}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`s3 ${action} ${key}: HTTP ${response.status}`);
    }
    return response;
  }

  return {
    async get(key) {
      const response = await request("get", key);
      if (response.status === 404) return null;
      return Buffer.from(await response.arrayBuffer());
    },

    async put(key, body, contentType) {
      const response = await request("put", key, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        // fetch принимает Buffer, но типы DOM об этом не знают
        body: /** @type {BodyInit} */ (/** @type {unknown} */ (body)),
      });
      if (!response.ok) throw new Error(`s3 put ${key}: HTTP ${response.status}`);
    },

    async remove(key) {
      await request("delete", key, { method: "DELETE" });
    },
  };
}

module.exports = { createS3Bucket };
