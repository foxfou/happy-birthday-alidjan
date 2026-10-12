/* Звук: эффекты синтезируются в браузере, голосовые фразы — mp3 из assets.
   Эффекты нарочно мягкие: синус и треугольник вместо меандра и пилы, шум только
   приглушённый, атака без щелчка — резкие «пиксельные» звуки режут слух. */

const MUTE_KEY = "ali-bd-2610-mute";

const voiceUrls = Object.values(
  import.meta.glob<string>("../assets/voices/*.mp3", {
    eager: true,
    query: "?url",
    import: "default",
  }),
);

let ctx: AudioContext | null = null;
let unlocked = false;
let muted = false;
const muteListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {}
  // Браузеры разрешают звук только после жеста пользователя.
  for (const type of ["pointerdown", "keydown"]) {
    window.addEventListener(
      type,
      () => {
        unlocked = true;
        audio();
        decodeVoices();
      },
      { passive: true },
    );
  }
}

function audio() {
  if (!unlocked) return null;
  try {
    ctx ??= new AudioContext();
  } catch {
    return null;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

let soft: BiquadFilterNode | null = null;

/** Общий выход эффектов: фильтр срезает верх, который делает звук колючим. */
function output(c: AudioContext) {
  if (!soft) {
    soft = c.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 5000;
    soft.connect(c.destination);
  }
  return soft;
}

function tone(
  freq: number,
  dur: number,
  vol = 0.1,
  at = 0,
  to?: number,
  type: OscillatorType = "sine",
) {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(output(c));
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(
  dur: number,
  vol = 0.1,
  freq = 800,
  kind: BiquadFilterType = "lowpass",
  at = 0,
  attack = 0.004,
) {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime + at;
  const length = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = kind;
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(output(c));
  src.start(t);
}

const voices: (AudioBuffer | undefined)[] = [];
let decoding = false;

function decodeVoices() {
  const c = audio();
  if (decoding || !c) return;
  decoding = true;
  voiceUrls.forEach(async (url, i) => {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      voices[i] = await c.decodeAudioData(data);
    } catch {
      // фраза просто не прозвучит
    }
  });
}

let bag: number[] = [];
let lastVoice = -1;

/** Фразы идут в случайном порядке без повторов, пока не кончится «мешок». */
function nextVoice() {
  bag = bag.filter((i) => voices[i]);
  if (!bag.length) {
    bag = voices.flatMap((buffer, i) => (buffer ? [i] : []));
    for (let k = bag.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [bag[k], bag[r]] = [bag[r], bag[k]];
    }
    const end = bag.length - 1;
    if (end > 0 && bag[end] === lastVoice) [bag[0], bag[end]] = [bag[end], bag[0]];
  }
  lastVoice = bag.pop() ?? -1;
  return voices[lastVoice];
}

let lastTick = 0;
// Щелчки ходят по пентатонике от ре первой октавы: любые соседние ноты созвучны.
const TICK_BASE = 294;
const PENTATONIC = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];

export const sfx = {
  /** Проигрывает голосовую фразу; false — если звука нет и нужна замена. */
  voice(onEnd?: () => void) {
    const c = audio();
    if (!c || muted) return false;
    const buffer = nextVoice();
    if (!buffer) return false;
    const src = c.createBufferSource();
    src.buffer = buffer;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onEnd?.();
    };
    src.onended = finish;
    setTimeout(finish, buffer.duration * 1000 + 600);
    src.connect(c.destination);
    src.start();
    return true;
  },
  party() {
    noise(0.14, 0.2, 1100);
    tone(330, 0.3, 0.06, 0, 660);
    [523, 659, 784, 1047].forEach((freq, i) => {
      const dur = i === 3 ? 0.9 : 0.22;
      const at = 0.18 + i * 0.11;
      tone(freq, dur, 0.13, at, undefined, "triangle");
      tone(freq * 2, dur, 0.03, at);
    });
    for (let k = 0; k < 6; k++) {
      tone(1200 + Math.random() * 1000, 0.18, 0.025, 0.5 + k * 0.07);
    }
  },
  tick(i = 0) {
    const now = Date.now();
    if (now - lastTick < 40) return;
    lastTick = now;
    tone(TICK_BASE * PENTATONIC[i % 5] * 2 ** Math.floor(i / 5), 0.09, 0.09);
  },
  clack() {
    noise(0.05, 0.2, 900);
    tone(196, 0.07, 0.14, 0, 147, "triangle");
  },
  stamp() {
    noise(0.16, 0.22, 420);
    tone(150, 0.3, 0.38, 0, 55, "triangle");
  },
  rustle() {
    noise(0.26, 0.2, 1300, "bandpass", 0, 0.05);
    noise(0.2, 0.14, 2100, "bandpass", 0.1, 0.05);
  },
  boing() {
    tone(260, 0.24, 0.12, 0, 520);
  },
  ding() {
    tone(523, 0.45, 0.12);
    tone(659, 0.6, 0.12, 0.12);
  },
  knock() {
    noise(0.06, 0.14, 520);
    tone(180, 0.12, 0.26, 0, 110, "triangle");
  },
  latch() {
    noise(0.04, 0.14, 1400);
    tone(392, 0.07, 0.16, 0, 294, "triangle");
    noise(0.05, 0.12, 1000, "lowpass", 0.1);
    tone(294, 0.1, 0.16, 0.1, 196, "triangle");
  },
  chime() {
    tone(659, 0.8, 0.1);
    tone(784, 0.9, 0.09, 0.1);
    tone(1047, 1.1, 0.07, 0.2);
  },
};

/** Хранилище «звук выключен» для useSyncExternalStore. */
export const mute = {
  subscribe(listener: () => void) {
    muteListeners.add(listener);
    return () => void muteListeners.delete(listener);
  },
  get: () => muted,
  toggle() {
    muted = !muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {}
    muteListeners.forEach((listener) => listener());
  },
};
