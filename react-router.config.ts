import type { Config } from "@react-router/dev/config";

export default {
  // GitHub Pages раздаёт только статику, поэтому SPA без серверного рендера.
  ssr: false,
  // Локально сайт живёт в корне, на Pages — в подпапке репозитория.
  basename: process.env.BASE_PATH ?? "/",
  // Обложка попадает в HTML уже при сборке, остальные шаги рисует клиент.
  prerender: ["/"],
} satisfies Config;
