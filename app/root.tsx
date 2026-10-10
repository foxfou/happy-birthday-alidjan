import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import faviconUrl from "./assets/favicon.svg?url";
import { SoundToggle } from "./components/sound-toggle";
import { EVENT } from "./config";

const TITLE = `Дело № ${EVENT.caseNo} — приглашение`;
const DESCRIPTION = `Закрытое мероприятие: день рождения ${EVENT.host}. Вход только по допуску — оформите его за минуту.`;

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: faviconUrl },
];

export const meta: Route.MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:type", content: "website" },
  { property: "og:locale", content: "ru_RU" },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Приглашение только для своих — поисковикам тут делать нечего. */}
        <meta name="robots" content="noindex" />
        <meta
          name="theme-color"
          content="#4a5650"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#1a201e"
          media="(prefers-color-scheme: dark)"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {/* Фильтр «неровных чернил» для штампов. */}
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="3"
              result="t"
            />
            <feDisplacementMap in="SourceGraphic" in2="t" scale="2.2" />
          </filter>
        </svg>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <main className="sheet" data-case={`Дело № ${EVENT.caseNo}`}>
      <span className="tape" aria-hidden="true" />
      <span className="staple" aria-hidden="true" />
      <span className="cup-ring" aria-hidden="true" />
      <span className="cup-ring-2" aria-hidden="true" />
      {children}
      <div className="archive" aria-hidden="true">
        Хранить постоянно. Экз. № 3. Копированию не подлежит.
      </div>
    </main>
  );
}

export default function App() {
  return (
    <>
      <SoundToggle />
      <Sheet>
        <Outlet />
      </Sheet>
    </>
  );
}

export function HydrateFallback() {
  return (
    <Sheet>
      <p className="muted">Поднимаем дело из архива…</p>
    </Sheet>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <Sheet>
      <h1>{notFound ? "Дело не найдено" : "Дело засекречено"}</h1>
      <p className="muted">
        {notFound
          ? "Такой страницы в архиве нет. Возможно, её изъяли."
          : "Что-то пошло не так. Попробуйте обновить страницу."}
      </p>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="mb-4 overflow-x-auto text-xs">{error.stack}</pre>
      )}
      <Link className="btn" to="/">
        Вернуться к делу
      </Link>
    </Sheet>
  );
}
