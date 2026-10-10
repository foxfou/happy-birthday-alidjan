import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/check";
import { Stage } from "~/components/stage";
import { KNOW, STATUS } from "~/config";
import { type Guest, requireGuest } from "~/lib/guest";
import { prefersReducedMotion } from "~/lib/motion";
import { sfx } from "~/lib/sfx";

const LEAD_MS = 500;
const STEP_MS = 700;

export function clientLoader() {
  return requireGuest();
}

function checkLines({ name, know, reason, skills }: Guest) {
  const acquaintance =
    know === 0 ? KNOW[0].replace(/\.+$/, "") : KNOW[know].toLowerCase();
  return [
    `Проверка имени: «${name}»… найдено`,
    `Сверка с базой знакомых: «${acquaintance}»… принято`,
    `Мотив явки: «${reason}»… убедительно`,
    skills.length
      ? `Навыки: ${skills.join(", ").toLowerCase()}… пригодятся`
      : "Навыки: не указаны… пригодится хотя бы присутствие",
    "Проверка на скучность… не обнаружено",
  ];
}

export default function Check({ loaderData: guest }: Route.ComponentProps) {
  const lines = checkLines(guest);
  const [reduce] = useState(prefersReducedMotion);
  // Сколько строк протокола уже напечатано; lines.length + 1 — вынесен вердикт.
  const [step, setStep] = useState(reduce ? lines.length + 1 : 0);
  const done = step > lines.length;
  const openLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (done) {
      sfx.stamp();
      const chime = setTimeout(sfx.chime, 280);
      openLink.current?.focus({ preventScroll: true });
      return () => clearTimeout(chime);
    }
    if (step > 0) sfx.clack();
    const next = setTimeout(
      () => setStep(step + 1),
      step === 0 ? LEAD_MS : STEP_MS,
    );
    return () => clearTimeout(next);
  }, [step, done]);

  return (
    <Stage title="Проверка досье">
      <div
        className="bar"
        style={
          {
            "--bar-ms": `${reduce ? 0 : LEAD_MS + lines.length * STEP_MS}ms`,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        <i />
      </div>
      <div className="log" role="log">
        {lines.slice(0, step).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {done && (
        <div className="verdict">
          <span className="stamp ok pop">Допуск одобрен</span>
          <div className="status">Статус: {STATUS[guest.know]}</div>
        </div>
      )}

      {done ? (
        <Link
          ref={openLink}
          className="btn"
          to="/invitation"
          onClick={() => sfx.rustle()}
        >
          Открыть приглашение
        </Link>
      ) : (
        <button className="btn" type="button" disabled>
          Идёт проверка…
        </button>
      )}
    </Stage>
  );
}
