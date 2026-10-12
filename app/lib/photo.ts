/* Фото гостя 3×4: обрезка под формат пропуска и копия на устройстве. */

const KEY = "ali-bd-2610-photo";

/** Формат фото в досье: 3×4, как на документы. */
export const PHOTO = { width: 600, height: 800, aspect: 3 / 4 };

export type CropArea = { x: number; y: number; width: number; height: number };

/** Обрезанное фото как data URL; null — гость фото не прикладывал. */
export function loadPhoto() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** false — фото не поместилось в хранилище браузера. */
export function savePhoto(dataUrl: string) {
  try {
    localStorage.setItem(KEY, dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function clearPhoto() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Открывает файл как картинку; бросает ошибку, если браузер не умеет его читать. */
export async function openImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

/** Вырезает из снимка выбранную область и приводит её к 600×800 JPEG. */
export async function cropToJpeg(src: string, area: CropArea) {
  const image = await openImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO.width;
  canvas.height = PHOTO.height;
  const context = canvas.getContext("2d")!;
  // У PNG бывает прозрачный фон, а JPEG прозрачности не знает.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function dataUrlToBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob();
}
