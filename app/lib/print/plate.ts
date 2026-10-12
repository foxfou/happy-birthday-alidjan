/* Табличка на стол: лист A4 поперёк, сгибается пополам «домиком». На обеих
   половинах одно и то же, верхняя перевёрнута — табличку читают с двух сторон. */
import { EVENT, SEAT_MARKS } from "~/config";

import { statusTitle, WHEN, type PrintGuest } from "./facts";
import { agePaper, cupRing, seeded, stamp, staple, type Random } from "./paper";
import { COLOR, Sheet, type Book } from "./sheet";

const [W, H] = [297, 210];
const [LEFT, RIGHT] = [16, W - 16];
// Рамка с номером места и правый край текста слева от неё.
const BOX = { x: 210.6, y: 126.7, w: RIGHT - 210.6, h: 40.5 };
const TEXT_END = BOX.x - 6;
const VALUES = 58;

export function addPlate(book: Book, guest: PrintGuest) {
  const sheet = new Sheet(book, W, H);
  const random = seeded(guest.id);

  sheet.rect(0, 0, W, H, { fill: COLOR.paper });
  agePaper(sheet, random, { x: 0, y: 0, w: W, h: H });

  // Сгиб: тень из полос одна в другой и пунктир, по которому складывать.
  sheet.layer(0.035, () => {
    for (const half of [7, 5, 3.5, 2, 1, 0.4]) {
      sheet.rect(0, H / 2 - half, W, 2 * half, { fill: COLOR.muted });
    }
  });
  sheet.layer(0.55, () => {
    sheet.line(0, H / 2, W, H / 2, { stroke: COLOR.muted, width: 0.2, dash: [3, 2] });
    sheet.text("сгиб", 3, H / 2 - 1.2, { font: "type", size: 6.5, color: COLOR.muted });
  });

  const side = () => drawSide(sheet, guest, random);
  side();
  sheet.rotated(W / 2, H / 2, 180, side);
}

/** Нижняя половина листа; верхняя — она же, повёрнутая вокруг центра. */
function drawSide(sheet: Sheet, guest: PrintGuest, random: Random) {
  const small = { font: "type", color: COLOR.muted } as const;
  const head = { font: "head", size: 12, color: COLOR.muted, spacing: 0.04 } as const;

  cupRing(sheet, 30 + random() * 150, 142 + random() * 36, 10 + random() * 3);
  staple(sheet, 14, 110.2);

  sheet.text(`ДЕЛО № ${EVENT.caseNo}`, LEFT, 119, head);
  sheet.text("ПРОВЕРКА ГОСТЕЙ · СЕКРЕТНО · ДЛЯ ВНУТРЕННЕГО ПОЛЬЗОВАНИЯ", RIGHT, 118.2, {
    ...small,
    size: 8.6,
    align: "right",
  });
  sheet.line(LEFT, 122.5, RIGHT, 122.5, { stroke: COLOR.ink, width: 0.7 });

  sheet.text("ЗАРЕЗЕРВИРОВАНО ДЛЯ:", LEFT, 134, { ...small, size: 13 });
  sheet.text(guest.name.toUpperCase(), LEFT, 156, {
    font: "head",
    size: 54,
    color: COLOR.ink,
    fit: TEXT_END - LEFT,
  });
  sheet.line(LEFT, 160, TEXT_END, 160, {
    stroke: COLOR.ink,
    width: 0.3,
    dash: [1.3, 0.9],
  });

  const rows = [
    ["Особые приметы:", SEAT_MARKS[guest.seat] ?? "не выявлены", COLOR.ink],
    ["Статус досье:", statusTitle(guest.know), COLOR.ok],
    ["Допуск:", "к столу, к торту — разрешён", COLOR.ink],
  ] as const;
  rows.forEach(([name, value, color], i) => {
    const base = 168 + i * 8.5;
    sheet.text(name, LEFT, base, { ...small, size: 11 });
    sheet.text(value, VALUES, base, {
      font: "type",
      size: 11.5,
      color,
      bold: true,
      fit: TEXT_END - VALUES,
    });
    sheet.line(LEFT, base + 1.7, TEXT_END, base + 1.7, { stroke: COLOR.line });
  });

  sheet.rect(BOX.x, BOX.y, BOX.w, BOX.h, { stroke: COLOR.ink, width: 0.9 });
  sheet.rect(BOX.x + 2.2, BOX.y + 2.2, BOX.w - 4.4, BOX.h - 4.4, {
    stroke: COLOR.ink,
    width: 0.3,
  });
  const middle = BOX.x + BOX.w / 2;
  sheet.text("МЕСТО №", middle, 136.5, { ...head, align: "center" });
  sheet.text(String(guest.seat), middle, 160.5, {
    font: "head",
    size: 52,
    color: COLOR.ink,
    align: "center",
  });

  // Приписка ручкой — чуть наискось.
  sheet.rotated(LEFT, 195.5, 1.6, () =>
    sheet.text("чужие места проверяются — не занимать!", LEFT, 195.5, {
      font: "hand",
      size: 20,
      color: COLOR.pen,
    }),
  );

  sheet.line(LEFT, 201.5, RIGHT, 201.5, { stroke: COLOR.line, dash: [1.3, 0.9] });
  const issued = [WHEN, EVENT.address, "Выдано лично"].filter(Boolean).join(" · ");
  sheet.text(issued, LEFT, 205.4, { ...small, size: 8 });
  sheet.text("ЭКЗЕМПЛЯР №1 · ДЕЛО ЗАКРЫТО ТОРТОМ", RIGHT, 205.4, {
    ...small,
    size: 8,
    align: "right",
  });

  stamp(sheet, random, 231, 188, 26);
}
