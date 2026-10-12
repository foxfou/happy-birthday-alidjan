import { EVENT } from "~/config";

/* Папка с бланком досье опечатана: код от замка гость собирает по уликам. */

/** Код замка — номер дела, он же дата встречи: по два знака на улику. */
export const CODE = EVENT.caseNo.split("/");

/** Что получает каждая улика: своё число и способ сообщить, что оно добыто. */
export type ClueProps = {
  code: string;
  solved: boolean;
  onSolve: () => void;
};

export type CaseFile = {
  /** Номера улик, из которых гость уже добыл число. */
  found: number[];
  /** Замок открыт — бланк досье доступен. */
  open: boolean;
};

// «-2»: раньше удаление анкеты не сбрасывало замок, и на устройствах остались
// отметки «вскрыто» без анкеты. Под новым ключом они больше не действуют.
const KEY = "ali-bd-2610-case-2";

export function loadCase(): CaseFile {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (stored) return { found: stored.found ?? [], open: Boolean(stored.open) };
  } catch {}
  return { found: [], open: false };
}

export function saveCase(file: CaseFile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(file));
  } catch {}
}

/** Папка снова опечатана: улики придётся разгадать заново. */
export function clearCase() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
