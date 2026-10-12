// @ts-check
// Точка входа сервиса: контейнер в Cloud.ru Container Apps и локальный запуск (npm start).
// С переменными S3_* анкеты лежат файлом в бакете; без них — в памяти, для разработки.
const { createServer } = require("node:http");

const { createFileStore, memoryBlob } = require("./file-store");
const { createHandler } = require("./handler");
const { createS3Blob } = require("./s3-blob");

const MAX_REQUEST_BYTES = 16 * 1024;
const port = Number(process.env.PORT ?? 8787);
const local = !process.env.S3_BUCKET;

if (local) {
  console.warn("S3_BUCKET не задан: анкеты хранятся в памяти до перезапуска.");
}

const handler = createHandler({
  store: createFileStore(local ? memoryBlob() : createS3Blob(process.env)),
  adminKey: process.env.ADMIN_KEY ?? (local ? "dev" : undefined),
});

createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const { searchParams } = new URL(req.url ?? "/", "http://localhost");
    const response = await handler({
      httpMethod: req.method,
      queryStringParameters: Object.fromEntries(searchParams),
      body: Buffer.concat(chunks).toString("utf8"),
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
