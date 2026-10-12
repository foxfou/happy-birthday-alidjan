/** Остаток, который не уходит в минус: mod(-1, 10) === 9. */
export const mod = (value: number, size: number) =>
  ((value % size) + size) % size;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
