// @ts-check
// Точка входа сервиса: контейнер в Cloud.ru Container Apps и локальный запуск (npm start).
// С переменными S3_* файлы лежат в бакете; без них — в памяти, для разработки.
const { createServer } = require("node:http");

const { createFileStore, memoryBucket } = require("./file-store");
const { createHandler, MAX_PHOTO_BYTES } = require("./handler");
const { createS3Bucket } = require("./s3-bucket");

// Самый большой допустимый запрос — фото; с запасом на заголовки тела.
const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + 1024;
const port = Number(process.env.PORT ?? 8787);
const local = !process.env.S3_BUCKET;

if (local) {
  console.warn("S3_BUCKET не задан: анкеты хранятся в памяти до перезапуска.");
}

const handler = createHandler({
  store: createFileStore(local ? memoryBucket() : createS3Bucket(process.env)),
  adminKey: process.env.ADMIN_KEY ?? (local ? "dev" : undefined),
});

createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        res.writeHead(413, { "Access-Control-Allow-Origin": "*" }).end();
        return;
      }
      chunks.push(chunk);
    }
    const { searchParams } = new URL(req.url ?? "/", "http://localhost");
    const response = await handler({
      httpMethod: req.method,
      queryStringParameters: Object.fromEntries(searchParams),
      body: Buffer.concat(chunks),
    });
    res.writeHead(response.statusCode, response.headers).end(response.body);
  } catch (error) {
    // Чаще всего сюда попадает недоступное хранилище: сайт гостя уйдёт на запасной путь.
    console.error(error);
    res
      .writeHead(500, {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json; charset=utf-8",
      })
      .end(JSON.stringify({ error: "internal" }));
  }
}).listen(port, () => {
  console.log(`API слушает порт ${port}`);
  if (local) console.log("Страница именинника: /guests/dev");
});
