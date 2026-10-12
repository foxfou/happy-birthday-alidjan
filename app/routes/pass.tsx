import { useEffect, useRef, useState } from "react";
import { useNavigate, useRevalidator } from "react-router";

import type { Route } from "./+types/pass";
import { Stage } from "~/components/stage";
import { EVENT, STATUS } from "~/config";
import { apiEnabled } from "~/lib/api";
import { requireSeatedGuest, type SeatedGuest } from "~/lib/guest";
import { loadPhoto, PHOTO } from "~/lib/photo";
import { sfx } from "~/lib/sfx";
import { syncGuest, syncPhoto } from "~/lib/sync";

/* Последний экран дела: место выбрано, заполнять больше нечего. Здесь гость видит
   свой пропуск со всеми деталями встречи — сюда же он попадает, вернувшись на сайт. */

export function clientLoader() {
  return { guest: requireSeatedGuest(), photo: loadPhoto() };
}

export default function Pass({ loaderData }: Route.ComponentProps) {
  const { guest, photo } = loaderData;
  const navigate = useNavigate();
  const { revalidate } = useRevalidator();

  // Пропуск показываем сразу, а с сервером сверяемся в фоне.
  useEffect(() => {
    if (!apiEnabled) return;
    let stale = false;
    syncGuest(guest).then(
      (result) => {
        if (stale) return;
        if (result.state === "removed") navigate("/", { replace: true });
        if (result.state === "lost") {
          navigate(`/seat?lost=${result.seat}`, { replace: true });
        }
        if (result.state === "updated") void revalidate();
        // Анкета на сервере есть — можно дослать фото, если оно ещё не дошло.
        if (result.state === "same") void syncPhoto().catch(() => {});
      },
      () => {}, // сервер недоступен — пропуск остаётся как есть
    );
    return () => {
      stale = true;
    };
  }, [guest, navigate, revalidate]);

  const weekday = EVENT.weekday[0].toUpperCase() + EVENT.weekday.slice(1);

  return (
    <Stage title="Допуск оформлен">
      <p className="muted">
        Досье принято, место закреплено. Заполнять больше нечего — осталось
        прийти.
      </p>

      <article className="pass">
        <header className="pass-head">Пропуск · Дело № {EVENT.caseNo}</header>
        <div className="pass-body">
          <div className="pass-who" data-photo={photo ? "" : undefined}>
            {photo && (
              <img
                className="photo-frame"
                src={photo}
                alt={`Фото: ${guest.name}`}
                width={PHOTO.width}
                height={PHOTO.height}
              />
            )}
            <div>
              <span className="pass-label">Гость</span>
              <strong className="pass-name">{guest.name}</strong>
            </div>
            <div className="pass-seat">
              <span className="pass-label">Место №</span>
              <strong>{guest.seat}</strong>
            </div>
          </div>

          <time dateTime={EVENT.iso}>
            <span className="when">
              {weekday}, {EVENT.date}
            </span>
            <span className="time">в {EVENT.time}</span>
          </time>

          <dl className="facts">
            <div>
              <dt>Где</dt>
              <dd>{EVENT.place}</dd>
            </div>
            {EVENT.dress && (
              <div>
                <dt>Дресс-код</dt>
                <dd>{EVENT.dress}</dd>
              </div>
            )}
            <div>
              <dt>Статус</dt>
              <dd>{STATUS[guest.know]}</dd>
            </div>
            <div>
              <dt>Допуск</dt>
              <dd>К столу и к торту — разрешён</dd>
            </div>
          </dl>
          <span className="stamp ok pass-stamp">Допущен</span>
        </div>
        <footer className="pass-foot">Экземпляр № 1 · Дело закрыто тортом</footer>
      </article>

      {guest.sent ? (
        <p className="hint">
          {EVENT.host} уже в курсе: анкета и место записаны в деле.
        </p>
      ) : (
        <ManualNotice guest={guest} />
      )}
    </Stage>
  );
}

/**
 * Запасной путь, когда сервер у гостя не открылся (или не подключён вовсе):
 * место известно только этому устройству, и сообщить о нём гость должен сам.
 */
function ManualNotice({ guest }: { guest: SeatedGuest }) {
  const [copyNote, setCopyNote] = useState("");
  const message = useRef<HTMLTextAreaElement>(null);

  const text = `${EVENT.host}, это ${guest.name}. Допуск одобрен. Занимаю место №${guest.seat} за столом ${EVENT.dateShort} в ${EVENT.time}. Приду!`;
  const telegramLink = EVENT.ownerTg
    ? `https://t.me/${EVENT.ownerTg}?text=${encodeURIComponent(text)}`
    : `https://t.me/share/url?url=${encodeURIComponent(location.origin + import.meta.env.BASE_URL)}&text=${encodeURIComponent(text)}`;

  async function copyMessage() {
    sfx.tick(3);
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote(`Сообщение скопировано. Вставьте его в чат с ${EVENT.host}.`);
    } catch {
      message.current?.select();
      setCopyNote(
        "Не удалось скопировать автоматически. Текст выделен: скопируйте его вручную.",
      );
    }
  }

  return (
    <>
      <p className="hint">
        Записать место в общее дело пока не удалось. Чтобы {EVENT.host} закрепил
        его за вами, отправьте ему это сообщение.
      </p>
      <textarea
        ref={message}
        readOnly
        aria-label={`Сообщение для ${EVENT.host}`}
        value={text}
      />
      <div className="row">
        <a className="btn" href={telegramLink} target="_blank" rel="noopener">
          Отправить в Telegram
        </a>
        <button className="btn ghost" type="button" onClick={copyMessage}>
          Скопировать
        </button>
      </div>
      <div className="hint mt-2" role="status">
        {copyNote}
      </div>
    </>
  );
}
