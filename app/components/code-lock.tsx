import { Fragment, useRef, useState } from "react";

import { mod } from "~/lib/num";
import { sfx } from "~/lib/sfx";

// Высота одной цифры на колесе, px; стили берут её из --cell.
const CELL = 34;
// Соседние цифры рисуются с запасом: они въезжают в окошко, пока колесо крутят.
const AROUND = [-2, -1, 0, 1, 2];

/**
 * Кодовый замок папки. Положение колеса — счётчик шагов без сброса на девятке:
 * цифра на нём равна остатку от деления на 10, зато прокрутка 9 → 0 идёт вперёд.
 */
export function CodeLock({
  ref,
  positions,
  open,
  onStep,
}: {
  ref?: React.Ref<HTMLDivElement>;
  positions: number[];
  open: boolean;
  onStep: (wheel: number, by: number) => void;
}) {
  const wheels = useRef<(HTMLSpanElement | null)[]>([]);

  return (
    <div
      ref={ref}
      className="lock"
      role="group"
      aria-label="Кодовый замок папки"
      data-open={open || undefined}
      style={{ "--cell": `${CELL}px` } as React.CSSProperties}
    >
      {positions.map((pos, i) => (
        <Fragment key={i}>
          {i > 0 && i % 2 === 0 && (
            <span className="lock-sep" aria-hidden="true">
              /
            </span>
          )}
          <Wheel
            ref={(el) => {
              wheels.current[i] = el;
            }}
            pos={pos}
            label={`Колесо ${i + 1} из ${positions.length}`}
            disabled={open}
            onStep={(by) => onStep(i, by)}
            // Набранная с клавиатуры цифра встаёт на место, фокус уходит дальше.
            onType={(digit) => {
              onStep(i, mod(digit - pos, 10));
              wheels.current[i + 1]?.focus();
            }}
          />
        </Fragment>
      ))}
    </div>
  );
}

function Wheel({
  ref,
  pos,
  label,
  disabled,
  onStep,
  onType,
}: {
  ref: React.Ref<HTMLSpanElement>;
  pos: number;
  label: string;
  disabled: boolean;
  onStep: (by: number) => void;
  onType: (digit: number) => void;
}) {
  const grip = useRef<{ y: number; moved: boolean }>(null);
  const [dragging, setDragging] = useState(false);
  // На какую долю шага колесо утянуто пальцем.
  const [pull, setPull] = useState(0);

  function step(by: number) {
    onStep(by);
    sfx.tick(mod(pos + by, 10));
  }

  function release(tapped: boolean) {
    if (!grip.current) return;
    // Нажатие без протяжки крутит колесо на одну цифру.
    if (tapped && !grip.current.moved) step(1);
    grip.current = null;
    setDragging(false);
    setPull(0);
  }

  return (
    <span
      ref={ref}
      className="wheel"
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={9}
      aria-valuenow={mod(pos, 10)}
      aria-disabled={disabled}
      data-drag={dragging || undefined}
      onPointerDown={(event) => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        grip.current = { y: event.clientY, moved: false };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const held = grip.current;
        if (!held) return;
        let next = (held.y - event.clientY) / CELL;
        if (Math.abs(next) > 0.15) held.moved = true;
        if (Math.abs(next) >= 0.5) {
          const by = Math.sign(next);
          step(by);
          held.y -= by * CELL;
          next -= by;
        }
        setPull(next);
      }}
      onPointerUp={() => release(true)}
      onPointerCancel={() => release(false)}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          step(event.key === "ArrowUp" ? 1 : -1);
        } else if (/^\d$/.test(event.key)) {
          onType(Number(event.key));
        }
      }}
    >
      {AROUND.map((k) => (
        <span
          key={pos + k}
          aria-hidden="true"
          style={{ transform: `translateY(${(k - pull) * CELL}px)` }}
        >
          {mod(pos + k, 10)}
        </span>
      ))}
    </span>
  );
}
