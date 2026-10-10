/* Звук: эффекты синтезируются в браузере, голосовые фразы — mp3 из assets. */

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

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  vol = 0.15,
  at = 0,
  to?: number,
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
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(
  dur: number,
  vol = 0.2,
  freq = 800,
  kind: BiquadFilterType = "lowpass",
  at = 0,
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
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
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
    noise(0.18, 0.55, 1800, "bandpass");
    tone(300, 0.25, "sawtooth", 0.1, 0, 900);
    [523, 659, 784, 1047].forEach((freq, i) => {
      const dur = i === 3 ? 0.75 : 0.16;
      const at = 0.18 + i * 0.11;
      tone(freq, dur, "triangle", 0.16, at);
      tone(freq * 2, dur, "sine", 0.06, at);
    });
    for (let k = 0; k < 6; k++) {
      tone(1800 + Math.random() * 1800, 0.12, "sine", 0.04, 0.5 + k * 0.07);
    }
  },
  tick(i = 0) {
    const now = Date.now();
    if (now - lastTick < 40) return;
    lastTick = now;
    tone(700 + i * 120, 0.05, "square", 0.05);
  },
  clack() {
    noise(0.04, 0.35, 2600, "highpass");
    tone(180, 0.05, "square", 0.06);
  },
  stamp() {
    noise(0.14, 0.7, 260, "lowpass");
    tone(110, 0.28, "sine", 0.7, 0, 38);
  },
  rustle() {
    noise(0.28, 0.22, 3200, "bandpass");
    noise(0.18, 0.16, 5200, "bandpass", 0.12);
  },
  boing() {
    tone(280, 0.22, "sine", 0.18, 0, 760);
  },
  ding() {
    tone(523, 0.3, "triangle", 0.18);
    tone(659, 0.4, "triangle", 0.18, 0.12);
  },
  knock() {
    noise(0.07, 0.45, 700, "lowpass");
    tone(190, 0.1, "triangle", 0.35, 0, 90);
  },
  chime() {
    tone(784, 0.7, "sine", 0.13);
    tone(1047, 0.8, "sine", 0.11, 0.1);
    tone(1568, 0.9, "sine", 0.07, 0.2);
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
