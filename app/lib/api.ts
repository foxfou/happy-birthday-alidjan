/* Клиент функции из backend/: анкеты, занятые места и список для именинника. */
import { API_URL } from "~/config";

import type { Guest } from "./guest";

export const apiEnabled = API_URL !== "";

export type GuestRecord = Omit<Guest, "sent"> & {
  createdAt: string;
  updatedAt: string;
};

async function call<T>(init: RequestInit, timeoutMs = 10_000) {
  const response = await fetch(API_URL, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: response.status, data: (await response.json()) as T };
}

function post<T>(body: object, timeoutMs?: number) {
  return call<T>(
    {
      method: "POST",
      // text/plain — «простой» запрос, браузер не шлёт перед ним preflight.
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

export async function fetchTakenSeats(timeoutMs?: number) {
  const { status, data } = await call<{ taken: number[] }>({}, timeoutMs);
  if (status !== 200) throw new Error(`seats: HTTP ${status}`);
  return data.taken;
}

export type RsvpResult =
  | { accepted: true }
  /** Место успели занять; seat — место, которое осталось за гостем на сервере. */
  | { accepted: false; seat: number | null };

/** Бросает ошибку, если сервер недоступен или отклонил анкету целиком. */
export async function sendRsvp(
  { id, name, know, reason, skills, seat }: Guest,
  timeoutMs?: number,
): Promise<RsvpResult> {
  const { status, data } = await post<{ error?: string; seat?: number | null }>(
    { action: "rsvp", guest: { id, name, know, reason, skills, seat } },
    timeoutMs,
  );
  if (status === 200) return { accepted: true };
  if (status === 409 && data.error === "seat_taken") {
    return { accepted: false, seat: data.seat ?? null };
  }
  throw new Error(`rsvp: HTTP ${status}`);
}

/** null — ключ не подошёл. */
export async function listGuests(key: string) {
  const { status, data } = await post<{ guests: GuestRecord[] }>({
    action: "list",
    key,
  });
  if (status === 403) return null;
  if (status !== 200) throw new Error(`list: HTTP ${status}`);
  return data.guests;
}

export async function removeGuest(key: string, id: string) {
  const { status } = await post({ action: "remove", key, id });
  if (status !== 200) throw new Error(`remove: HTTP ${status}`);
}
