/* Бейдж гостя: карточка 85,6 × 54 мм на листе A4 с метками для резки. */
import type { PDFImage } from "pdf-lib";

import { EVENT } from "~/config";

import { statusTitle, WHEN, type PrintGuest } from "./facts";
import { agePaper, seeded, stamp } from "./paper";
import { COLOR, hex, Sheet, type Book } from "./sheet";

// Карточка размером с банковскую; на листе стоит там же, где в макете.
const CARD = { x: 62.2, y: 40, w: 85.6, h: 54 };
const RADIUS = 3;
const MARGIN = 5;
const EDGE = hex("#ae9365");
const NOTE = hex("#4e4e4e");

export function addBadge(book: Book, guest: PrintGuest, photo: PDFImage | null) {
  const sheet = new Sheet(book, 210, 297);
  const random = seeded(guest.id);
  const { x, y, w, h } = CARD;
  const right = x + w - MARGIN;
  const label = { font: "type", size: 6.6, color: COLOR.muted } as const;

  sheet.clipped(x, y, w, h, RADIUS, () => {
    sheet.rect(x, y, w, h, { fill: COLOR.paper });
    agePaper(sheet, random, CARD);
    sheet.rect(x, y, w, 12.5, { fill: COLOR.ink });
  });
  sheet.rect(x, y, w, h, { stroke: EDGE, width: 0.3, radius: RADIUS });
  // Прорезь под ленту или клипсу.
  sheet.rect(x + w / 2 - 7, y + 2.6, 14, 3, { fill: COLOR.white, radius: 1.5 });
  sheet.text(`ПРОПУСК · ДЕЛО № ${EVENT.caseNo}`, x + w / 2, y + 10.6, {
    font: "head",
    size: 8,
    color: COLOR.paper,
    align: "center",
    spacing: 0.08,
  });

  // Фото 3×4 из анкеты; без него остаётся рамка, куда гостя можно дорисовать.
  const frame = { x: x + MARGIN + 0.5, y: y + 15.4, w: 21, h: 28 };
  if (photo) {
    sheet.image(photo, frame.x, frame.y, frame.w, frame.h);
    sheet.rect(frame.x, frame.y, frame.w, frame.h, { stroke: COLOR.muted, width: 0.25 });
  } else {
    sheet.rect(frame.x, frame.y, frame.w, frame.h, {
      fill: COLOR.paper2,
      stroke: COLOR.muted,
      width: 0.3,
      dash: [1, 0.7],
    });
    ["МЕСТО ДЛЯ", "ФОТО / РИСУНКА"].forEach((line, i) =>
      sheet.text(line, frame.x + frame.w / 2, frame.y + 12.8 + i * 2.7, {
        ...label,
        size: 6,
        align: "center",
      }),
    );
  }

  // Колонка справа от фото.
  const column = x + 31;
  sheet.text("ГОСТЬ:", column, y + 18.2, label);
  sheet.text(guest.name.toUpperCase(), column, y + 26, {
    font: "head",
    size: 17,
    color: COLOR.ink,
    fit: right - column,
  });
  sheet.line(column, y + 27.7, right, y + 27.7, {
    stroke: COLOR.ink,
    width: 0.25,
    dash: [0.9, 0.6],
  });
  const rows = [
    ["Статус:", statusTitle(guest.know), COLOR.ok],
    ["Место:", `№ ${guest.seat}, за столом`, COLOR.ink],
    ["Допуск:", "к торту", COLOR.ink],
  ] as const;
  rows.forEach(([name, value, color], i) => {
    const base = y + 33.3 + i * 5;
    sheet.text(name, column, base, label);
    sheet.text(value, column + 13, base, { ...label, size: 6.8, color, bold: true });
  });
  stamp(sheet, random, x + 68.5, y + 41.2, 10.5);

  sheet.line(x + MARGIN, y + 45.7, right, y + 45.7, {
    stroke: COLOR.line,
    width: 0.15,
    dash: [0.9, 0.6],
  });
  sheet.text(WHEN, x + MARGIN, y + 49.6, { ...label, size: 5.4 });
  barcode(sheet, guest.id, x + 50.5, y + 47.6, right - x - 50.5, 3.7);

  cropMarks(sheet);
  sheet.text(
    "Бейдж 85,6 × 54 мм (размер банковской карты). Печать 100%, без масштабирования.",
    sheet.width / 2,
    y + h + 10,
    { font: "type", size: 8, color: NOTE, align: "center" },
  );
}

/** Штрихкод для вида: полоски задаёт идентификатор анкеты, у каждого гостя свои. */
function barcode(sheet: Sheet, id: string, x: number, y: number, w: number, h: number) {
  const bars = [...id.replaceAll("-", "")].slice(0, 24).map((ch) => {
    const digit = parseInt(ch, 16) || 0;
    return { bar: 1 + (digit & 3), gap: 1.2 + (digit >> 2) * 0.6 };
  });
  const total = bars.reduce((sum, { bar, gap }) => sum + bar + gap, -bars.at(-1)!.gap);
  const unit = w / total;
  let at = x;
  for (const { bar, gap } of bars) {
    sheet.rect(at, y, bar * unit, h, { fill: COLOR.ink });
    at += (bar + gap) * unit;
  }
}

/** Метки для резки: штрихи у каждого угла, вынесенные за край карточки. */
function cropMarks(sheet: Sheet) {
  const mark = { stroke: NOTE, width: 0.2 };
  for (const [cx, dx] of [[CARD.x, -1], [CARD.x + CARD.w, 1]]) {
    for (const [cy, dy] of [[CARD.y, -1], [CARD.y + CARD.h, 1]]) {
      sheet.line(cx + 2 * dx, cy, cx + 6 * dx, cy, mark);
      sheet.line(cx, cy + 2 * dy, cx, cy + 6 * dy, mark);
    }
  }
}
