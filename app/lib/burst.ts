const EMOJI = ["🎂", "🍰", "🧁", "🎉", "🎈", "🍭"];
const COLORS = ["#d94f4f", "#e6b422", "#3f8f5f", "#3a6fc4", "#c25aa8", "#f08a3c"];
const TOTAL = 60;
const EMOJI_COUNT = 16;
const GRAVITY = 1500;
const FRAMES = 28;

/** Салют из конфетти и сладостей, вылетающий из центра элемента. */
export function burst(origin: Element) {
  const rect = origin.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const layer = document.createElement("div");
  layer.className = "fx";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  let finished = 0;
  for (let i = 0; i < TOTAL; i++) {
    const el = document.createElement("span");
    const isEmoji = i < EMOJI_COUNT;
    if (isEmoji) {
      el.className = "emo";
      el.textContent = EMOJI[i % EMOJI.length];
    } else {
      el.className = "conf";
      el.style.background = COLORS[i % COLORS.length];
    }
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    layer.appendChild(el);

    const angle = ((-90 + (Math.random() * 140 - 70)) * Math.PI) / 180;
    const speed = isEmoji ? 700 + Math.random() * 500 : 600 + Math.random() * 800;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const spin = (Math.random() * 2 - 1) * 540;
    const duration = 1500 + Math.random() * 700;
    const seconds = duration / 1000;

    const frames: Keyframe[] = [];
    for (let f = 0; f <= FRAMES; f++) {
      const u = f / FRAMES;
      const t = u * seconds;
      const x = vx * t * 0.45;
      const y = vy * t + 0.5 * GRAVITY * t * t;
      const scale = 0.4 + Math.min(1, u * 6) * 0.6;
      frames.push({
        transform: `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(spin * u).toFixed(0)}deg) scale(${scale.toFixed(2)})`,
        opacity: u > 0.75 ? Number((1 - (u - 0.75) / 0.25).toFixed(2)) : 1,
        offset: u,
      });
    }
    el.animate(frames, { duration, easing: "linear", fill: "forwards" }).onfinish =
      () => {
        if (++finished === TOTAL) layer.remove();
      };
  }
  setTimeout(() => layer.remove(), 2800);
}
