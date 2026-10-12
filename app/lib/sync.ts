import { fetchGuestStatus, sendRsvp } from "./api";
import { clearGuest, saveGuest, type SeatedGuest } from "./guest";

export type SyncResult =
  | { state: "same" }
  /** Анкета на устройстве обновлена — её нужно перечитать. */
  | { state: "updated" }
  /** Именинник удалил анкету: приглашение начинается заново. */
  | { state: "removed" }
  /** Место, выбранное без связи с сервером, тем временем заняли. */
  | { state: "lost"; seat: number };

/**
 * Сверяет пропуск гостя с сервером: досылает место, выбранное без связи, и замечает,
 * что анкету удалили или пересадили. Бросает ошибку, если сервер недоступен.
 */
export async function syncGuest(guest: SeatedGuest): Promise<SyncResult> {
  if (!guest.sent) {
    const result = await sendRsvp(guest);
    if (result.accepted) {
      saveGuest({ ...guest, sent: true });
      return { state: "updated" };
    }
    saveGuest({ ...guest, seat: result.seat, sent: result.seat !== null });
    return result.seat === null
      ? { state: "lost", seat: guest.seat }
      : { state: "updated" };
  }

  const status = await fetchGuestStatus(guest.id);
  // undefined — сервер старой версии и про анкеты не отвечает: ничего не трогаем.
  if (status === undefined || status?.seat === guest.seat) return { state: "same" };
  if (status === null) {
    clearGuest();
    return { state: "removed" };
  }
  saveGuest({ ...guest, seat: status.seat, sent: status.seat !== null });
  return { state: "updated" };
}
