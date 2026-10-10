import { useEffect, useRef, useState } from "react";
import { Form, redirect } from "react-router";

import type { Route } from "./+types/seat";
import { Stage } from "~/components/stage";
import { EVENT, SEATS } from "~/config";
import { clearGuest, requireGuest, saveGuest } from "~/lib/guest";
import { prefersReducedMotion } from "~/lib/motion";
import { sfx } from "~/lib/sfx";

const isFree = (seat: number) =>
  seat in SEATS && seat !== EVENT.hostSeat && !EVENT.takenSeats.includes(seat);

export function clientLoader() {
  return requireGuest();
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "reset") {
    clearGuest();
    return redirect("/");
  }

  const seat = Number(form.get("seat"));
  if (!isFree(seat)) return { error: "Это место уже занято, выберите другое." };
  saveGuest({ ...requireGuest(), seat });
  return { seat };
}

export default function Seat({
  loaderData: guest,
  actionData,
}: Route.ComponentProps) {
  const [pending, setPending] = useState(guest.seat);
  const [copyNote, setCopyNote] = useState("");
  const done = useRef<HTMLDivElement>(null);
  const message = useRef<HTMLTextAreaElement>(null);

  // После подтверждения показываем блок с итогом, даже если он ниже экрана.
  useEffect(() => {
    if (!actionData?.seat) return;
    done.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
  }, [actionData]);

  const when = `${EVENT.dateShort} в ${EVENT.time}`;
  const text = `${EVENT.host}, это ${guest.name}. Допуск одобрен. Занимаю место №${guest.seat} за столом ${when}. Приду!`;
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
    <Stage title="Место за столом">
      <p className="muted">Выберите свободное место и подтвердите.</p>
      <div className="legend">
        <span>Круг — свободно</span>
        <span>Пунктир — занято</span>
        <span>Красный — ваш выбор</span>
      </div>

      <Form
        method="post"
        onSubmit={() => {
          sfx.stamp();
          setTimeout(sfx.chime, 280);
        }}
      >
        <fieldset>
          <legend className="sr-only">Схема стола</legend>
          <div className="table-map">
            <div className="table-top">
              <b>Стол</b>
              <span>
                {EVENT.dateShort}, {EVENT.time}
              </span>
            </div>
            {Object.entries(SEATS).map(([key, [column, row]]) => {
              const seat = Number(key);
              const isHost = seat === EVENT.hostSeat;
              const free = isFree(seat);
              const title = isHost
                ? "Место именинника"
                : `Место ${seat}${free ? "" : " занято"}`;
              return (
                <label
                  key={seat}
                  className="seat"
                  style={{ gridColumn: column, gridRow: row }}
                  title={title}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="seat"
                    value={seat}
                    checked={pending === seat}
                    disabled={!free}
                    aria-label={title}
                    onChange={() => {
                      setPending(seat);
                      sfx.knock();
                    }}
                  />
                  {isHost ? EVENT.host : free ? seat : "занято"}
                </label>
              );
            })}
          </div>
        </fieldset>
        <button
          className="btn"
          type="submit"
          disabled={!pending || pending === guest.seat}
        >
          {!pending
            ? "Выберите место"
            : pending === guest.seat
              ? `Место №${pending} за вами`
              : `${guest.seat ? "Пересесть на" : "Занять"} место №${pending}`}
        </button>
        {actionData?.error && (
          <div className="err mt-2" role="alert">
            {actionData.error}
          </div>
        )}
      </Form>

      {guest.seat && (
        <div ref={done} className="mt-[22px]">
          <span className="stamp ok small">Место закреплено</span>
          <p className="mt-3.5">
            {guest.name}, ваше место — №{guest.seat}. Ждём {when}.
          </p>
          <p className="hint">
            Чтобы {EVENT.host} закрепил место за вами, отправьте ему это
            сообщение.
          </p>
          <textarea
            ref={message}
            readOnly
            aria-label={`Сообщение для ${EVENT.host}`}
            value={text}
          />
          <div className="row">
            <a
              className="btn"
              href={telegramLink}
              target="_blank"
              rel="noopener"
            >
              Отправить в Telegram
            </a>
            <button className="btn ghost" type="button" onClick={copyMessage}>
              Скопировать
            </button>
          </div>
          <div className="hint mt-2" role="status">
            {copyNote}
          </div>
        </div>
      )}

      <Form method="post">
        <button className="link-reset" name="intent" value="reset">
          Пройти заново
        </button>
      </Form>
    </Stage>
  );
}
