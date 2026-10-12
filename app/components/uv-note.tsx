import { useRef, useState } from "react";

import type { ClueProps } from "~/lib/casefile";
import { clamp } from "~/lib/num";

// Ближе этого расстояния (px) от центра пятна число считается найденным.
const CATCH = 30;
const KEY_STEP = 16;
const ARROWS: Record<string, [x: number, y: number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Улика №1: лист, исписанный невидимыми чернилами. Пятно УФ-лампы ходит за
 * курсором или пальцем (с клавиатуры — стрелками) и проявляет надписи под собой.
 */
export function UvNote({ code, solved, onSolve }: ClueProps) {
  const sheet = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLElement>(null);
  const spot = useRef<{ x: number; y: number }>(null);
  const caught = useRef(solved);
  const [lit, setLit] = useState(false);

  function shine(x: number, y: number) {
    const el = sheet.current!;
    x = clamp(x, 0, el.clientWidth);
    y = clamp(y, 0, el.clientHeight);
    spot.current = { x, y };
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);

    if (caught.current) return;
    const target = number.current!;
    const dx = target.offsetLeft + target.offsetWidth / 2 - x;
    const dy = target.offsetTop + target.offsetHeight / 2 - y;
    if (Math.hypot(dx, dy) < CATCH) {
      caught.current = true;
      onSolve();
    }
  }

  function follow(event: React.PointerEvent) {
    const rect = sheet.current!.getBoundingClientRect();
    shine(event.clientX - rect.left, event.clientY - rect.top);
  }

  return (
    <div
      ref={sheet}
      className="uv"
      role="application"
      tabIndex={0}
      aria-label="Лист под УФ-лампой. Лампу можно двигать стрелками."
      data-lit={lit || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        setLit(true);
        follow(event);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setLit(false);
      }}
      // Палец светит, только пока касается листа.
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setLit(true);
        follow(event);
      }}
      onPointerMove={follow}
      onPointerUp={(event) => {
        if (event.pointerType !== "mouse") setLit(false);
      }}
      onPointerCancel={() => setLit(false)}
      onKeyDown={(event) => {
        const step = ARROWS[event.key];
        if (!step) return;
        event.preventDefault();
        const el = sheet.current!;
        const from = spot.current ?? {
          x: el.clientWidth / 2,
          y: el.clientHeight / 2,
        };
        setLit(true);
        shine(from.x + step[0] * KEY_STEP, from.y + step[1] * KEY_STEP);
      }}
      onBlur={() => setLit(false)}
    >
      <span className="uv-memo" aria-hidden="true">
        <b>Служебная записка</b>
        Сведений не содержит. Лист оставлен чистым намеренно. Светить на него
        незачем.
      </span>
      <span className="uv-dark" aria-hidden="true" />
      <span className="uv-ink" aria-hidden="true">
        <span className="uv-cold">холодно</span>
        <span className="uv-was">здесь был Али</span>
        <span className="uv-warm">теплее →</span>
        <span className="uv-hot">горячо!</span>
        <svg className="uv-print" viewBox="0 0 40 50">
          {[4, 8, 12, 16, 20].map((r) => (
            <ellipse key={r} cx="20" cy="25" rx={r * 0.9} ry={r * 1.15} />
          ))}
        </svg>
        <b ref={number} className="uv-n">
          {code}
        </b>
      </span>
      {/* Найденное число остаётся на листе и при обычном свете. */}
      {solved && (
        <b className="uv-n uv-found" aria-hidden="true">
          {code}
        </b>
      )}
    </div>
  );
}
