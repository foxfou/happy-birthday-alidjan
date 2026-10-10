// После `react-router build` приводит build/client к виду, который ждёт GitHub Pages.
import { copyFileSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";

const client = "build/client";
const base = (process.env.BASE_PATH ?? "/").replace(/^\/+|\/+$/g, "");

// Pages сам отдаёт сайт из подпапки репозитория, а пререндер кладёт страницы
// в build/client/<basename>/ — поднимаем их в корень.
if (base) {
  const nested = join(client, base);
  cpSync(nested, client, { recursive: true });
  rmSync(nested, { recursive: true });
}

// На любой путь без своего файла (/seat, /check…) Pages отдаёт 404.html —
// кладём туда SPA-оболочку, и дальше маршрут разбирает клиент.
copyFileSync(join(client, "__spa-fallback.html"), join(client, "404.html"));
