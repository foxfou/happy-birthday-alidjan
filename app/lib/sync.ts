import { apiEnabled, fetchGuestStatus, sendRsvp, uploadPhoto } from "./api";
import { clearGuest, loadGuest, type SeatedGuest, updateGuest } from "./guest";
import { dataUrlToBlob, loadPhoto } from "./photo";

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
      updateGuest(guest.id, { sent: true });
      return { state: "updated" };
    }
    updateGuest(guest.id, { seat: result.seat, sent: result.seat !== null });
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
  updateGuest(guest.id, { seat: status.seat, sent: status.seat !== null });
  return { state: "updated" };
}

/**
 * Загружает на сервер фото, которое пока есть только на устройстве. Вызывается в
 * фоне: гостя не задерживает, а при неудаче повторится при следующем заходе.
 */
export async function syncPhoto() {
  const guest = loadGuest();
  const photo = loadPhoto();
  if (!apiEnabled || !guest || !photo || guest.photoSent) return;
  // Сервер принимает фото только к записанной анкете — на случай, если она не дошла.
  await sendRsvp(guest);
  await uploadPhoto(guest.id, await dataUrlToBlob(photo));
  // Пока шла загрузка, гость мог заменить фото — тогда отправится новое.
  if (loadPhoto() === photo) updateGuest(guest.id, { photoSent: true });
}
