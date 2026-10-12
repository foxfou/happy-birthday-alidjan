/* Печатный лист: обёртка над страницей pdf-lib. Размеры и координаты — в
   миллиметрах от левого верхнего угла, как их удобно снимать с макета. */
import fontkit from "@pdf-lib/fontkit";
import {
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  endPath,
  lineTo,
  moveTo,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  setGraphicsState,
  setLineWidth,
  setStrokingColor,
  setTextRenderingMode,
  TextRenderingMode,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";

const MM = 72 / 25.4;

export function hex(value: string) {
  const n = parseInt(value.slice(1), 16);
  return rgb((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Цвета сайта (@theme в app.css): печать — продолжение того же дела. */
export const COLOR = {
  paper: hex("#e8dcbb"),
  paper2: hex("#d9c9a0"),
  ink: hex("#232c40"),
  muted: hex("#65583f"),
  line: hex("#b8a678"),
  stamp: hex("#a3302a"),
  ok: hex("#2f5f45"),
  pen: hex("#2b4a9b"),
  white: rgb(1, 1, 1),
};

/** Шрифты сайта: заголовочный Oswald, машинописный PT Mono, рукописный Marck Script. */
export type FontName = "head" | "type" | "hand";
export type FontFiles = Record<FontName, ArrayBuffer | Uint8Array>;

/** Подшивка: один PDF и вложенные в него шрифты. */
export type Book = {
  pdf: PDFDocument;
  fonts: Record<FontName, PDFFont>;
  /** Знаки, которые есть в шрифте: остальные при наборе пропускаются. */
  glyphs: Record<FontName, Set<number>>;
};

export async function openBook(files: FontFiles, title: string): Promise<Book> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title);
  // Шрифты вкладываются целиком: когда pdf-lib оставляет только использованные
  // знаки, у PT Mono пропадает часть букв.
  const fonts = {
    head: await pdf.embedFont(files.head),
    type: await pdf.embedFont(files.type),
    hand: await pdf.embedFont(files.hand),
  };
  const glyphs = {
    head: new Set(fonts.head.getCharacterSet()),
    type: new Set(fonts.type.getCharacterSet()),
    hand: new Set(fonts.hand.getCharacterSet()),
  };
  return { pdf, fonts, glyphs };
}

export type Shape = {
  fill?: RGB;
  stroke?: RGB;
  /** Толщина линии, мм. */
  width?: number;
  /** Штрих и пробел пунктира, мм. */
  dash?: number[];
};

export type TextStyle = {
  font: FontName;
  /** Кегль в пунктах. */
  size: number;
  color: RGB;
  align?: "left" | "center" | "right";
  /** Ширина в мм, в которую строка обязана уместиться: длинная набирается мельче. */
  fit?: number;
  /** Разрядка в долях кегля. */
  spacing?: number;
  /** PT Mono выпущен в одном начертании — жирное получается обводкой букв. */
  bold?: boolean;
};

// Толщина обводки «жирного» в долях кегля.
const BOLD = 0.035;
// Кривая Безье, ближе всего повторяющая четверть окружности.
const ARC = 0.5523;

const n = (value: number) => +value.toFixed(3);

function rectPath(x: number, y: number, w: number, h: number, r = 0) {
  if (!r) return `M${n(x)} ${n(y)} h${n(w)} v${n(h)} h${n(-w)} z`;
  const corner = (dx: number, dy: number) =>
    `a${n(r)} ${n(r)} 0 0 1 ${n(dx * r)} ${n(dy * r)}`;
  return [
    `M${n(x + r)} ${n(y)} h${n(w - 2 * r)}`,
    `${corner(1, 1)} v${n(h - 2 * r)}`,
    `${corner(-1, 1)} h${n(2 * r - w)}`,
    `${corner(-1, -1)} v${n(2 * r - h)}`,
    `${corner(1, -1)} z`,
  ].join(" ");
}

export class Sheet {
  private readonly page: PDFPage;

  constructor(
    private readonly book: Book,
    readonly width: number,
    readonly height: number,
  ) {
    this.page = book.pdf.addPage([width * MM, height * MM]);
  }

  /** Контур в синтаксисе SVG path; числа в нём — миллиметры. */
  path(d: string, { fill, stroke, width = 0.2, dash }: Shape) {
    this.page.drawSvgPath(d, {
      x: 0,
      y: this.height * MM,
      scale: MM,
      color: fill,
      borderColor: stroke,
      borderWidth: stroke ? width : 0,
      borderDashArray: dash,
    });
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    shape: Shape & { radius?: number },
  ) {
    this.path(rectPath(x, y, w, h, shape.radius), shape);
  }

  line(x1: number, y1: number, x2: number, y2: number, shape: Shape) {
    this.path(`M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}`, shape);
  }

  circle(cx: number, cy: number, r: number, shape: Shape) {
    const half = (dx: number) => `a${n(r)} ${n(r)} 0 1 0 ${n(dx)} 0`;
    this.path(`M${n(cx - r)} ${n(cy)} ${half(2 * r)} ${half(-2 * r)} z`, shape);
  }

  /** Ширина строки в мм и кегль, которым она наберётся с учётом fit. */
  measure(value: string, { font, size, fit, spacing = 0 }: TextStyle) {
    const glyphs = this.book.glyphs[font];
    const line = [...value]
      .filter((ch) => glyphs.has(ch.codePointAt(0)!))
      .join("")
      .trim();
    const gaps = Math.max(line.length - 1, 0);
    const widthAt = (pt: number) =>
      (this.book.fonts[font].widthOfTextAtSize(line, pt) + spacing * pt * gaps) / MM;
    const natural = widthAt(size);
    const fitted = fit && natural > fit ? (size * fit) / natural : size;
    return { line, size: fitted, width: widthAt(fitted) };
  }

  /** Строка с базовой линией в точке (x, y). Возвращает ширину набранного, мм. */
  text(value: string, x: number, y: number, style: TextStyle) {
    const { line, size, width } = this.measure(value, style);
    const { align = "left", color, spacing = 0 } = style;
    const left = x - (align === "center" ? width / 2 : align === "right" ? width : 0);

    // Разрядка и обводка — часть состояния текста: drawText их наследует.
    this.page.pushOperators(pushGraphicsState(), setCharacterSpacing(spacing * size));
    if (style.bold) {
      this.page.pushOperators(
        setTextRenderingMode(TextRenderingMode.FillAndOutline),
        setStrokingColor(color),
        setLineWidth(size * BOLD),
      );
    }
    this.page.drawText(line, {
      x: left * MM,
      y: (this.height - y) * MM,
      size,
      font: this.book.fonts[style.font],
      color,
    });
    this.page.pushOperators(popGraphicsState());
    return width;
  }

  image(image: PDFImage, x: number, y: number, w: number, h: number) {
    this.page.drawImage(image, {
      x: x * MM,
      y: (this.height - y - h) * MM,
      width: w * MM,
      height: h * MM,
    });
  }

  /** Всё, что рисует draw, повёрнуто вокруг точки; угол — как в CSS, по часовой стрелке. */
  rotated(cx: number, cy: number, degrees: number, draw: () => void) {
    // В PDF ось Y смотрит вверх, поэтому тот же поворот идёт с обратным знаком.
    const angle = (-degrees * Math.PI) / 180;
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const [px, py] = [cx * MM, (this.height - cy) * MM];
    this.page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(
        cos,
        sin,
        -sin,
        cos,
        px - px * cos + py * sin,
        py - px * sin - py * cos,
      ),
    );
    draw();
    this.page.pushOperators(popGraphicsState());
  }

  /** Полупрозрачный слой; multiply — краска ложится на бумагу, как у штампа. */
  layer(opacity: number, draw: () => void, multiply = false) {
    const state = this.book.pdf.context.obj({
      Type: "ExtGState",
      ca: opacity,
      CA: opacity,
      ...(multiply && { BM: "Multiply" }),
    });
    this.page.pushOperators(
      pushGraphicsState(),
      setGraphicsState(this.page.node.newExtGState("GS", state)),
    );
    draw();
    this.page.pushOperators(popGraphicsState());
  }

  /** Всё, что рисует draw, обрезается по прямоугольнику со скруглёнными углами. */
  clipped(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    draw: () => void,
  ) {
    const [left, bottom] = [x * MM, (this.height - y - h) * MM];
    const [right, top] = [left + w * MM, bottom + h * MM];
    const r = radius * MM;
    const k = r * (1 - ARC);
    this.page.pushOperators(
      pushGraphicsState(),
      moveTo(left + r, bottom),
      lineTo(right - r, bottom),
      appendBezierCurve(right - k, bottom, right, bottom + k, right, bottom + r),
      lineTo(right, top - r),
      appendBezierCurve(right, top - k, right - k, top, right - r, top),
      lineTo(left + r, top),
      appendBezierCurve(left + k, top, left, top - k, left, top - r),
      lineTo(left, bottom + r),
      appendBezierCurve(left, bottom + k, left + k, bottom, left + r, bottom),
      closePath(),
      clip(),
      endPath(),
    );
    draw();
    this.page.pushOperators(popGraphicsState());
  }
}
