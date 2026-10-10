// @ts-check
// Локальная копия функции без облака: данные живут в памяти до перезапуска.
// Запуск: node backend/dev-server.js, затем VITE_API_URL=http://localhost:8787 для фронта.
const { createServer } = require("node:http");

const { createHandler } = require("./handler");
const { createMemoryStore } = require("./memory-store");

const port = Number(process.env.PORT ?? 8787);
const adminKey = process.env.ADMIN_KEY ?? "dev";

const handler = createHandler({ store: createMemoryStore(), adminKey });

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  // Как и в облаке, тело text/plain приходит в функцию закодированным в base64.
  const response = await handler({
    httpMethod: req.method,
    body: Buffer.concat(chunks).toString("base64"),
    isBase64Encoded: true,
  });
  res.writeHead(response.statusCode, response.headers).end(response.body);
}).listen(port, () => {
  console.log(`API: http://localhost:${port}`);
  console.log(`Страница именинника: /guests/${adminKey}`);
});
