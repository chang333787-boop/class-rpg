// 비트 만들기 소리 — 북 여덟 줄 × 소리 묶음 셋(전자 북 · 진짜 북 · 우리 장단) + 베이스 · 화음 · 믹서 [MUSIC-BEAT-1]
//  소리 파일 0개 — Web Audio 로 합성한다. 공용 엔진(audio.js)의 소리 장치(engine.ctx) · 출구(engine.bus() = 마른 소리 + 울림)를 쓰고 audio.js 는 고치지 않는다.
//  · 북 소리는 처음 한 번 OfflineAudioContext 로 미리 '구워' 둔다(소리 묶음마다 여덟 개 · 대개 1초 안 · 크롬북에서 수십 ms).
//    칠 때는 버퍼 하나 + 세기(Gain) 하나 — 노드가 적어 가볍고, 예약한 시각에 정확히 울린다. 굽기 전(아주 잠깐)은 같은 재료로 바로 합성한다.
//  · 베이스 · 화음은 길이가 늘 달라 칠 때 만든다(음마다 노드 몇 개 · 다 울리면 멈추고 끊는다).
//  · 소리 길: 줄마다 Gain(소리 크기 · 음소거 · 혼자 듣기) → 좌우(StereoPanner) → 비트 버스(master) → engine.bus()
//  · 우리 장단의 장구(덩 · 덕 · 쿵 · 기 · 더러러러)는 audio.js drum('deong' · 'deok' · 'kung' · 'gi' · 'roll')과 같은 재료(주파수 · 길이 · 세기)로 만든다
//    — 작곡 화면의 장단 반주와 같은 장구 소리. 꽹과리(쨍 · 손으로 막아 짧게) · 징(낮게 웅 · 맥놀이 · 3초 넘게) · 북(둥)은 새로 만들었다.
//  · [MUSIC-BEAT-MEL-1] 가락 악기 — 신스 · 대금은 여기서 만들고, 실로폰 · 피아노 · 플루트 · 글로켄 · 가야금은 공용 엔진의 note(audio.js 는 안 고침)로 낸다.
import { MIX, VOL_DEF, ROWS } from './beatcore.js';

const SOFT = (() => { const n = 2048, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; a[i] = Math.tanh(2.4 * x) / Math.tanh(2.4); } return a; })();
const freqOf = p => 440 * Math.pow(2, (p - 69) / 12);
function osc(c, type, f, t) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; }
function amp(c, v) { const g = c.createGain(); g.gain.value = v; return g; }
function bq(c, type, f, q = 0.7) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function shaper(c) { const w = c.createWaveShaper(); w.curve = SOFT; return w; }
//  잡음 한 줄기 — 필터(type · f · q)를 지나 세기 v 로 시작해 len 초 동안 줄어듦(att = 살짝 늦게 커지기)
function hiss(c, o, t, v, N, type, f, q, len, att = 0.001) {
  const s = c.createBufferSource(), fl = bq(c, type, f, q), g = c.createGain();
  s.buffer = N; s.loop = true;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + len);
  s.connect(fl).connect(g).connect(o); s.start(t); s.stop(t + att + len + 0.02);
}
//  떨어지는 음(쿵 · 통 · 북) — f0 → f1(drop 초) · len 초 · shape = 살짝 찌그러뜨려 작은 스피커에서도 들리게
function thump(c, o, t, v, f0, f1, drop, len, shape = false) {
  const s = osc(c, 'sine', f0, t), g = c.createGain();
  s.frequency.exponentialRampToValueAtTime(f1, t + drop);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  if (shape) s.connect(g).connect(shaper(c)).connect(o); else s.connect(g).connect(o);
  s.start(t); s.stop(t + len + 0.02);
}
function tone(c, o, t, v, f, len, type = 'triangle') { const s = osc(c, type, f, t), g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len); s.connect(g).connect(o); s.start(t); s.stop(t + len + 0.02); }
//  쇠붙이(하이햇 · 심벌) — 어긋난 네모파 여섯을 섞어 높은 곳만 남긴다
const HAT = [205.3, 304.4, 369.6, 522.7, 540, 800];
function metal(c, o, t, v, mult, hp, bp, len, att = 0.001) {
  const mix = amp(c, 1 / HAT.length), f1 = bq(c, 'bandpass', bp, 0.8), f2 = bq(c, 'highpass', hp, 0.7), g = c.createGain();
  for (const f of HAT) { const s = osc(c, 'square', f * mult, t); s.connect(mix); s.start(t); s.stop(t + att + len + 0.02); }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + len);
  mix.connect(f1).connect(f2).connect(g).connect(o);
}
//  손뼉 — 짧은 잡음 덩어리 서너 번(여러 손이 조금씩 어긋나게) + 꼬리
function clapNoise(c, o, t, v, N, bp, spikes, tail) {
  const s = c.createBufferSource(), f = bq(c, 'bandpass', bp, 0.9), hp = bq(c, 'highpass', 500, 0.7), g = c.createGain();
  s.buffer = N; s.loop = true;
  g.gain.setValueAtTime(0.0001, t);
  spikes.forEach((d, k) => {
    const last = k === spikes.length - 1;
    g.gain.setValueAtTime(v * (last ? 1 : 0.8), t + d);
    g.gain.exponentialRampToValueAtTime(last ? 0.0001 : v * 0.12, t + d + (last ? tail : 0.009));
  });
  s.connect(f).connect(hp).connect(g).connect(o); s.start(t); s.stop(t + spikes[spikes.length - 1] + tail + 0.02);
}
//  장구 — audio.js 와 같은 재료
const kung = (c, o, t, v, N) => { thump(c, o, t, v * 0.95, 105, 72, 0.5 * 0.35, 0.5); hiss(c, o, t, v * 0.18, N, 'lowpass', 420, 0.8, 0.06); };
const deok = (c, o, t, v, N) => { hiss(c, o, t, v * 0.62, N, 'bandpass', 2300, 1.3, 0.07); tone(c, o, t, v * 0.22, 540, 0.06); };
const gi = (c, o, t, v, N) => { hiss(c, o, t, v * 0.4, N, 'bandpass', 2300, 1.3, 0.05); tone(c, o, t, v * 0.14, 540, 0.04); };

//  소리 묶음 × 줄 = 소리 만들기(c 는 진짜 · 굽는 소리 장치 어느 쪽이든)
export const VOICES = {
  elec: {
    kick(c, o, t, v, N) {                                       // 깊고 길게 — 내려가는 사인 + 살짝 찌그러뜨림 + 딸깍
      const s = osc(c, 'sine', 170, t), g = c.createGain();
      s.frequency.exponentialRampToValueAtTime(58, t + 0.07); s.frequency.exponentialRampToValueAtTime(45, t + 0.8);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(v * 0.6, t + 0.02, 0.1); g.gain.setTargetAtTime(0.0001, t + 0.3, 0.2);
      s.connect(g).connect(shaper(c)).connect(o); s.start(t); s.stop(t + 1.25);
      hiss(c, o, t, v * 0.3, N, 'highpass', 3000, 0.7, 0.012);
    },
    snare(c, o, t, v, N) { tone(c, o, t, v * 0.55, 185, 0.12); tone(c, o, t, v * 0.3, 330, 0.07); hiss(c, o, t, v * 0.8, N, 'highpass', 1800, 0.7, 0.2); hiss(c, o, t, v * 0.3, N, 'bandpass', 5000, 1, 0.08); },
    clap(c, o, t, v, N) { clapNoise(c, o, t, v, N, 1100, [0, 0.011, 0.022, 0.034], 0.22); },
    hatc(c, o, t, v, N) { metal(c, o, t, v, 1, 7000, 10000, 0.05); hiss(c, o, t, v * 0.25, N, 'highpass', 9000, 0.7, 0.04); },
    hato(c, o, t, v, N) { metal(c, o, t, v, 1, 7000, 10000, 0.42, 0.002); hiss(c, o, t, v * 0.2, N, 'highpass', 8000, 0.7, 0.35); },
    tom(c, o, t, v, N) { thump(c, o, t, v, 220, 150, 0.08, 0.42, true); hiss(c, o, t, v * 0.12, N, 'lowpass', 3000, 0.7, 0.03); },
    shaker(c, o, t, v, N) { hiss(c, o, t, v, N, 'bandpass', 7200, 1.4, 0.09, 0.018); hiss(c, o, t, v * 0.3, N, 'highpass', 9000, 0.7, 0.05, 0.01); },
    cymbal(c, o, t, v, N) { metal(c, o, t, v * 0.8, 1.47, 5000, 8000, 1.4); hiss(c, o, t, v * 0.5, N, 'highpass', 6000, 0.7, 1.2); },
  },
  real: {
    kick(c, o, t, v, N) { thump(c, o, t, v, 120, 55, 0.05, 0.42, true); tone(c, o, t, v * 0.45, 170, 0.07); tone(c, o, t, v * 0.25, 85, 0.18); hiss(c, o, t, v * 0.45, N, 'lowpass', 4000, 0.8, 0.012); hiss(c, o, t, v * 0.5, N, 'bandpass', 3200, 0.9, 0.018); },   // 몸통 + '똑'(작은 스피커에서도 들리게)
    snare(c, o, t, v, N) { tone(c, o, t, v * 0.45, 200, 0.09); tone(c, o, t, v * 0.25, 340, 0.06, 'sine'); hiss(c, o, t, v * 0.75, N, 'bandpass', 4500, 0.6, 0.24); hiss(c, o, t, v * 0.35, N, 'highpass', 1200, 0.7, 0.12); },
    clap(c, o, t, v, N) { clapNoise(c, o, t, v, N, 1600, [0, 0.013, 0.022, 0.037], 0.28); },
    hatc(c, o, t, v, N) { hiss(c, o, t, v * 0.7, N, 'highpass', 7000, 0.7, 0.045); hiss(c, o, t, v * 0.5, N, 'bandpass', 10500, 0.9, 0.035); metal(c, o, t, v * 0.25, 1.2, 8000, 11000, 0.04); },
    hato(c, o, t, v, N) { hiss(c, o, t, v * 0.6, N, 'highpass', 7000, 0.7, 0.5, 0.002); hiss(c, o, t, v * 0.4, N, 'bandpass', 10500, 0.9, 0.4, 0.002); metal(c, o, t, v * 0.22, 1.2, 8000, 11000, 0.45, 0.002); },
    tom(c, o, t, v, N) { thump(c, o, t, v, 150, 110, 0.15, 0.55, true); tone(c, o, t, v * 0.2, 220, 0.08); hiss(c, o, t, v * 0.2, N, 'lowpass', 1500, 0.7, 0.04); },
    shaker(c, o, t, v, N) { hiss(c, o, t, v, N, 'bandpass', 5500, 1, 0.06, 0.02); hiss(c, o, t + 0.03, v * 0.6, N, 'bandpass', 6500, 1, 0.05, 0.01); },
    cymbal(c, o, t, v, N) { hiss(c, o, t, v * 0.7, N, 'highpass', 4500, 0.7, 1.8); metal(c, o, t, v * 0.5, 1.73, 3500, 7000, 1.6); },
  },
  kor: {
    kick(c, o, t, v, N) { thump(c, o, t, v, 98, 62, 0.12, 0.8, true); tone(c, o, t, v * 0.3, 140, 0.2); tone(c, o, t, v * 0.35, 190, 0.09); hiss(c, o, t, v * 0.35, N, 'lowpass', 300, 0.8, 0.18); hiss(c, o, t, v * 0.3, N, 'bandpass', 1200, 1, 0.02); },   // 북
    snare: deok,                                                                                                                     // 장구 덕
    clap(c, o, t, v, N) { kung(c, o, t, v, N); deok(c, o, t + 0.004, v, N); },                                                     // 장구 덩
    hatc(c, o, t, v, N) {                                                                                                            // 꽹과리 — 놋쇠 작은 징 · 높고 쨍 · 손으로 막아 짧게
      const g = c.createGain(), hp = bq(c, 'highpass', 900, 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(v * 0.25, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      hp.connect(g).connect(o);
      for (const [f, a] of [[1180, 0.5], [1873, 0.8], [2560, 0.6], [3310, 0.45], [4790, 0.3]]) { const s = osc(c, 'square', f, t), sg = amp(c, a * 0.22); s.connect(sg).connect(hp); s.start(t); s.stop(t + 0.4); }
      hiss(c, o, t, v * 0.5, N, 'bandpass', 3200, 1.5, 0.05);
    },
    hato(c, o, t, v, N) {                                                                                                            // 징 — 낮게 웅 · 살짝 다른 두 음이 웅웅(맥놀이) · 음이 조금 올라감
      const g = c.createGain(), lp = bq(c, 'lowpass', 1400, 0.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.025); g.gain.setTargetAtTime(v * 0.55, t + 0.03, 0.4); g.gain.setTargetAtTime(0.0001, t + 0.8, 0.9);
      lp.connect(g).connect(o);
      for (const [f, a] of [[146, 1], [147.6, 0.8], [293.5, 0.35], [420, 0.22], [588, 0.12], [771, 0.06]]) {
        const s = osc(c, 'sine', f, t), sg = amp(c, a * 0.32); s.frequency.linearRampToValueAtTime(f * 1.012, t + 1.6); s.connect(sg).connect(lp); s.start(t); s.stop(t + 3.6);
      }
      hiss(c, o, t, v * 0.15, N, 'lowpass', 600, 0.7, 0.08);
    },
    tom(c, o, t, v, N) { gi(c, o, t, v, N); deok(c, o, t + 0.085, v, N); },                                                         // 장구 기덕
    shaker: kung,                                                                                                                    // 장구 쿵
    cymbal(c, o, t, v, N) { [0.95, 0.8, 0.75, 0.9].forEach((k, i) => gi(c, o, t + 0.06 * i, v * k, N)); },                           // 더러러러(굴리기)
  },
};
//  구운 소리의 길이(초) · 크기 — 크롬북 같은 작은 스피커로 들리는 크기(150Hz 아래를 깎고 처음 0.12초 RMS)를 줄마다 정한 값에 맞춘다.
//   꼭대기는 0.98 을 넘기지 않는다(넘으면 그만큼 덜 키움). 귀로 맞춘 값이 아니라 셈으로 맞춘 값 — 믹서(소리 크기)로 더 맞출 수 있다.
const DUR = {
  elec: { kick: 1.3, snare: 0.35, clap: 0.3, hatc: 0.12, hato: 0.5, tom: 0.5, shaker: 0.15, cymbal: 1.5 },
  real: { kick: 0.5, snare: 0.36, clap: 0.38, hatc: 0.1, hato: 0.6, tom: 0.62, shaker: 0.13, cymbal: 1.9 },
  kor: { kick: 0.85, snare: 0.12, clap: 0.55, hatc: 0.42, hato: 3.6, tom: 0.2, shaker: 0.55, cymbal: 0.3 },
};
const DRUM_LOUD = { kick: 0.15, snare: 0.12, clap: 0.11, hatc: 0.04, hato: 0.05, tom: 0.11, shaker: 0.035, cymbal: 0.07 };
const TARGET = { elec: DRUM_LOUD, real: DRUM_LOUD,
  kor: { kick: 0.13, snare: 0.1, clap: 0.13, hatc: 0.06, hato: 0.08, tom: 0.09, shaker: 0.1, cymbal: 0.07 } };   // 북 · 덕 · 덩 · 꽹과리 · 징 · 기덕 · 쿵 · 더러러러
//  낮은 북(진짜 북 쿵 · 북 · 장구 덩 · 쿵)은 구운 뒤 살짝 찌그러뜨린다(tanh) — 아주 낮은 소리 꼭대기를 눌러 작은 스피커에 들리는 배음을 키운다
const DRIVE = { real: { kick: 3 }, kor: { kick: 3, clap: 2.5, shaker: 2.5, snare: 1.6 } };
//  작은 스피커로 들리는 크기 — 150Hz 아래를 가파르게 깎고(2차 고역 통과 두 번) 처음 win 초의 RMS
export function speakerLoud(d, sr, win = 0.12) {
  const n = Math.min(d.length, Math.round(sr * win)), w = 2 * Math.PI * 150 / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * 0.707), a0 = 1 + al;
  const b0 = (1 + cs) / 2 / a0, b1 = -(1 + cs) / a0, b2 = b0, a1 = -2 * cs / a0, a2 = (1 - al) / a0;
  let x = d.subarray ? d.subarray(0, n) : d.slice(0, n);
  for (let pass = 0; pass < 2; pass++) { const y = new Float32Array(n); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < n; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } x = y; }
  let ss = 0; for (let i = 0; i < n; i++) ss += x[i] * x[i];
  return Math.sqrt(ss / Math.max(1, n));
}
//  베이스 · 화음 크기(소리 묶음마다) — 작은 스피커로 잰 크기로 맞춤: 베이스 ≈ 북과 비슷하게 · 화음 ≈ 북보다 6dB 작게(뒤에서 받쳐 주게)
//   기본 리듬 카드 여덟 판을 오프라인으로 그려 견준 값(scripts/unit/music/beat-live.mjs A43 이 다시 잰다) · 길게 치는 화음은 소리가 계속 나서 반(-6dB)으로
const LAYER = { elec: { bass: 1, chord: 0.68 }, real: { bass: 0.72, chord: 0.27 }, kor: { bass: 1.2, chord: 0.57 } };
const STYLE_GAIN = { long: 0.5, oom: 1, short: 1 };
//  소리 묶음 전체 크기 — 진짜 북은 짧고 가벼워 다 합친 소리가 작다(같은 카드로 재면 전자 북보다 약 4.7dB 작음) → 조금 키운다
const KIT_GAIN = { elec: 1, real: 1.5, kor: 1 };
const PAN = { kick: 0, snare: 0.04, clap: -0.14, hatc: 0.24, hato: 0.24, tom: -0.2, shaker: -0.3, cymbal: 0.18, mel: 0.1, bass: 0, chord: -0.06 };
//  가락 악기 [MUSIC-BEAT-MEL-1] — inst = 공용 엔진 악기(없으면 여기서 만듦) · oct = 올림(반음): 가락 칸(도 60 ~ 높은 미 76)보다 한 옥타브 위에서 울려
//   화음(60 ~ 69)과 겹치지 않고 위에 뜨게(글로켄은 진짜 글로켄처럼 두 옥타브 위) · gain = 같은 가락을 작은 스피커 크기로 재어 악기끼리 맞춘 값
const LEAD_SND = {
  synth: { oct: 12, gain: 1 }, daegeum: { oct: 12, gain: 0.61 },
  xylo: { inst: 'xylo', oct: 12, gain: 0.78 }, piano: { inst: 'piano', oct: 12, gain: 0.76 }, flute: { inst: 'flute', oct: 12, gain: 0.62 },
  glock: { inst: 'glock', oct: 24, gain: 0.94 }, gayageum: { inst: 'gayageum', oct: 12, gain: 2.4 },
};
//  가락 크기(소리 묶음마다) — 기본 리듬 카드를 작은 스피커 크기로 재어 '화음과 비슷하거나 조금 크게 · 쿵 · 짝보다 작게'(북 대비 약 -5dB · beat-live A43 이 다시 잰다)
const MEL_LAYER = { elec: 0.3, real: 0.2, kor: 0.27 };

function noiseBuf(sr) {
  let b;
  try { b = new AudioBuffer({ length: sr, sampleRate: sr, numberOfChannels: 1 }); }
  catch (e) { const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext; b = new OAC(1, 1, sr).createBuffer(1, sr, sr); }
  const d = b.getChannelData(0); let seed = 12345;
  for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }   // 늘 같은 잡음(구운 소리가 매번 같게)
  return b;
}

export class BeatKit {
  constructor(engine) { this.e = engine; this.buf = {}; this.pending = {}; this.sr = 44100; this.N = null; this.info = {}; }
  ready(kit) { return !!this.buf[kit]; }
  //  소리 묶음을 굽는다(한 번) — 여덟 줄을 함께 · 실패하면 그 묶음은 바로 합성으로
  prepare(kit) {
    if (this.buf[kit]) return Promise.resolve(true);
    if (this.pending[kit]) return this.pending[kit];
    const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!OAC || !VOICES[kit]) return Promise.resolve(false);
    if (!this.N) this.N = noiseBuf(this.sr);
    const t0 = performance.now();
    this.pending[kit] = Promise.all(ROWS.map(r => this._render(OAC, kit, r))).then(list => {
      const out = {}; ROWS.forEach((r, i) => { out[r] = list[i]; });
      this.buf[kit] = out; (this.info[kit] = this.info[kit] || {}).ms = Math.round(performance.now() - t0);
      return true;
    }).catch(e => { console.warn('[MUSIC-BEAT-1] 소리 굽기 실패 — 바로 합성으로', kit, e); return false; }).finally(() => { delete this.pending[kit]; });
    return this.pending[kit];
  }
  async _render(OAC, kit, row) {
    const sr = this.sr, len = Math.ceil(sr * DUR[kit][row]), c = new OAC(1, len, sr);
    VOICES[kit][row](c, c.destination, 0, 1, this.N);
    const buf = await c.startRendering();
    const d = buf.getChannelData(0);
    const drive = (DRIVE[kit] || {})[row];
    if (drive) { let p0 = 0; for (let i = 0; i < d.length; i++) p0 = Math.max(p0, Math.abs(d[i])); if (p0 > 0) { const nk = Math.tanh(drive); for (let i = 0; i < d.length; i++) d[i] = Math.tanh(drive * d[i] / p0) / nk; } }
    let pk = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    const loud = speakerLoud(d, sr);
    if (!(pk > 1e-5) || !Number.isFinite(pk) || !(loud > 1e-6)) throw new Error(`소리가 비었어요 ${kit}/${row}`);
    const k = Math.min(TARGET[kit][row] / loud, 0.98 / pk), fade = Math.min(d.length, Math.round(sr * 0.004));
    (this.info[kit] = this.info[kit] || {})[row] = { loud: +(loud * k).toFixed(4), want: TARGET[kit][row], capped: k < TARGET[kit][row] / loud };
    for (let i = 0; i < d.length; i++) d[i] *= k;
    for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;   // 끝을 살짝 줄여 딱 소리 없게
    return buf;
  }
  //  북 한 번 — 예약 시각 t · 세기 vel · 출구(믹서 줄) → { stop(at), end }
  hit(kit, row, t, vel, out) {
    const c = this.e.ctx;
    if (!c || !out) return null;
    t = Math.max(t, c.currentTime);
    const b = this.buf[kit] && this.buf[kit][row];
    const g = c.createGain(); g.gain.value = vel; g.connect(out);
    if (!b) {                                                          // 아직 안 구웠으면 같은 재료로 바로(조금 무겁다)
      if (!this.N) this.N = noiseBuf(this.sr);
      const fn = (VOICES[kit] || VOICES.elec)[row]; if (!fn) return null;
      g.gain.value = vel * 0.55; fn(c, g, t, 1, this.N);
      const end = t + (DUR[kit] || DUR.elec)[row];
      setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (end - c.currentTime + 1) * 1000);
      return { end, stop: at => { try { g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(0, at, 0.008); } catch (e) {} } };
    }
    const s = c.createBufferSource(); s.buffer = b; s.connect(g); s.start(t);
    s.onended = () => { try { g.disconnect(); } catch (e) {} };
    let stopped = false;
    return { end: t + b.duration, stop: at => {
      if (stopped) return; stopped = true;
      at = Math.max(at, c.currentTime);
      try { g.gain.setTargetAtTime(0, at, 0.008); s.stop(at + 0.06); } catch (e) {}
    } };
  }
  //  베이스 한 음 — p(미디 번호) · dur 초 · 소리 묶음마다 다른 소리: 전자 = 톱니 + 몸통 사인(필터가 닫히며 '뚱') · 진짜 = 손가락 베이스 · 우리 장단 = 한 옥타브 위 뜯는 줄
  bass(kit, p, t, dur, vel, out) {
    const c = this.e.ctx; if (!c || !out) return null;
    vel *= (LAYER[kit] || LAYER.elec).bass;
    t = Math.max(t, c.currentTime);
    const f = freqOf(p), g = c.createGain(), lp = c.createBiquadFilter(), end = t + Math.max(0.06, dur);
    lp.type = 'lowpass';
    let oscs;
    if (kit === 'real') {
      const a = osc(c, 'triangle', f, t), b = osc(c, 'sine', f * 2, t), bg = amp(c, 0.3);
      lp.Q.value = 0.7; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
      a.connect(lp); b.connect(bg).connect(lp); oscs = [a, b];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.62, t + 0.006); g.gain.setTargetAtTime(vel * 0.26, t + 0.01, 0.35);
    } else if (kit === 'kor') {
      const a = osc(c, 'triangle', f * 2, t), b = osc(c, 'sawtooth', f * 2, t), bg = amp(c, 0.18);
      a.detune.setValueAtTime(30, t); a.detune.linearRampToValueAtTime(0, t + 0.07); b.detune.setValueAtTime(30, t); b.detune.linearRampToValueAtTime(0, t + 0.07);
      lp.Q.value = 0.8; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.4);
      a.connect(lp); b.connect(bg).connect(lp); oscs = [a, b];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.55, t + 0.003); g.gain.setTargetAtTime(vel * 0.05, t + 0.006, 0.32);
    } else {
      const a = osc(c, 'sawtooth', f, t), b = osc(c, 'sine', f, t), bg = amp(c, 0.8);
      lp.Q.value = 5; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.22);
      a.connect(lp); b.connect(bg).connect(lp); oscs = [a, b];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.42, t + 0.005); g.gain.setTargetAtTime(vel * 0.3, t + 0.01, 0.12);
    }
    g.gain.setTargetAtTime(0, end, 0.03);
    lp.connect(g).connect(out);
    return this._voice(c, g, oscs, t, end + 0.25, 0.02);
  }
  //  화음 한 번 — notes(미디 번호 셋) · style 길게(부드럽게 이어짐) / 쿵짝 · 짧게 톡톡(짧게 끊음)
  //   전자 = 어긋난 톱니 둘(넓게) · 진짜 = 전기 피아노 · 우리 장단 = 가야금처럼 뜯고 한 줄씩 살짝 늦게(긴 음은 농현)
  chord(kit, notes, t, dur, vel, out, style = 'long') {
    const c = this.e.ctx; if (!c || !out) return null;
    vel *= (LAYER[kit] || LAYER.elec).chord * (STYLE_GAIN[style] || 1);
    t = Math.max(t, c.currentTime);
    const long = style === 'long', g = c.createGain(), lp = c.createBiquadFilter(), end = t + Math.max(0.05, dur), oscs = [];
    lp.type = 'lowpass';
    if (kit === 'real') {
      lp.frequency.value = 3200; lp.Q.value = 0.5;
      for (const p of notes) { const f = freqOf(p), a = osc(c, 'sine', f, t), b = osc(c, 'sine', f * 2, t), bg = amp(c, 0.22), ag = amp(c, 0.34); a.connect(ag).connect(lp); b.connect(bg).connect(lp); oscs.push(a, b); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.62, t + 0.004); g.gain.setTargetAtTime(vel * 0.2, t + 0.01, long ? 0.6 : 0.14);
    } else if (kit === 'kor') {
      lp.frequency.value = 2600; lp.Q.value = 0.6;
      notes.forEach((p, k) => {
        const f = freqOf(p), st = t + k * 0.012, a = osc(c, 'triangle', f, st), b = osc(c, 'sine', f * 2, st), bg = amp(c, 0.35), ag = amp(c, 0.42);
        for (const o of [a, b]) {
          o.detune.setValueAtTime(25, st); o.detune.linearRampToValueAtTime(0, st + 0.05);
          if (long && dur > 0.6) { o.detune.setValueAtTime(0, st + 0.35); o.detune.linearRampToValueAtTime(20, st + 0.52); o.detune.linearRampToValueAtTime(-6, st + 0.75); o.detune.linearRampToValueAtTime(0, st + 0.92); }
        }
        a.connect(ag).connect(lp); b.connect(bg).connect(lp); oscs.push(a, b);
      });
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.6, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.006, long ? 0.45 : 0.15);
    } else {
      lp.Q.value = 0.6;
      if (long) lp.frequency.value = 1500; else { lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.15); }
      for (const p of notes) { const f = freqOf(p), a = osc(c, 'sawtooth', f, t), b = osc(c, 'sawtooth', f, t); a.detune.value = -7; b.detune.value = 7; a.connect(lp); b.connect(lp); oscs.push(a, b); }
      g.gain.setValueAtTime(0.0001, t);
      if (long) { g.gain.exponentialRampToValueAtTime(vel * 0.11, t + 0.03); g.gain.setTargetAtTime(vel * 0.085, t + 0.04, 0.3); }
      else { g.gain.exponentialRampToValueAtTime(vel * 0.16, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.07); }
    }
    g.gain.setTargetAtTime(0, end, long ? 0.08 : 0.03);
    lp.connect(g).connect(out);
    return this._voice(c, g, oscs, t, end + (long ? 0.5 : 0.25), long ? 0.04 : 0.015);
  }
  //  가락 한 음 [MUSIC-BEAT-MEL-1] — lead(악기) · p(가락 칸의 미디 번호 · 악기마다 옥타브를 올려 냄) · dur 초 → { stop(at), end }
  //   두드리거나 뜯는 악기(실로폰 · 글로켄 · 가야금)는 dur 와 상관없이 저절로 잦아든다(엔진 소리 그대로)
  lead(leadId, kitId, p, t, dur, vel, out) {
    const c = this.e.ctx; if (!c || !out) return null;
    const L = LEAD_SND[leadId] || LEAD_SND.synth;
    vel *= (MEL_LAYER[kitId] || 1) * L.gain;
    t = Math.max(t, c.currentTime);
    const q = p + L.oct;
    if (!L.inst) return leadId === 'daegeum' ? this._daegeum(c, q, t, dur, vel, out) : this._synth(c, q, t, dur, vel, out);
    if (typeof this.e.note !== 'function') return null;
    //  엔진 소리는 우리 Gain(vg)을 지나게 하고, 끊을 때는 vg 만 줄인다. 엔진의 stop 은 '부르는 때'의 크기를 읽어 그 값에서 줄이므로
    //   아직 시작 안 한 음(빠른 16분음 · 0.12초 앞 예약 · 오프라인 그리기)을 끊으면 기본값 1 로 '퍽' 커진다 → 이미 울리는 음일 때만 엔진 stop 도 불러 발진기를 일찍 멈춘다
    const vg = c.createGain(); vg.connect(out);
    const hd = this.e.note(L.inst, q, t, Math.max(0.06, dur), vel, vg);
    if (!hd) { try { vg.disconnect(); } catch (e) {} return null; }
    const rel = /xylo|glock|gayageum/.test(L.inst) ? 0.05 : 0.035;
    let stopped = false;
    return { end: Number.isFinite(hd.end) ? hd.end : t + Math.max(0.06, dur) + 1, stop: at => {
      if (stopped) return; stopped = true;
      at = Math.max(at, c.currentTime);
      try { vg.gain.setTargetAtTime(0, at, rel); } catch (e) {}
      if (c.currentTime >= t) { try { hd.stop(at + rel * 6); } catch (e) {} }
    } };
  }
  //  신스 — 네모파 + 톱니파(살짝 어긋나게) → 처음엔 밝았다 부드러워지는 필터 · 긴 음은 늦게 오는 떨림
  _synth(c, p, t, dur, vel, out) {
    const f = freqOf(p), end = t + Math.max(0.06, dur), g = c.createGain(), lp = bq(c, 'lowpass', Math.min(5000, f * 4), 1.1);
    const a = osc(c, 'square', f, t), b = osc(c, 'sawtooth', f, t), bg = amp(c, 0.6);
    b.detune.setValueAtTime(8, t);
    lp.frequency.setValueAtTime(Math.min(7000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.min(5000, f * 4), t + 0.16);
    a.connect(lp); b.connect(bg).connect(lp);
    const oscs = [a, b];
    if (dur > 0.38) {
      const l = osc(c, 'sine', 5.6, t), lg = c.createGain();
      lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.18); lg.gain.linearRampToValueAtTime(10, t + 0.42);
      l.connect(lg); lg.connect(a.detune); lg.connect(b.detune); oscs.push(l);
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.2, t + 0.006); g.gain.setTargetAtTime(vel * 0.15, t + 0.012, 0.12);
    g.gain.setTargetAtTime(0, end, 0.035);
    lp.connect(g).connect(out);
    return this._voice(c, g, oscs, t, end + 0.3, 0.03);
  }
  //  대금 — 대나무 피리: 둥근 소리(사인 + 세모) + 청(얇은 막) 떨림(톱니를 2.4kHz 띠로 · 작게) + 숨소리 · 아래에서 밀어 올려 붙는 음 · 긴 음은 천천히 깊게 흔들기(농음)
  _daegeum(c, p, t, dur, vel, out) {
    if (!this.N) this.N = noiseBuf(this.sr);
    const f = freqOf(p), end = t + Math.max(0.08, dur), g = c.createGain(), lp = bq(c, 'lowpass', Math.min(6500, f * 5), 0.5);
    const a = osc(c, 'sine', f, t), b = osc(c, 'triangle', f, t), z = osc(c, 'sawtooth', f, t);
    const bg = amp(c, 0.35), zb = bq(c, 'bandpass', 2400, 1.3), zg = amp(c, 0.2);
    for (const o of [a, b, z]) { o.detune.setValueAtTime(-50, t); o.detune.linearRampToValueAtTime(0, t + 0.06); }
    a.connect(lp); b.connect(bg).connect(lp); z.connect(zb).connect(zg).connect(lp);
    const oscs = [a, b, z];
    if (dur > 0.45) {
      const l = osc(c, 'sine', 4.4, t), lg = c.createGain();
      lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.25); lg.gain.linearRampToValueAtTime(26, t + 0.75);
      l.connect(lg); for (const o of oscs) lg.connect(o.detune); oscs.push(l);
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.04); g.gain.setTargetAtTime(vel * 0.25, t + 0.05, 0.2);
    g.gain.setTargetAtTime(0, end, 0.06);
    lp.connect(g).connect(out);
    hiss(c, out, t, vel * 0.05, this.N, 'bandpass', Math.min(7000, f * 2), 0.9, Math.min(0.25, Math.max(0.08, dur)), 0.02);   // 숨소리(처음에 조금 · 짧은 음은 짧게)
    return this._voice(c, g, oscs, t, end + 0.45, 0.06);
  }
  //  발진기 묶음 → { stop(at), end } · 다 울리면 끊는다
  _voice(c, g, oscs, t, stopAt, rel) {
    for (const o of oscs) { o.start(t); o.stop(stopAt); }
    oscs[0].onended = () => { try { g.disconnect(); } catch (e) {} };
    let stopped = false;
    return { end: stopAt, stop: at => {
      if (stopped) return; stopped = true;
      at = Math.max(at, c.currentTime);
      try { g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(0, at, rel); } catch (e) {}
      for (const o of oscs) { try { o.stop(Math.min(stopAt, at + rel * 8)); } catch (e) {} }
    } };
  }
  //  시험용(?debug=1) — 구운 소리마다 꼭대기 · 크기(RMS) · 밝기(0 을 지나는 빈도) · 길이 · 굽는 데 든 시간
  stats() {
    const out = {};
    for (const [kit, rows] of Object.entries(this.buf)) {
      out[kit] = { ms: (this.info[kit] || {}).ms };
      for (const [r, b] of Object.entries(rows)) {
        const d = b.getChannelData(0); let pk = 0, ss = 0, zc = 0, nan = 0, tail = 0;
        for (let i = 0; i < d.length; i++) { const x = d[i]; if (!Number.isFinite(x)) { nan++; continue; } pk = Math.max(pk, Math.abs(x)); ss += x * x; if (i && (d[i - 1] < 0) !== (x < 0)) zc++; if (Math.abs(x) > 0.01) tail = i; }
        const inf = (this.info[kit] || {})[r] || {};
        out[kit][r] = { peak: +pk.toFixed(3), rms: +Math.sqrt(ss / d.length).toFixed(4), zcr: Math.round(zc / b.duration), sec: +b.duration.toFixed(2), ring: +(tail / b.sampleRate).toFixed(2), nan, loud: inf.loud, want: inf.want, capped: !!inf.capped };
      }
    }
    return out;
  }
}

//  믹서 — 줄마다 소리 크기 · 음소거(M) · 혼자 듣기(S, 하나라도 켜면 켠 줄만) → 좌우 → 비트 버스 → 공용 엔진
export class BeatMixer {
  constructor(engine) {
    const c = engine.ctx;
    this.c = c; this.out = engine.bus(); this.master = amp(c, 0.72); this.master.connect(this.out);
    this.ch = {};
    for (const r of MIX) {
      const g = amp(c, VOL_DEF);
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = PAN[r] || 0; g.connect(p).connect(this.master); } else g.connect(this.master);
      this.ch[r] = g;
    }
  }
  apply(mix, kit) {
    const solo = MIX.some(r => mix[r] && mix[r].s), now = this.c.currentTime;
    if (kit) this.master.gain.setTargetAtTime(0.72 * (KIT_GAIN[kit] || 1), now, 0.02);
    for (const r of MIX) { const m = mix[r] || { v: VOL_DEF }; const on = !m.m && (!solo || m.s); this.ch[r].gain.setTargetAtTime(on ? m.v : 0, now, 0.012); }
  }
  audible(mix, r) { const solo = MIX.some(x => mix[x] && mix[x].s); return !mix[r].m && (!solo || mix[r].s) && mix[r].v > 0; }
  dispose() { try { this.master.disconnect(); } catch (e) {} try { this.out.disconnect(); } catch (e) {} }
}
