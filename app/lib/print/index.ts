/* Печать для именинника: бейджи и таблички на стол по анкетам гостей. PDF
   собирается прямо в браузере — серверу для этого ничего делать не нужно. */
import handUrl from "@expo-google-fonts/marck-script/400Regular/MarckScript_400Regular.ttf?url";
import headUrl from "@expo-google-fonts/oswald/700Bold/Oswald_700Bold.ttf?url";
import typeUrl from "@expo-google-fonts/pt-mono/400Regular/PTMono_400Regular.ttf?url";

import { EVENT } from "~/config";
import { photoUrl } from "~/lib/api";

import { addBadge } from "./badge";
import type { PrintGuest } from "./facts";
import { addPlate } from "./plate";
import { openBook, type FontFiles } from "./sheet";

export type { PrintGuest };
export type PrintKind = "badge" | "plate";

/** Название файла: для одного гостя и для всех сразу. */
const TITLES: Record<PrintKind, [one: string, all: string]> = {
  badge: ["Бейдж", "Бейджи"],
  plate: ["Табличка", "Таблички"],
};

async function download(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`print: HTTP ${response.status}`);
  return response.arrayBuffer();
}

// Те же шрифты, что на сайте, но целыми файлами TTF: pdf-lib вкладывает в PDF
// только их, а @fontsource раздаёт woff2, нарезанный по алфавитам.
let fontFiles: Promise<FontFiles> | undefined;

function loadFonts() {
  fontFiles ??= Promise.all([headUrl, typeUrl, handUrl].map(download)).then(
    ([head, type, hand]) => ({ head, type, hand }),
    (error) => {
      // Не запоминаем неудачу: следующая попытка скачает шрифты заново.
      fontFiles = undefined;
      throw error;
    },
  );
  return fontFiles;
}

/** PDF, в котором каждому гостю отведён свой лист. */
export async function buildPrint(kind: PrintKind, guests: PrintGuest[]) {
  const [fonts, photos] = await Promise.all([
    loadFonts(),
    Promise.all(
      guests.map((guest) =>
        kind === "badge" && guest.photo ? download(photoUrl(guest.id)) : null,
      ),
    ),
  ]);

  const book = await openBook(fonts, `${TITLES[kind][1]} — Дело № ${EVENT.caseNo}`);
  for (const [i, guest] of guests.entries()) {
    const photo = photos[i];
    if (kind === "plate") addPlate(book, guest);
    else addBadge(book, guest, photo && (await book.pdf.embedJpg(photo)));
  }
  // В типах pdf-lib результат лежит в «любом буфере», на деле это обычный ArrayBuffer.
  const bytes = (await book.pdf.save()) as Uint8Array<ArrayBuffer>;
  return new Blob([bytes], { type: "application/pdf" });
}

/** Собирает PDF и отдаёт его браузеру как скачанный файл. */
export async function savePrint(kind: PrintKind, guests: PrintGuest[]) {
  const [one, all] = TITLES[kind];
  const [guest] = guests;
  const name =
    guests.length === 1
      ? `${one}, место ${guest.seat} — ${guest.name}`
      : `${all} — дело ${EVENT.caseNo}`;

  const link = document.createElement("a");
  link.href = URL.createObjectURL(await buildPrint(kind, guests));
  // В имени файла нельзя то, что запрещают файловые системы: «/» из номера дела и т. п.
  link.download = `${name.replace(/[\\/:*?"<>|]+/g, "-")}.pdf`;
  link.click();
  // Ссылку отзываем не сразу: браузеру нужно время, чтобы забрать файл.
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
}
