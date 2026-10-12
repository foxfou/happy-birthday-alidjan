import { useEffect, useRef, useState } from "react";

import type { ClueProps } from "~/lib/casefile";
import { mod } from "~/lib/num";
import { sfx } from "~/lib/sfx";

// Без «Ё»: 32 буквы делят круг ровно, а сдвиг на число меньше 32 читается как есть.
const ALPHABET = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
const STEP = 360 / ALPHABET.length;
const PLAIN = "ОТЛИЧНО, СЫЩИК. ЧИСЛО В ЦЕНТРЕ ДИСКА — ТРЕТЬЯ ЧАСТЬ КОДА.";
// Сколько диск должен простоять на верном сдвиге, чтобы улика засчиталась.
const REST_MS = 550;
const CENTER = 120;

function shiftText(text: string, by: number) {
  return text.replace(
    /[А-Я]/g,
    (letter) => ALPHABET[mod(ALPHABET.indexOf(letter) + by, ALPHABET.length)],
  );
}

function Ring({ radius }: { radius: number }) {
  return [...ALPHABET].map((letter, i) => (
    <text
      key={letter}
      x={CENTER}
      y={CENTER - radius}
      transform={`rotate(${i * STEP} ${CENTER} ${CENTER})`}
    >
      {letter}
    </text>
  ));
}

/**
 * Улика №3: шифр Цезаря. Внешнее кольцо диска — буквы шифровки, внутреннее —
 * настоящие; сдвиг, при котором текст читается, и есть искомое число.
 */
export function CipherDisk({ code, solved, onSolve }: ClueProps) {
  const key = Number(code) % ALPHABET.length;
  // Поворот внутреннего кольца в градусах: копится без сброса на полном круге.
  const [turn, setTurn] = useState(solved ? key * STEP : 0);
  const [dragging, setDragging] = useState(false);
  const live = useRef(turn);
  const grip = useRef({ x: 0, y: 0, angle: 0 });
  const shift = mod(Math.round(turn / STEP), ALPHABET.length);

  useEffect(() => {
    if (solved || dragging || shift !== key) return;
    const rest = setTimeout(onSolve, REST_MS);
    return () => clearTimeout(rest);
  }, [solved, dragging, shift, key, onSolve]);

  function rotateTo(next: number) {
    if (Math.round(next / STEP) !== Math.round(live.current / STEP)) sfx.tick(1);
    live.current = next;
    setTurn(next);
  }

  const angleAt = (event: React.PointerEvent) =>
    (Math.atan2(event.clientY - grip.current.y, event.clientX - grip.current.x) *
      180) /
    Math.PI;

  function release() {
    if (!dragging) return;
    setDragging(false);
    rotateTo(Math.round(live.current / STEP) * STEP);
  }

  return (
    <>
      <p className="cipher" data-solved={solved || undefined}>
        {shiftText(PLAIN, key - shift)}
      </p>
      <div className="disk-row">
        <button
          className="disk-step"
          type="button"
          aria-label="Сдвиг меньше"
          disabled={solved}
          onClick={() => rotateTo(live.current - STEP)}
        >
          −
        </button>
        <svg
          className="disk"
          viewBox="0 0 240 240"
          role="slider"
          tabIndex={solved ? -1 : 0}
          aria-label="Шифровальный диск: сдвиг"
          aria-valuemin={0}
          aria-valuemax={ALPHABET.length - 1}
          aria-valuenow={shift}
          aria-disabled={solved}
          data-drag={dragging || undefined}
          data-solved={solved || undefined}
          onPointerDown={(event) => {
            if (solved) return;
            const rect = event.currentTarget.getBoundingClientRect();
            grip.current.x = rect.left + rect.width / 2;
            grip.current.y = rect.top + rect.height / 2;
            grip.current.angle = angleAt(event);
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!dragging) return;
            const angle = angleAt(event);
            // Кратчайшая дуга: без неё переход через ±180° крутил бы диск назад.
            const delta = mod(angle - grip.current.angle + 180, 360) - 180;
            grip.current.angle = angle;
            rotateTo(live.current + delta);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(event) => {
            if (solved) return;
            const by =
              event.key === "ArrowRight" || event.key === "ArrowUp"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowDown"
                  ? -1
                  : 0;
            if (!by) return;
            event.preventDefault();
            rotateTo(live.current + by * STEP);
          }}
        >
          <circle className="disk-outer" cx={CENTER} cy={CENTER} r="117" />
          <Ring radius={102} />
          <g className="disk-inner" style={{ transform: `rotate(${turn}deg)` }}>
            <circle cx={CENTER} cy={CENTER} r="87" />
            <Ring radius={72} />
          </g>
          <circle className="disk-hub" cx={CENTER} cy={CENTER} r="54" />
          <text className="disk-cap" x={CENTER} y="98">
            сдвиг
          </text>
          <text className="disk-num" x={CENTER} y="130">
            {String(shift).padStart(2, "0")}
          </text>
        </svg>
        <button
          className="disk-step"
          type="button"
          aria-label="Сдвиг больше"
          disabled={solved}
          onClick={() => rotateTo(live.current + STEP)}
        >
          +
        </button>
      </div>
    </>
  );
}
