import { useEffect, useRef, useState } from "react";
import { Link, redirect } from "react-router";

import type { Route } from "./+types/evidence";
import { CipherDisk } from "~/components/cipher-disk";
import { CodeLock } from "~/components/code-lock";
import { Shredder } from "~/components/shredder";
import { Stage } from "~/components/stage";
import { UvNote } from "~/components/uv-note";
import { EVENT } from "~/config";
import { CODE, loadCase, saveCase } from "~/lib/casefile";
import { loadGuest } from "~/lib/guest";
import { prefersReducedMotion } from "~/lib/motion";
import { mod } from "~/lib/num";
import { sfx } from "~/lib/sfx";

/* Шаг перед досье: бланк заперт в папке, код от замка спрятан в трёх уликах.
   Код — номер дела с ярлыка папки: внимательный гость вскроет замок и без улик,
   а застрявшему его в три подсказки наберёт следователь. */

const EVIDENCE = [
  {
    name: "Чистый лист",
    ordinal: "первое",
    lead: "Лист выглядит пустым, но к нему приложена УФ-лампа. Ведите её по бумаге — курсором или пальцем.",
    Clue: UvNote,
  },
  {
    name: "Из шредера",
    ordinal: "второе",
    lead: "Справку пустили через шредер. Перетаскивайте полосы, пока лист не сойдётся.",
    Clue: Shredder,
  },
  {
    name: "Шифровка",
    ordinal: "третье",
    lead: "Перехваченное сообщение. Крутите внутреннее кольцо диска, пока текст не начнёт читаться.",
    Clue: CipherDisk,
  },
];

const DIGITS = [...CODE.join("")].map(Number);

const HINTS = [
  "Каждая улика прячет одно двузначное число. Порядок чисел — порядок улик.",
  "Эти числа вы уже видели. Присмотритесь к ярлыку папки.",
  `Ладно, набираю сам: ${CODE.join(" · ")}. Это номер дела — и дата, когда вас ждут.`,
];

const MISSES = [
  "Замок не поддался. Улики знают больше.",
  "Мимо. Замок даже не дрогнул.",
  "Снова не тот код. Следователь рядом и готов подсказать.",
];

const SHAKE = [0, -8, 7, -5, 3, 0].map((x) => ({
  transform: `translateX(${x}px)`,
}));
const NEXT_CLUE_MS = 1400;
const DIAL_MS = 70;

export function clientLoader() {
  const guest = loadGuest();
  if (guest?.seat) throw redirect("/pass");
  const file = loadCase();
  // Замок уже вскрыт (или досье начато ещё до появления замка) — улики не нужны.
  if (guest || file.open) throw redirect("/dossier");
  return file;
}

export default function Evidence({ loaderData }: Route.ComponentProps) {
  const lock = useRef<HTMLDivElement>(null);
  const blankLink = useRef<HTMLAnchorElement>(null);
  const nextClue = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dialer = useRef<ReturnType<typeof setInterval>>(undefined);
  const [found, setFound] = useState(loaderData.found);
  const [active, setActive] = useState(() =>
    Math.max(0, EVIDENCE.findIndex((_, i) => !loaderData.found.includes(i))),
  );
  const [positions, setPositions] = useState(() => DIGITS.map(() => 0));
  const [misses, setMisses] = useState(0);
  const [error, setError] = useState("");
  const [hints, setHints] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(
    () => () => {
      clearTimeout(nextClue.current);
      clearInterval(dialer.current);
    },
    [],
  );

  useEffect(() => {
    if (open) blankLink.current?.focus();
  }, [open]);

  function solve(index: number) {
    const all = [...found, index];
    setFound(all);
    saveCase({ found: all, open: false });
    sfx.ding();
    // Даём рассмотреть находку, затем сами открываем следующую улику или ведём к замку.
    const next = EVIDENCE.findIndex((_, i) => !all.includes(i));
    nextClue.current = setTimeout(() => {
      if (next >= 0) {
        setActive((current) => (current === index ? next : current));
      } else {
        lock.current?.scrollIntoView({
          block: "center",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }
    }, NEXT_CLUE_MS);
  }

  function tryOpen() {
    if (positions.some((pos, i) => mod(pos, 10) !== DIGITS[i])) {
      setError(MISSES[Math.min(misses, MISSES.length - 1)]);
      setMisses(misses + 1);
      sfx.knock();
      if (!prefersReducedMotion()) lock.current?.animate(SHAKE, 380);
      return;
    }
    clearInterval(dialer.current);
    setError("");
    setOpen(true);
    saveCase({ found, open: true });
    sfx.latch();
    setTimeout(sfx.stamp, 240);
    setTimeout(sfx.chime, 520);
  }

  function askHint() {
    const level = hints + 1;
    setHints(level);
    sfx.tick(2);
    if (level < HINTS.length) return;

    // Последняя подсказка: следователь сам докручивает колёса до кода.
    let turns = Math.max(
      ...positions.map((pos, i) => mod(DIGITS[i] - pos, 10)),
    );
    clearInterval(dialer.current);
    dialer.current = setInterval(() => {
      if (turns-- <= 0) return clearInterval(dialer.current);
      sfx.tick(turns);
      setPositions((list) =>
        list.map((pos, i) => (mod(pos, 10) === DIGITS[i] ? pos : pos + 1)),
      );
    }, DIAL_MS);
  }

  const { name, lead, ordinal, Clue } = EVIDENCE[active];
  const solved = found.includes(active);
  const verdict =
    hints >= HINTS.length
      ? "Вскрыто с помощью следователя. В протокол это не попадёт."
      : found.length < EVIDENCE.length
        ? "Вскрыто без улик: вы просто прочитали ярлык папки. Таких берём в следователи."
        : `Код сошёлся с номером дела. ${EVENT.date} — в этот день вас и ждут.`;

  return (
    <Stage title="Папка опечатана">
      <p className="muted">
        Бланк досье лежит внутри, под кодовым замком. Код никто не записал, но
        в деле остались три улики — каждая прячет одно число.
      </p>

      <div className="clues">
        {EVIDENCE.map((clue, i) => (
          <button
            key={clue.name}
            className="clue-tab"
            type="button"
            aria-pressed={active === i}
            data-found={found.includes(i) || undefined}
            onClick={() => {
              clearTimeout(nextClue.current);
              setActive(i);
              sfx.rustle();
            }}
          >
            Улика №{i + 1}
            <b>{found.includes(i) ? CODE[i] : "??"}</b>
          </button>
        ))}
      </div>

      <div className="clue" key={active}>
        <h3>
          Улика №{active + 1}. {name}
        </h3>
        <p className="hint">{lead}</p>
        <Clue
          code={CODE[active]}
          solved={solved}
          onSolve={() => solve(active)}
        />
        <p className="clue-result" role="status">
          {solved && `Установлено: ${ordinal} число — ${CODE[active]}.`}
        </p>
      </div>

      <fieldset className="resolution">
        <legend>Замок папки</legend>
        <p className="muted">
          {found.length < EVIDENCE.length
            ? "Шесть колёс, по два на число. Крутите их или просто нажимайте."
            : "Все числа установлены. Наберите их в порядке улик."}
        </p>
        <CodeLock
          ref={lock}
          positions={positions}
          open={open}
          onStep={(wheel, by) => {
            setError("");
            setPositions(
              positions.map((pos, i) => (i === wheel ? pos + by : pos)),
            );
          }}
        />

        {open && (
          <div className="verdict">
            <span className="stamp ok pop">Вскрыто</span>
            <div className="status">{verdict}</div>
          </div>
        )}

        {open ? (
          <Link
            ref={blankLink}
            className="btn"
            to="/dossier"
            onClick={() => sfx.rustle()}
          >
            Достать бланк досье
          </Link>
        ) : (
          <button className="btn" type="button" onClick={tryOpen}>
            Вскрыть папку
          </button>
        )}
        <div className="err" role="alert">
          {error}
        </div>

        {hints > 0 && (
          <p className="note" role="status">
            {HINTS[hints - 1]}
          </p>
        )}
        {!open && hints < HINTS.length && (
          <button className="link-reset" type="button" onClick={askHint}>
            {hints ? "Ещё подсказку" : "Спросить следователя"}
          </button>
        )}
      </fieldset>
    </Stage>
  );
}
