import { useEffect, useRef, useState } from "react";
import { Form, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/seat";
import { Stage } from "~/components/stage";
import { EVENT, SEATS } from "~/config";
import { apiEnabled, fetchTakenSeats, sendRsvp } from "~/lib/api";
import { clearGuest, requireGuest, saveGuest } from "~/lib/guest";
import { prefersReducedMotion } from "~/lib/motion";
import { sfx } from "~/lib/sfx";

// Схема стола не должна надолго зависать, если сервер у гостя не открывается.
const LOADER_TIMEOUT_MS = 5000;

export async function clientLoader() {
  let guest = requireGuest();
  let taken = EVENT.takenSeats;
  let lostSeat: number | null = null;
  if (apiEnabled) {
    try {
      // Место, выбранное без связи с сервером, досылаем при первой возможности.
      if (guest.seat && !guest.sent) {
        const result = await sendRsvp(guest, LOADER_TIMEOUT_MS);
        if (result.accepted) {
          guest = { ...guest, sent: true };
        } else {
          lostSeat = guest.seat;
          guest = { ...guest, seat: result.seat, sent: result.seat !== null };
        }
        saveGuest(guest);
      }
      taken = await fetchTakenSeats(LOADER_TIMEOUT_MS);
    } catch {
      // Сервер недоступен: показываем стол как есть, занятость он проверит при записи.
    }
  }
  return { guest, taken, lostSeat };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "reset") {
    clearGuest();
    return redirect("/");
  }

  const seat = Number(form.get("seat"));
  if (!(seat in SEATS) || seat === EVENT.hostSeat) {
    return { error: "Такого места за столом нет." };
  }
  const guest = { ...requireGuest(), seat };
  if (!apiEnabled) {
    saveGuest(guest);
    return { seat };
  }
  try {
    if (!(await sendRsvp(guest)).accepted) {
      return { error: "Это место только что заняли. Выберите другое." };
    }
    saveGuest({ ...guest, sent: true });
  } catch {
    // Сервер недоступен: место запоминаем у гостя, а имениннику он напишет сам.
    saveGuest({ ...guest, sent: false });
  }
  return { seat };
}

export default function Seat({ loaderData, actionData }: Route.ComponentProps) {
  const { guest, taken, lostSeat } = loaderData;
  const navigation = useNavigation();
  const saving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") !== "reset";
  const [choice, setChoice] = useState(guest.seat);
  const [copyNote, setCopyNote] = useState("");
  const done = useRef<HTMLDivElement>(null);
  const message = useRef<HTMLTextAreaElement>(null);

  const isFree = (seat: number) =>
    seat !== EVENT.hostSeat && (seat === guest.seat || !taken.includes(seat));
  // Выбранное место могли занять, пока гость думал, — тогда выбор возвращается к своему.
  const pending = choice !== null && isFree(choice) ? choice : guest.seat;

  // Место закреплено: штамп, звон и блок с итогом, даже если он ниже экрана.
  useEffect(() => {
    if (!actionData?.seat) return;
    sfx.stamp();
    const chime = setTimeout(sfx.chime, 280);
    done.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
    return () => clearTimeout(chime);
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

      <Form method="post">
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
                      setChoice(seat);
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
          disabled={saving || !pending || pending === guest.seat}
        >
          {saving
            ? "Записываем…"
            : !pending
              ? "Выберите место"
              : pending === guest.seat
                ? `Место №${pending} за вами`
                : `${guest.seat ? "Пересесть на" : "Занять"} место №${pending}`}
        </button>
        <div className="err mt-2" role="alert">
          {actionData?.error ??
            (lostSeat &&
              `Пока не было связи, место №${lostSeat} заняли. ${
                guest.seat
                  ? `За вами осталось №${guest.seat}.`
                  : "Выберите другое."
              }`)}
        </div>
      </Form>

      {guest.seat && (
        <div ref={done} className="mt-3">
          <span className="stamp ok small">Место закреплено</span>
          <p className="mt-3.5">
            {guest.name}, ваше место — №{guest.seat}. Ждём {when}.
          </p>
          {guest.sent ? (
            <p className="hint">
              {EVENT.host} уже в курсе: анкета и место записаны в деле.
            </p>
          ) : (
            <>
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
                <button
                  className="btn ghost"
                  type="button"
                  onClick={copyMessage}
                >
                  Скопировать
                </button>
              </div>
              <div className="hint mt-2" role="status">
                {copyNote}
              </div>
            </>
          )}
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
