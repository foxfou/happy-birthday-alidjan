/* Фактура «дела»: разводы на бумаге, след от чашки, скрепка и штамп. Всё
   собрано из кругов и линий, без картинок — так же сделаны макеты. */
import { COLOR, hex, type Sheet } from "./sheet";

const STAIN = hex("#98571b");
const STEEL = hex("#9ea3a8");
const GLINT = hex("#e3e6e8");

export type Random = () => number;

/** Случайные числа с зерном: у каждого гостя свои пятна, а при повторной печати — те же. */
export function seeded(seed: string): Random {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Area = { x: number; y: number; w: number; h: number };

// Развод — стопка кругов один в другом: к середине краска копится и темнеет.
// Слоёв немного и каждый заметный: совсем прозрачные принтер округляет до нуля.
const RINGS = 6;

/** Бурые разводы и мелкий сор по бумаге. Рисовать внутри обрезки по краю листа. */
export function agePaper(sheet: Sheet, random: Random, { x, y, w, h }: Area) {
  const side = Math.min(w, h);
  const spot = () => [x + random() * w, y + random() * h] as const;

  sheet.layer(0.022, () => {
    for (let i = Math.round((w * h) / 7000) + 2; i > 0; i--) {
      const [cx, cy] = spot();
      const r = side * (0.08 + random() * 0.16);
      for (let ring = RINGS; ring > 0; ring--) {
        sheet.circle(cx, cy, (r * ring) / RINGS, { fill: STAIN });
      }
    }
  });
  sheet.layer(0.3, () => {
    for (let i = Math.round((w * h) / 400); i > 0; i--) {
      sheet.circle(...spot(), 0.06 + random() * 0.14, { fill: COLOR.muted });
    }
  });
}

/** След от чашки: кольцо и второе, потоньше, чуть в стороне. */
export function cupRing(sheet: Sheet, cx: number, cy: number, r: number) {
  sheet.layer(0.2, () => {
    sheet.circle(cx, cy, r, { stroke: STAIN, width: 0.55 });
    sheet.circle(cx + r * 0.06, cy - r * 0.05, r * 0.92, { stroke: STAIN, width: 0.2 });
  });
}

/** Скрепка степлера длиной length с левым концом в точке (x, y). */
export function staple(sheet: Sheet, x: number, y: number, length = 12) {
  sheet.rotated(x, y, 4, () => {
    sheet.layer(0.25, () => {
      sheet.rect(x + 0.3, y - 0.4, length, 1.5, { fill: COLOR.ink, radius: 0.7 });
    });
    sheet.rect(x, y - 0.75, length, 1.5, { fill: STEEL, radius: 0.7 });
    sheet.line(x + 0.8, y - 0.3, x + length - 0.8, y - 0.3, { stroke: GLINT, width: 0.3 });
  });
}

/**
 * Штамп с двойной рамкой с центром в точке (cx, cy): повёрнут и «непропечатан»,
 * как на сайте. Все размеры считаются от кегля надписи.
 */
export function stamp(
  sheet: Sheet,
  random: Random,
  cx: number,
  cy: number,
  size: number,
  label = "ДОПУЩЕН",
) {
  const em = (size * 25.4) / 72;
  const style = { font: "head", size, color: COLOR.stamp, spacing: 0.06 } as const;
  const w = sheet.measure(label, style).width + 1.5 * em;
  const h = 1.7 * em;
  const frame = (inset: number, width: number) =>
    sheet.rect(cx - w / 2 + inset, cy - h / 2 + inset, w - 2 * inset, h - 2 * inset, {
      stroke: COLOR.stamp,
      width,
      radius: 0.22 * em - inset / 2,
    });

  sheet.rotated(cx, cy, -8, () => {
    sheet.layer(
      0.9,
      () => {
        frame(0, 0.13 * em);
        frame(0.2 * em, 0.035 * em);
        // Прописные Oswald высотой 0,81 кегля — ставим их по центру рамки.
        sheet.text(label, cx, cy + 0.405 * em, { ...style, align: "center" });
      },
      true,
    );
    // Непропечатанные места: крапинки цвета бумаги поверх краски.
    for (let i = 0; i < 28; i++) {
      sheet.circle(
        cx + (random() - 0.5) * w,
        cy + (random() - 0.5) * h,
        (0.02 + random() * 0.035) * em,
        { fill: COLOR.paper },
      );
    }
  });
}
