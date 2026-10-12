// @ts-check
// Файл с анкетами в S3-совместимом объектном хранилище (Cloud.ru Object Storage).
const { AwsClient } = require("aws4fetch");

const TIMEOUT_MS = 8000;

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {import("./file-store").Blob}
 */
function createS3Blob({
  S3_ENDPOINT = "https://s3.cloud.ru",
  S3_REGION = "ru-central-1",
  S3_BUCKET,
  S3_KEY = "guests.json",
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
  const url = `${S3_ENDPOINT}/${S3_BUCKET}/${S3_KEY}`;

  return {
    async read() {
      const response = await aws.fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`s3 read: HTTP ${response.status}`);
      return response.text();
    },

    async write(text) {
      const response = await aws.fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: text,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`s3 write: HTTP ${response.status}`);
    },
  };
}

module.exports = { createS3Blob };
