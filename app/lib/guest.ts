import { redirect } from "react-router";

export type Guest = {
  name: string;
  know: number;
  reason: string;
  skills: string[];
  seat: number | null;
};

const KEY = "ali-bd-2610";

export function loadGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Guest) : null;
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
