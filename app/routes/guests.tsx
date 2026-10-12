import { data, useFetcher, useRevalidator } from "react-router";

import type { Route } from "./+types/guests";
import { Stage } from "~/components/stage";
import { EVENT, KNOW, SEATS } from "~/config";
import { apiEnabled, listGuests, photoUrl, removeGuest } from "~/lib/api";
import { PHOTO } from "~/lib/photo";

/* Страница именинника: кто заполнил анкету и какие места заняты. Ссылок на неё
   с сайта нет: она открывается только по адресу с ключом, который знает сервер.
   С любым другим адресом выглядит как несуществующая страница. */

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (!apiEnabled) throw data(null, { status: 404 });
  try {
    const guests = await listGuests(params.key);
    if (guests) return { guests };
  } catch {
    return { guests: null };
  }
  throw data(null, { status: 404 });
}

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const form = await request.formData();
  try {
    await removeGuest(params.key, String(form.get("id")));
    return null;
  } catch {
    return { error: "Не получилось удалить. Проверьте связь и попробуйте ещё раз." };
  }
}

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export default function Guests({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator();
  const remover = useFetcher<typeof clientAction>();
  const busy = revalidator.state === "loading" || remover.state !== "idle";

  const refresh = (
    <button
      className="btn"
      type="button"
      disabled={busy}
      onClick={() => revalidator.revalidate()}
    >
      Обновить
    </button>
  );

  if (!loaderData.guests) {
    return (
      <Stage title="Список допущенных">
        <p className="muted">Архив не отвечает. Проверьте связь.</p>
        {refresh}
      </Stage>
    );
  }

  const guests = [...loaderData.guests].sort(
    (a, b) =>
      (a.seat ?? Infinity) - (b.seat ?? Infinity) ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const seated = guests.filter((guest) => guest.seat).length;
  const seatsTotal = Object.keys(SEATS).length - 1;

  return (
    <Stage title="Список допущенных">
      <p className="muted">
        Анкет: {guests.length}. Занято мест: {seated} из {seatsTotal}.
      </p>

      {guests.length === 0 && <p>Пока никто не оформил допуск.</p>}
      <ul className="guests">
        {guests.map((guest) => (
          <li key={guest.id} className="guest">
            {guest.photo && (
              <a href={photoUrl(guest.id)} target="_blank" rel="noopener">
                <img
                  className="photo-frame"
                  src={photoUrl(guest.id)}
                  alt={`Фото: ${guest.name}`}
                  width={PHOTO.width}
                  height={PHOTO.height}
                  loading="lazy"
                />
              </a>
            )}
            <h3>{guest.name}</h3>
            <p className="guest-seat">
              {guest.seat ? `Место №${guest.seat}` : "Место не выбрано"}
            </p>
            <dl className="facts">
              <div>
                <dt>Знакомство</dt>
                <dd>{KNOW[guest.know]}</dd>
              </div>
              <div>
                <dt>Причина</dt>
                <dd>{guest.reason}</dd>
              </div>
              <div>
                <dt>Навыки</dt>
                <dd>{guest.skills.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Анкета</dt>
                <dd>
                  <time dateTime={guest.createdAt}>
                    {dateTime.format(new Date(guest.createdAt))}
                  </time>
                </dd>
              </div>
            </dl>
            <remover.Form
              method="post"
              onSubmit={(event) => {
                const question = `Удалить анкету «${guest.name}»? Место освободится.`;
                if (!confirm(question)) event.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={guest.id} />
              <button className="link-reset" disabled={busy}>
                Удалить анкету
              </button>
            </remover.Form>
          </li>
        ))}
      </ul>

      <div className="err" role="alert">
        {remover.data?.error}
      </div>
      {refresh}
      <p className="hint mt-4">
        Гость ошибся или хочет пересесть — удалите его анкету: место
        освободится, а приглашение на его устройстве начнётся заново.{" "}
        {EVENT.host}, эта страница открывается только по вашей ссылке — не
        пересылайте её.
      </p>
    </Stage>
  );
}
