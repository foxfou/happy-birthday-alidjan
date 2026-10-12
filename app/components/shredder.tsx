import { useRef, useState } from "react";

import type { ClueProps } from "~/lib/casefile";
import { clamp } from "~/lib/num";
import { sfx } from "~/lib/sfx";

// Какая полоса лежит в каждой ячейке, пока гость ничего не трогал.
const START = [3, 0, 5, 1, 4, 2];
// Небрежность каждой полосы: [наклон в градусах, сдвиг вниз в px].
const SKEW = [
  [-1.6, 3],
  [1.2, -4],
  [-0.8, 5],
  [1.8, 2],
  [-1.3, -3],
  [0.9, 4],
];
const SORTED = START.map((_, i) => i);

const isSorted = (order: number[]) => order.every((id, slot) => id === slot);

function move(order: number[], from: number, to: number) {
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

type Drag = { id: number; from: number; startX: number; dx: number; width: number };

/**
 * Улика №2: справка, пропущенная через шредер. Полосы перетаскиваются
 * (с клавиатуры — стрелками); встав по порядку, они срастаются в лист.
 */
export function Shredder({ code, solved, onSolve }: ClueProps) {
  const board = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState(solved ? SORTED : START);
  const [drag, setDrag] = useState<Drag | null>(null);

  function drop() {
    if (!drag) return;
    setDrag(null);
    if (isSorted(order)) onSolve();
  }

  return (
    <div
      ref={board}
      className="strips"
      data-solved={solved || undefined}
      style={{ "--n": START.length } as React.CSSProperties}
    >
      {SORTED.map((id) => {
        const slot = order.indexOf(id);
        const dragging = drag?.id === id;
        return (
          <button
            key={id}
            type="button"
            className="strip"
            aria-label={`Полоса на месте ${slot + 1} из ${order.length}. Двигается стрелками.`}
            disabled={solved}
            data-drag={dragging || undefined}
            style={
              {
                "--id": id,
                "--slot": slot,
                "--tilt": `${SKEW[id][0]}deg`,
                "--drop": `${SKEW[id][1]}px`,
                // Ячейка под полосой уже сменилась — вычитаем её, чтобы полоса не ушла из-под пальца.
                "--dx": dragging
                  ? `${drag.dx - (slot - drag.from) * drag.width}px`
                  : undefined,
              } as React.CSSProperties
            }
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDrag({
                id,
                from: slot,
                startX: event.clientX,
                dx: 0,
                width: board.current!.clientWidth / order.length,
              });
            }}
            onPointerMove={(event) => {
              if (!dragging) return;
              const dx = event.clientX - drag.startX;
              const target = clamp(
                Math.round(drag.from + dx / drag.width),
                0,
                order.length - 1,
              );
              if (target !== slot) {
                setOrder(move(order, slot, target));
                sfx.tick(target);
              }
              setDrag({ ...drag, dx });
            }}
            onPointerUp={drop}
            onPointerCancel={drop}
            onKeyDown={(event) => {
              const by =
                event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
              const target = slot + by;
              if (!by || target < 0 || target >= order.length) return;
              event.preventDefault();
              const next = move(order, slot, target);
              setOrder(next);
              sfx.tick(target);
              if (isSorted(next)) onSolve();
            }}
          >
            <span className="strip-page" aria-hidden="true">
              <span className="strip-head">Справка № 2</span>
              Операция «Торт». Вторая часть кода от папки:
              <strong>{code}</strong>
              <span className="strip-sign">Выдал: Али</span>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0,90 C18,84 30,64 48,58 S78,34 100,12" />
              </svg>
              <span className="stamp">Изъято</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
