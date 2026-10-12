/* Что печатается о госте: общее для бейджа и таблички. */
import { EVENT, STATUS } from "~/config";
import type { GuestRecord } from "~/lib/api";

/** Гость с выбранным местом: без места ни бейдж, ни табличка не выдаются. */
export type PrintGuest = Pick<GuestRecord, "id" | "name" | "know" | "photo"> & {
  seat: number;
};

const [year, month, day] = EVENT.iso.slice(0, 10).split("-");

/** Дата и время встречи в записи номера дела: «24.10.26 · 16:00». */
export const WHEN = `${day}.${month}.${year.slice(2)} · ${EVENT.time}`;

/** Статус для печати — первая фраза статуса с сайта: «ДОВЕРЕННОЕ ЛИЦО». */
export const statusTitle = (know: number) =>
  STATUS[know].split(".")[0].toUpperCase();
