import { redirect } from "react-router";

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

export function clearGuest() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Для шагов после досье: без заполненного досье дальше не пускаем. */
export function requireGuest(): Guest {
  const guest = loadGuest();
  if (!guest?.name) throw redirect("/dossier");
  return guest;
}
