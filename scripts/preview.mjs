// Локальная имитация GitHub Pages: статика из build/client под базовым путём,
// на путь без своего файла — 404.html со статусом 404.
// Запуск: node scripts/preview.mjs [/base-path/] (или BASE_PATH, как при сборке).
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = "build/client";
const trimmed = (process.argv[2] ?? process.env.BASE_PATH ?? "/").replace(
  /^\/+|\/+$/g,
  "",
);
const base = trimmed ? `/${trimmed}/` : "/";
const port = Number(process.env.PORT ?? 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (!pathname.startsWith(base)) {
    res.writeHead(302, { location: base }).end();
    return;
  }

  let file = normalize(decodeURIComponent(pathname.slice(base.length)));
  if (file.startsWith("..")) file = "404.html";
  if (!extname(file)) file = join(file, "index.html");

  const send = async (status, name) => {
    const body = await readFile(join(root, name));
    res.writeHead(status, { "content-type": types[extname(name)] }).end(body);
  };
  await send(200, file).catch(() => send(404, "404.html"));
}).listen(port, () => {
  console.log(`GitHub Pages preview: http://localhost:${port}${base}`);
});
