/* Клиент сервиса из backend/: анкеты, занятые места и список для именинника. */
import { API_URL } from "~/config";

import type { Guest } from "./guest";

export const apiEnabled = API_URL !== "";

export type GuestRecord = Omit<Guest, "sent"> & {
  createdAt: string;
  updatedAt: string;
};

// Если сервер не ответил, пару минут к нему не ходим: пока облако лежит, гость
// не должен ждать таймаута на каждом шаге — он сразу идёт запасным путём.
const RETRY_AFTER_MS = 120_000;
let downUntil = 0;

type CallOptions = {
  query?: string;
  timeoutMs?: number;
  /** Пробовать, даже если сервер недавно не отвечал (страница именинника). */
  insist?: boolean;
};

async function call<T>(
  init: RequestInit,
  { query = "", timeoutMs = 8000, insist = false }: CallOptions = {},
) {
  if (!insist && Date.now() < downUntil) {
    throw new Error("server: недавно не отвечал");
  }
  try {
    const response = await fetch(API_URL + query, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await response.json()) as T;
    downUntil = 0;
    return { status: response.status, data };
  } catch (error) {
    downUntil = Date.now() + RETRY_AFTER_MS;
    throw error;
  }
}

function post<T>(body: object, options?: CallOptions) {
  return call<T>(
    {
      method: "POST",
      // text/plain — «простой» запрос, браузер не шлёт перед ним preflight.
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
    },
    options,
  );
}

export async function fetchTakenSeats(timeoutMs?: number) {
  const { status, data } = await call<{ taken: number[] }>({}, { timeoutMs });
  if (status !== 200) throw new Error(`seats: HTTP ${status}`);
  return data.taken;
}

/**
 * Место, записанное за анкетой на сервере; null — анкеты там нет (именинник её удалил).
 */
export async function fetchGuestStatus(id: string) {
  const { status, data } = await call<{
    guest?: { seat: number | null } | null;
  }>({}, { query: `?id=${encodeURIComponent(id)}` });
  if (status !== 200) throw new Error(`status: HTTP ${status}`);
  return data.guest;
}

export type RsvpResult =
  | { accepted: true }
  /** Место успели занять; seat — место, которое осталось за гостем на сервере. */
  | { accepted: false; seat: number | null };

/** Бросает ошибку, если сервер недоступен или отклонил анкету целиком. */
export async function sendRsvp({
  id,
  name,
  know,
  reason,
  skills,
  seat,
}: Guest): Promise<RsvpResult> {
  const { status, data } = await post<{ error?: string; seat?: number | null }>(
    { action: "rsvp", guest: { id, name, know, reason, skills, seat } },
  );
  if (status === 200) return { accepted: true };
  if (status === 409 && data.error === "seat_taken") {
    return { accepted: false, seat: data.seat ?? null };
  }
  throw new Error(`rsvp: HTTP ${status}`);
}

/** null — ключ не подошёл. */
export async function listGuests(key: string) {
  const { status, data } = await post<{ guests: GuestRecord[] }>(
    { action: "list", key },
    { insist: true },
  );
  if (status === 403) return null;
  if (status !== 200) throw new Error(`list: HTTP ${status}`);
  return data.guests;
}

export async function removeGuest(key: string, id: string) {
  const { status } = await post(
    { action: "remove", key, id },
    { insist: true },
  );
  if (status !== 200) throw new Error(`remove: HTTP ${status}`);
}
