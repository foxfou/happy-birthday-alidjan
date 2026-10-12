import { useEffect, useRef, useState } from "react";
import { Form, redirect, useSubmit } from "react-router";

import type { Route } from "./+types/dossier";
import { Stage } from "~/components/stage";
import { KNOW, MAX_SKILLS, REASONS, SKILLS } from "~/config";
import { apiEnabled, sendRsvp } from "~/lib/api";
import { burst } from "~/lib/burst";
import { loadCase } from "~/lib/casefile";
import { loadGuest, saveGuest } from "~/lib/guest";
import { prefersReducedMotion } from "~/lib/motion";
import { sfx } from "~/lib/sfx";

const NAME_ERROR =
  "Впишите имя или позывной, иначе комиссия не сможет вас найти.";
const MAX_DODGES = 5;
/** Отметка «свой вариант» в состоянии формы; сам текст хранится рядом. */
const OWN = "own";
// Сервер (backend/rsvp.js) принимает причину до 80 знаков и навык до 40.
const MAX_REASON_LENGTH = 60;
const MAX_SKILL_LENGTH = 40;

/** Вписанный от руки ответ — тот, которого нет среди готовых. */
function ownAnswer(options: string[], answers: string[]) {
  return answers.find((answer) => !options.includes(answer)) ?? "";
}

export function clientLoader() {
  const guest = loadGuest();
  // Место выбрано — дело закрыто, досье больше не правится.
  if (guest?.seat) throw redirect("/pass");
  // Бланк досье заперт в папке: сначала гость вскрывает её по уликам.
  if (!guest && !loadCase().open) throw redirect("/evidence");
  return guest;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: NAME_ERROR };

  const know = Number(form.get("know"));
  // «Свой вариант» приходит вписанным текстом; пустой за ответ не считается.
  const reason = String(form.get("reason") ?? "")
    .trim()
    .slice(0, MAX_REASON_LENGTH);
  const skills = form
    .getAll("skill")
    .map((skill) => String(skill).trim().slice(0, MAX_SKILL_LENGTH))
    .filter(Boolean);
  const previous = loadGuest();
  const guest = {
    id: previous?.id ?? crypto.randomUUID(),
    name,
    know: KNOW[know] ? know : 2,
    reason: reason || REASONS[0],
    skills: [...new Set(skills)].slice(0, MAX_SKILLS),
    seat: null,
    sent: false,
    photoSent: previous?.photoSent,
  };
  saveGuest(guest);
  // Анкета попадает в список именинника сразу, не дожидаясь выбора места. Ответа
  // не ждём: если сервер недоступен, данные дойдут вместе с местом или сообщением от гостя.
  if (apiEnabled) void sendRsvp(guest).catch(() => {});
  return redirect("/photo");
}

export default function Dossier({
  loaderData: guest,
  actionData,
}: Route.ComponentProps) {
  const submit = useSubmit();
  const form = useRef<HTMLFormElement>(null);
  const yes = useRef<HTMLButtonElement>(null);
  const partyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [know, setKnow] = useState(guest?.know ?? 2);
  const [ownReason, setOwnReason] = useState(
    ownAnswer(REASONS, guest ? [guest.reason] : []),
  );
  const [ownSkill, setOwnSkill] = useState(
    ownAnswer(SKILLS, guest?.skills ?? []),
  );
  const [reason, setReason] = useState(
    ownReason ? OWN : (guest?.reason ?? REASONS[0]),
  );
  const [skills, setSkills] = useState(
    (guest?.skills ?? []).map((skill) => (skill === ownSkill ? OWN : skill)),
  );
  const [nameMissing, setNameMissing] = useState(false);
  const error = nameMissing ? NAME_ERROR : actionData?.error;

  useEffect(() => () => clearTimeout(partyTimer.current), []);

  /** «Приду»: салют, фанфары — и только потом досье уходит на проверку. */
  function accept(origin: HTMLElement) {
    const name = form.current!.elements.namedItem("name") as HTMLInputElement;
    if (!name.value.trim()) {
      setNameMissing(true);
      name.focus();
      return;
    }
    if (partyTimer.current) return;
    setNameMissing(false);
    sfx.party();
    const reduce = prefersReducedMotion();
    if (!reduce) burst(origin);
    partyTimer.current = setTimeout(
      () => {
        partyTimer.current = undefined;
        submit(form.current);
      },
      reduce ? 500 : 1500,
    );
  }

  function pickReason(value: string) {
    setReason(value);
    sfx.tick(1);
  }

  function toggleSkill(skill: string, checked: boolean) {
    setSkills((list) =>
      checked ? [...list, skill] : list.filter((item) => item !== skill),
    );
    sfx.tick(3);
  }

  return (
    <Stage title="Досье гостя">
      <p className="muted">Отвечайте честно. Комиссия сверит ответы с базой.</p>

      <Form
        ref={form}
        method="post"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          accept(yes.current!);
        }}
      >
        <div className="field">
          <label className="lab" htmlFor="name">
            Имя или позывной
          </label>
          <input
            type="text"
            id="name"
            name="name"
            maxLength={28}
            autoComplete="given-name"
            placeholder="Как вас записать?"
            defaultValue={guest?.name}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby="name-error"
            onInput={() => setNameMissing(false)}
          />
        </div>

        <div className="field">
          <label className="lab" htmlFor="know">
            Степень знакомства с именинником
          </label>
          <input
            type="range"
            id="know"
            name="know"
            min={0}
            max={KNOW.length - 1}
            step={1}
            value={know}
            aria-valuetext={KNOW[know]}
            onChange={(event) => {
              const value = Number(event.target.value);
              setKnow(value);
              sfx.tick(value);
            }}
          />
          <output className="range-out" htmlFor="know">
            {KNOW[know]}
          </output>
        </div>

        <fieldset className="field">
          <legend className="lab">Главная причина прийти</legend>
          <div className="opts">
            {REASONS.map((option) => (
              <label className="opt" key={option}>
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => pickReason(option)}
                />
                <span>{option}</span>
              </label>
            ))}
            <OwnOption
              type="radio"
              name="reason"
              maxLength={MAX_REASON_LENGTH}
              text={ownReason}
              checked={reason === OWN}
              onText={setOwnReason}
              onToggle={() => pickReason(OWN)}
            />
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="lab">
            Навыки, полезные на празднике (до трёх)
          </legend>
          <div className="opts">
            {SKILLS.map((skill) => {
              const checked = skills.includes(skill);
              return (
                <label className="opt" key={skill}>
                  <input
                    type="checkbox"
                    name="skill"
                    value={skill}
                    checked={checked}
                    disabled={!checked && skills.length >= MAX_SKILLS}
                    onChange={(event) =>
                      toggleSkill(skill, event.target.checked)
                    }
                  />
                  <span>{skill}</span>
                </label>
              );
            })}
            <OwnOption
              type="checkbox"
              name="skill"
              maxLength={MAX_SKILL_LENGTH}
              text={ownSkill}
              checked={skills.includes(OWN)}
              disabled={!skills.includes(OWN) && skills.length >= MAX_SKILLS}
              onText={setOwnSkill}
              onToggle={(checked) => toggleSkill(OWN, checked)}
            />
          </div>
        </fieldset>

        {/* Итог страницы: всё выше — анкета, здесь гость выносит решение. */}
        <fieldset className="resolution">
          <legend>Решение гостя</legend>
          <p className="muted">Досье заполнено. Осталось вынести решение.</p>
          <div className="decision">
            <button ref={yes} className="btn yes" type="submit">
              Приду
            </button>
            <DodgyNo onGiveUp={accept} />
          </div>
          <div className="err" id="name-error" role="alert">
            {error}
          </div>
        </fieldset>
      </Form>
    </Stage>
  );
}

/**
 * Строка «свой вариант»: отметка и поле для текста. Вписанный текст служит
 * значением отметки и уходит в форму наравне с готовыми вариантами.
 */
function OwnOption({
  type,
  name,
  maxLength,
  text,
  checked,
  disabled,
  onText,
  onToggle,
}: {
  type: "radio" | "checkbox";
  name: string;
  maxLength: number;
  text: string;
  checked: boolean;
  disabled?: boolean;
  onText: (text: string) => void;
  onToggle: (checked: boolean) => void;
}) {
  const field = useRef<HTMLInputElement>(null);

  return (
    <div className="opt own">
      <input
        type={type}
        name={name}
        value={text.trim()}
        checked={checked}
        disabled={disabled}
        aria-label="Свой вариант"
        onChange={(event) => {
          onToggle(event.target.checked);
          if (event.target.checked) field.current!.focus();
        }}
      />
      <span>
        <input
          ref={field}
          type="text"
          value={text}
          maxLength={maxLength}
          disabled={disabled}
          placeholder="Свой вариант"
          aria-label="Свой вариант: текст"
          enterKeyHint="done"
          // С клавиатуры в поле попадают через отметку: иначе Tab мимо него
          // менял бы ответ.
          tabIndex={checked ? 0 : -1}
          onFocus={() => {
            if (!checked) onToggle(true);
          }}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={(event) => {
            // Enter здесь значит «дописал», а не «Приду».
            if (event.key !== "Enter") return;
            event.preventDefault();
            event.currentTarget.blur();
          }}
        />
      </span>
    </div>
  );
}

/**
 * «Не приду» убегает от курсора и пальца, отвечая голосом. На пятой попытке
 * сдаётся, превращается в «Ладно, приду» и срабатывает как согласие.
 */
function DodgyNo({ onGiveUp }: { onGiveUp: (origin: HTMLElement) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const lastDodge = useRef(0);
  const [dodges, setDodges] = useState(0);
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const gaveUp = dodges >= MAX_DODGES;

  function dodge() {
    if (gaveUp || busy) return;
    lastDodge.current = Date.now();
    setDodges(dodges + 1);

    if (dodges + 1 >= MAX_DODGES) {
      sfx.ding();
      setOffset({ x: 0, y: 0 });
      return;
    }
    // Пока звучит фраза, кнопка стоит на месте и не реагирует.
    if (sfx.voice(() => setBusy(false))) setBusy(true);
    else sfx.boing();

    const el = button.current!;
    const maxX = Math.max(0, el.parentElement!.clientWidth - el.offsetWidth);
    setOffset({
      x: Math.round(Math.random() * maxX - el.offsetLeft),
      y: Math.round(Math.random() * 70 - 20),
    });
  }

  return (
    <button
      ref={button}
      type="button"
      className={`btn dodgy ${gaveUp ? "yes" : "ghost"}`}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      aria-disabled={busy}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") dodge();
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") dodge();
      }}
      onClick={(event) => {
        if (busy || Date.now() - lastDodge.current < 400) return;
        if (gaveUp) onGiveUp(event.currentTarget);
        else dodge();
      }}
    >
      {gaveUp ? "Ладно, приду" : "Не приду"}
    </button>
  );
}
