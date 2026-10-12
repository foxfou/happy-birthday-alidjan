import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Link, useNavigate } from "react-router";

import type { Route } from "./+types/photo";
import { Stage } from "~/components/stage";
import { requirePendingGuest, updateGuest } from "~/lib/guest";
import {
  type CropArea,
  cropToJpeg,
  loadPhoto,
  openImage,
  PHOTO,
  savePhoto,
} from "~/lib/photo";
import { sfx } from "~/lib/sfx";
import { syncPhoto } from "~/lib/sync";

/* Шаг после досье: гость прикладывает фото 3×4 для пропуска. Снимок можно перетащить
   или выбрать с устройства, затем подогнать под рамку. Без фото дальше не пускаем. */

export function clientLoader() {
  return { guest: requirePendingGuest(), photo: loadPhoto() };
}

export default function Photo({ loaderData }: Route.ComponentProps) {
  const { guest, photo: saved } = loaderData;
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  // Выбранный, но ещё не обрезанный снимок.
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (source) return () => URL.revokeObjectURL(source);
  }, [source]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.type && !file.type.startsWith("image/")) {
      setError("Это не похоже на фото. Нужен файл с изображением.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      await openImage(url);
    } catch {
      URL.revokeObjectURL(url);
      setError(
        "Не удалось открыть этот файл. Попробуйте фото в формате JPEG или PNG.",
      );
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setSource(url);
    sfx.rustle();
  }

  async function attach() {
    if (!source || !area) return;
    setBusy(true);
    try {
      if (!savePhoto(await cropToJpeg(source, area))) {
        setError(
          "Браузер не дал сохранить фото. Попробуйте другой снимок или другой браузер.",
        );
        return;
      }
      updateGuest(guest.id, { photoSent: false });
      // Загрузка идёт в фоне: проверка досье не ждёт сервер.
      void syncPhoto().catch(() => {});
      sfx.stamp();
      navigate("/check");
    } catch {
      setError("Не получилось обработать фото. Попробуйте другой снимок.");
    } finally {
      setBusy(false);
    }
  }

  const choose = () => fileInput.current?.click();

  return (
    <Stage title="Фото в досье">
      <input
        ref={fileInput}
        className="sr-only"
        id="photo-file"
        type="file"
        accept="image/*"
        // Пока идёт обрезка или фото уже приложено, выбор файла вызывают кнопки ниже.
        tabIndex={source || saved ? -1 : 0}
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {source ? (
        <>
          <p className="muted">
            Двигайте снимок и меняйте масштаб, пока лицо не окажется в рамке.
          </p>
          <div className="cropper">
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              aspect={PHOTO.aspect}
              minZoom={1}
              maxZoom={4}
              objectFit="cover"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          </div>
          <div className="field">
            <label className="lab" htmlFor="zoom">
              Масштаб
            </label>
            <input
              type="range"
              id="zoom"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </div>
          <div className="row">
            <button
              className="btn"
              type="button"
              disabled={busy || !area}
              onClick={attach}
            >
              {busy ? "Прикладываем…" : "Приложить к досье"}
            </button>
            <button className="btn ghost" type="button" onClick={choose}>
              Выбрать другое
            </button>
          </div>
        </>
      ) : saved ? (
        <>
          <p className="muted">
            Фото приложено к досье. Оно появится на вашем пропуске.
          </p>
          <img
            className="photo-frame"
            src={saved}
            alt="Ваше фото 3×4"
            width={PHOTO.width}
            height={PHOTO.height}
          />
          <div className="row">
            <Link className="btn" to="/check" onClick={() => sfx.rustle()}>
              Дальше
            </Link>
            <button className="btn ghost" type="button" onClick={choose}>
              Заменить
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            К досье прилагается фото 3×4 — оно пойдёт на ваш пропуск. Без фото
            допуск не оформляется.
          </p>
          <label
            className="dropzone"
            htmlFor="photo-file"
            data-over={dragOver || undefined}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void pick(event.dataTransfer.files[0]);
            }}
          >
            <span className="photo-frame" aria-hidden="true">
              Место для фото
            </span>
            <span>
              Перетащите снимок сюда или нажмите, чтобы выбрать с устройства
            </span>
          </label>
        </>
      )}

      <div className="err mt-2" role="alert">
        {error}
      </div>
    </Stage>
  );
}
