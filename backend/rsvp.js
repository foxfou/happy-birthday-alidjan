// @ts-check
// Правила приёма анкет: проверка входных данных и решение, можно ли записать гостя.
// Здесь нет ни HTTP, ни базы — только логика, поэтому она целиком покрыта тестами.

// Должно совпадать с app/config.ts: места 1…MAX_SEAT, место именинника не бронируется.
const MAX_SEAT = 10;
const HOST_SEAT = 1;
const MAX_KNOW = 4;
const MAX_SKILLS = 3;
const MAX_GUESTS = 100;

/**
 * @typedef {object} Guest
 * @property {string} id
 * @property {string} name
 * @property {number} know
 * @property {string} reason
 * @property {string[]} skills
 * @property {number | null} seat
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/** @typedef {Pick<Guest, "id" | "name" | "know" | "reason" | "skills" | "seat">} GuestInput */

/** @param {unknown} value @param {number} max */
function text(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : null;
}

/**
 * Разбирает анкету из запроса. Возвращает либо гостя, либо имя первого неверного поля.
 * @param {any} raw
 * @returns {{ guest: GuestInput } | { invalid: string }}
 */
function parseGuest(raw) {
  if (!raw || typeof raw !== "object") return { invalid: "guest" };

  if (typeof raw.id !== "string" || !/^[0-9a-f-]{36}$/i.test(raw.id)) {
    return { invalid: "id" };
  }
  const name = text(raw.name, 28);
  if (!name) return { invalid: "name" };
  if (!Number.isInteger(raw.know) || raw.know < 0 || raw.know > MAX_KNOW) {
    return { invalid: "know" };
  }
  const reason = text(raw.reason, 80);
  if (reason === null) return { invalid: "reason" };

  if (!Array.isArray(raw.skills) || raw.skills.length > MAX_SKILLS) {
    return { invalid: "skills" };
  }
  const skills = raw.skills.map((/** @type {unknown} */ s) => text(s, 40));
  if (skills.some((/** @type {string | null} */ s) => !s)) {
    return { invalid: "skills" };
  }

  const seat = raw.seat ?? null;
  if (
    seat !== null &&
    (!Number.isInteger(seat) || seat < 1 || seat > MAX_SEAT || seat === HOST_SEAT)
  ) {
    return { invalid: "seat" };
  }

  return { guest: { id: raw.id, name, know: raw.know, reason, skills, seat } };
}

/** @param {Guest[]} guests */
function takenSeats(guests) {
  return guests
    .map((guest) => guest.seat)
    .filter((seat) => seat !== null)
    .sort((a, b) => a - b);
}

/**
 * Решает, что делать с анкетой при текущем содержимом таблицы.
 * @param {Guest[]} guests все записанные гости
 * @param {GuestInput} input
 * @param {Date} now
 * @returns {
 *   | { status: "ok", guest: Guest, taken: number[] }
 *   | { status: "seat_taken", taken: number[], seat: number | null }
 *   | { status: "full" }
 * }
 */
function planRsvp(guests, input, now) {
  const existing = guests.find((guest) => guest.id === input.id);
  const others = guests.filter((guest) => guest.id !== input.id);

  if (!existing && guests.length >= MAX_GUESTS) return { status: "full" };

  // Анкета без места приходит раньше выбора места, но по сети может и опоздать —
  // тогда она не должна стереть уже занятое место.
  const seat = input.seat ?? existing?.seat ?? null;
  if (seat !== null && others.some((guest) => guest.seat === seat)) {
    // Вместе с отказом сообщаем место, которое за гостем осталось.
    return {
      status: "seat_taken",
      taken: takenSeats(guests),
      seat: existing?.seat ?? null,
    };
  }

  const guest = {
    ...input,
    seat,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return { status: "ok", guest, taken: takenSeats([...others, guest]) };
}

module.exports = { parseGuest, planRsvp, takenSeats };
