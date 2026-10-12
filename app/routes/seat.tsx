import { useState } from "react";
import { Form, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/seat";
import { Stage } from "~/components/stage";
import { EVENT, SEATS } from "~/config";
import { apiEnabled, fetchTakenSeats, sendRsvp } from "~/lib/api";
import { requirePendingGuest, saveGuest } from "~/lib/guest";
import { sfx } from "~/lib/sfx";

// Схема стола не должна надолго зависать, если сервер у гостя не открывается.
const LOADER_TIMEOUT_MS = 4000;

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  requirePendingGuest();
  let taken = EVENT.takenSeats;
  if (apiEnabled) {
    try {
      taken = await fetchTakenSeats(LOADER_TIMEOUT_MS);
    } catch {
      // Сервер недоступен: показываем стол как есть, занятость он проверит при записи.
    }
  }
  // Сюда возвращает пропуск, если место, выбранное без связи, успели занять.
  const lostSeat = Number(new URL(request.url).searchParams.get("lost")) || null;
  return { taken, lostSeat };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const seat = Number(form.get("seat"));
  if (!(seat in SEATS) || seat === EVENT.hostSeat) {
    return { error: "Такого места за столом нет." };
  }

  const guest = { ...requirePendingGuest(), seat };
  if (apiEnabled) {
    try {
      if (!(await sendRsvp(guest)).accepted) {
        return { error: "Это место только что заняли. Выберите другое." };
      }
      guest.sent = true;
    } catch {
      // Сервер недоступен: место запоминаем у гостя, а имениннику он напишет сам.
      guest.sent = false;
    }
  }
  saveGuest(guest);
  sfx.stamp();
  setTimeout(sfx.chime, 280);
  return redirect("/pass");
}

export default function Seat({ loaderData, actionData }: Route.ComponentProps) {
  const { taken, lostSeat } = loaderData;
  const saving = useNavigation().state === "submitting";
  const [choice, setChoice] = useState<number | null>(null);

  const isFree = (seat: number) =>
    seat !== EVENT.hostSeat && !taken.includes(seat);
  // Выбранное место могли занять, пока гость думал.
  const pending = choice !== null && isFree(choice) ? choice : null;

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
        <button className="btn" type="submit" disabled={saving || !pending}>
          {saving
            ? "Записываем…"
            : pending
              ? `Занять место №${pending}`
              : "Выберите место"}
        </button>
        <div className="err mt-2" role="alert">
          {actionData?.error ??
            (lostSeat &&
              `Пока не было связи, место №${lostSeat} заняли. Выберите другое.`)}
        </div>
      </Form>
    </Stage>
  );
}
