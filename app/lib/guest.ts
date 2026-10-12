import { redirect } from "react-router";

import { clearPhoto } from "./photo";

export type Guest = {
  /** Случайный идентификатор анкеты: по нему сервер отличает гостей друг от друга. */
  id: string;
  name: string;
  know: number;
  reason: string;
  skills: string[];
  seat: number | null;
  /** Сервер знает о текущем месте гостя. */
  sent: boolean;
  /** Фото с устройства (см. photo.ts) уже загружено на сервер. */
  photoSent?: boolean;
};

const KEY = "ali-bd-2610";

export function loadGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Guest;
    if (stored.id) return stored;
    // Анкеты, сохранённые до появления сервера, идентификатора не имели.
    const guest = { ...stored, id: crypto.randomUUID(), sent: false };
    saveGuest(guest);
    return guest;
  } catch {
    return null;
  }
}

export function saveGuest(guest: Guest) {
  try {
    localStorage.setItem(KEY, JSON.stringify(guest));
  } catch {}
}

/**
 * Меняет отдельные поля сохранённой анкеты. Фоновые операции пользуются этим,
 * чтобы не затереть то, что гость успел изменить, пока они шли.
 */
export function updateGuest(id: string, patch: Partial<Guest>) {
  const guest = loadGuest();
  if (guest?.id === id) saveGuest({ ...guest, ...patch });
}

export function clearGuest() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  clearPhoto();
}

export type SeatedGuest = Guest & { seat: number };

/**
 * Шаги между досье и местом: без досье возвращаем к нему, а тем, кто место уже
 * выбрал, показываем только пропуск — менять в деле больше нечего.
 */
export function requirePendingGuest(): Guest {
  const guest = loadGuest();
  if (!guest?.name) throw redirect("/dossier");
  if (guest.seat) throw redirect("/pass");
  return guest;
}

/** Пропуск выдаётся только после выбора места. */
export function requireSeatedGuest(): SeatedGuest {
  const guest = loadGuest();
  if (!guest?.name) throw redirect("/dossier");
  if (!guest.seat) throw redirect("/seat");
  return guest as SeatedGuest;
}
