// 소리 엔진 — Web Audio 로 악기를 직접 만든다(소리 파일 0개). 크롬북 스피커에서도 음이 들리게 배음을 조금씩 섞는다.
//  · Engine.note(악기, 음, 시작, 길이, 세기, 출구) → { stop(시각) }  · Engine.drum(종류, 시작, 세기, 출구, 한 칸 길이)
//  · Player = 미리 만든 사건 목록을 0.15초 앞서 예약해 튼다(오디오 시계 기준 — 화면이 버벅여도 박이 안 흔들린다)
import { freq } from './theory.js';

export class Engine {
  constructor() { this.ctx = null; this._ks = new Map(); }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this._setup(new AC({ latencyHint: 'interactive' }));
    }
    if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
    return this.ctx;
  }
  // 소리 길을 만든다(시험할 때는 OfflineAudioContext 를 넣는다)
  _setup(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.master.connect(comp).connect(ctx.destination);
    this.dry = ctx.createGain(); this.dry.connect(this.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = this._impulse(2.4, 2.8);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.12;
    this.verb.connect(this.wet).connect(this.master);
    this.noise = this._noiseBuf();
    this.live = this.bus();                           // 바로 치는 소리(리듬 게임·칸 누를 때)
    return ctx;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  bus() { const g = this.ctx.createGain(); g.connect(this.dry); const s = this.ctx.createGain(); s.gain.value = 1; g.connect(s).connect(this.verb); return g; }
  setReverb(x) { if (this.wet) this.wet.gain.setTargetAtTime(x, this.ctx.currentTime, 0.05); }

  _impulse(sec, decay) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * sec), buf = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  _noiseBuf() {
    const sr = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, sr, sr), d = buf.getChannelData(0);
    for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _osc(type, f, t) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; }
  _noise(t, dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; }

  note(inst, p, t, dur, vel = 0.8, out = null) {
    const ctx = this.ctx || this.ensure();
    out = out || this.live;
    t = Math.max(t, ctx.currentTime);
    const f = freq(p), fn = { piano: this._piano, xylo: this._mallet, marimba: this._mallet, recorder: this._recorder, gayageum: this._gayageum, bass: this._bass, pad: this._pad }[inst] || this._piano;
    return fn.call(this, f, t, Math.max(0.05, dur), vel, out, inst);
  }
  // 손을 떼면(리듬 게임 긴 음) 그때 끝낸다 — 각 악기가 g(엔벨로프)와 stopAll 을 넘겨준다
  _handle(g, oscs, rel, tailEnd) {
    let done = false;
    return { stop: at => {
      if (done) return; done = true;
      at = Math.max(at ?? this.now, this.now);
      g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(g.gain.value, at); g.gain.setTargetAtTime(0, at, rel);
      for (const o of oscs) { try { o.stop(at + rel * 6); } catch {} }
    }, end: tailEnd };
  }

  _piano(f, t, dur, vel, out) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 10), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(700, f * 2.5), t + 1.4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.42, t + 0.005);
    g.gain.setTargetAtTime(vel * 0.16, t + 0.006, 0.22);
    g.gain.setTargetAtTime(vel * 0.03, t + 0.5, 1.1);
    const end = t + dur;
    g.gain.setTargetAtTime(0, end, 0.09);
    const oscs = [[1, 1], [2, 0.42], [3, 0.2], [4, 0.1], [5, 0.05]].map(([k, a]) => {
      const o = this._osc(k === 1 ? 'triangle' : 'sine', f * k * (1 + 0.0004 * k * k), t);
      const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(lp);
      o.start(t); o.stop(end + 0.7); return o;
    });
    lp.connect(g).connect(out);
    return this._handle(g, oscs, 0.09, end + 0.7);
  }
  _mallet(f, t, dur, vel, out, inst) {          // 실로폰(밝고 짧게) · 마림바(둥글고 조금 길게)
    const ctx = this.ctx, g = ctx.createGain(), xylo = inst === 'xylo';
    const tau = xylo ? 0.2 : 0.38;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * (xylo ? 0.5 : 0.55), t + (xylo ? 0.002 : 0.004));
    g.gain.setTargetAtTime(0, t + 0.004, tau);
    const parts = xylo ? [[1, 1], [3, 0.28], [6.6, 0.05]] : [[1, 1], [4, 0.14], [9.9, 0.025]];
    const oscs = parts.map(([k, a]) => {
      const o = this._osc('sine', f * k, t), og = ctx.createGain();
      og.gain.setValueAtTime(a, t); if (k > 1) og.gain.setTargetAtTime(0, t, tau / (k * 0.6));
      o.connect(og).connect(g); o.start(t); o.stop(t + tau * 7); return o;
    });
    const click = this._noise(t, 0.02), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = xylo ? 3000 : 1800;
    cg.gain.setValueAtTime(vel * (xylo ? 0.16 : 0.08), t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    click.connect(hp).connect(cg).connect(g);
    g.connect(out);
    return this._handle(g, oscs, 0.05, t + tau * 7);
  }
  _recorder(f, t, dur, vel, out) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(8000, f * 3.2); lp.Q.value = 0.6;
    const end = t + dur;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.4, t + 0.025);
    g.gain.linearRampToValueAtTime(vel * 0.32, t + 0.09);
    g.gain.setValueAtTime(vel * 0.32, end);
    g.gain.setTargetAtTime(0, end, 0.025);
    const o1 = this._osc('triangle', f, t), o2 = this._osc('sine', f, t), o3 = this._osc('sine', f * 2, t);
    const g2 = ctx.createGain(); g2.gain.value = 0.7; const g3 = ctx.createGain(); g3.gain.value = 0.06;
    const lfo = this._osc('sine', 5.3, t), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.005, t + Math.min(0.5, dur * 0.6));
    lfo.connect(lg); for (const o of [o1, o2]) lg.connect(o.frequency);
    o1.connect(lp); o2.connect(g2).connect(lp); o3.connect(g3).connect(lp);
    const br = this._noise(t, dur + 0.1), bp = ctx.createBiquadFilter(), bg = ctx.createGain();   // 숨소리
    bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 0.9;
    bg.gain.setValueAtTime(vel * 0.09, t); bg.gain.setTargetAtTime(vel * 0.012, t + 0.02, 0.05); bg.gain.setTargetAtTime(0, end, 0.02);
    br.connect(bp).connect(bg).connect(g);
    lp.connect(g).connect(out);
    const oscs = [o1, o2, o3, lfo];
    for (const o of oscs) { o.start(t); o.stop(end + 0.25); }
    return this._handle(g, oscs, 0.025, end + 0.25);
  }
  _ksBuffer(f) {                                // 가야금 = 줄을 뜯는 소리(Karplus-Strong) — 음마다 한 번 만들어 둔다
    const key = Math.round(f * 10);
    if (this._ks.has(key)) return this._ks.get(key);
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 2.2), N = Math.max(2, Math.round(sr / f));
    const buf = this.ctx.createBuffer(1, len, sr), y = buf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; y[i] = (r + prev) * 0.5; prev = r; }
    const decay = 0.9965 - Math.min(0.004, f / 400000);
    for (let i = N; i < len; i++) y[i] = decay * 0.5 * (y[i - N] + y[i - N - 1 < 0 ? 0 : i - N - 1]);
    this._ks.set(key, buf);
    return buf;
  }
  _gayageum(f, t, dur, vel, out) {
    const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    src.buffer = this._ksBuffer(f);
    lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 6);
    g.gain.setValueAtTime(vel * 0.75, t);
    if (dur > 0.6) { src.detune.setValueAtTime(0, t + 0.35); src.detune.linearRampToValueAtTime(18, t + 0.55); src.detune.linearRampToValueAtTime(-6, t + 0.8); src.detune.linearRampToValueAtTime(0, t + 1.0); }   // 농현(살짝 떠는 소리)
    src.connect(lp).connect(g).connect(out);
    src.start(t); src.stop(t + 2.2);
    return this._handle(g, [src], 0.08, t + 2.2);
  }
  _bass(f, t, dur, vel, out) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(), end = t + dur;
    lp.type = 'lowpass'; lp.frequency.value = 1100;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.006);
    g.gain.setTargetAtTime(vel * 0.3, t + 0.01, 0.15); g.gain.setTargetAtTime(0, end, 0.06);
    const o1 = this._osc('triangle', f, t), o2 = this._osc('sine', f * 2, t), g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out);
    for (const o of [o1, o2]) { o.start(t); o.stop(end + 0.4); }
    return this._handle(g, [o1, o2], 0.06, end + 0.4);
  }
  _pad(f, t, dur, vel, out) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(), end = t + dur;
    lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.22, t + 0.03);
    g.gain.setTargetAtTime(vel * 0.15, t + 0.04, 0.3); g.gain.setTargetAtTime(0, end, 0.12);
    const o1 = this._osc('sawtooth', f, t), o2 = this._osc('sawtooth', f * 1.005, t), o3 = this._osc('triangle', f, t);
    for (const o of [o1, o2, o3]) { o.connect(lp); o.start(t); o.stop(end + 0.8); }
    lp.connect(g).connect(out);
    return this._handle(g, [o1, o2, o3], 0.12, end + 0.8);
  }

  // ── 북·장구 ──  덩 = 쿵 + 덕 · 쿵 = 궁편(낮게 울림) · 덕 = 채편(딱) · 기 = 여린 덕 · 더러러러 = 채편을 굴림
  drum(kind, t, vel = 0.8, out = null, span = 0.15) {
    const ctx = this.ctx || this.ensure();
    out = out || this.live;
    t = Math.max(t, ctx.currentTime);
    switch (kind) {
      case 'kick': return this._thump(t, vel, out, 140, 46, 0.3);
      case 'snare': this._hiss(t, vel * 0.55, out, 'bandpass', 1900, 0.14, 0.7); return this._tone(t, vel * 0.3, out, 190, 0.08);
      case 'hat': return this._hiss(t, vel * 0.3, out, 'highpass', 7600, 0.045);
      case 'kung': this._thump(t, vel, out, 105, 72, 0.5); return this._hiss(t, vel * 0.18, out, 'lowpass', 420, 0.06);
      case 'deok': this._hiss(t, vel * 0.62, out, 'bandpass', 2300, 0.07, 1.3); return this._tone(t, vel * 0.22, out, 540, 0.06);
      case 'gi': this._hiss(t, vel * 0.4, out, 'bandpass', 2300, 0.05, 1.3); return this._tone(t, vel * 0.14, out, 540, 0.04);
      case 'deong': this.drum('kung', t, vel, out); return this.drum('deok', t + 0.004, vel, out);
      case 'roll': for (let i = 0; i < 4; i++) this.drum('gi', t + (span / 4) * i, vel * [0.95, 0.8, 0.75, 0.9][i], out); return;
    }
  }
  _thump(t, vel, out, f0, f1, len) {
    const o = this._osc('sine', f0, t), g = this.ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.35);
    g.gain.setValueAtTime(vel * 0.95, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  _hiss(t, vel, out, type, fq, len, q = 0.8) {
    const n = this._noise(t, len + 0.02), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = type; f.frequency.value = fq; f.Q.value = q;
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f).connect(g).connect(out);
  }
  _tone(t, vel, out, fq, len) {
    const o = this._osc('triangle', fq, t), g = this.ctx.createGain();
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  click(t, accent = false, out = null) {
    const ctx = this.ctx || this.ensure();
    out = out || this.live;
    const o = this._osc('sine', accent ? 1660 : 1180, Math.max(t, ctx.currentTime)), g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.42 : 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.05);
  }
}

// 예약 재생 — 사건 목록 [{ t, kind:'note'|'drum'|'click', … }] 을 시각 순서대로
export class Player {
  constructor(engine) { this.e = engine; this.timer = null; this.bus = null; this.playing = false; this.mute = {}; }
  start(events, { at = null, total = null, onEnd = null, gain = 1 } = {}) {
    const ctx = this.e.ensure();
    this.stop();
    this.bus = this.e.bus(); this.bus.gain.value = gain;
    this.t0 = at ?? ctx.currentTime + 0.1;
    this.events = events; this.i = 0; this.total = total; this.onEnd = onEnd; this.playing = true;
    const tick = () => {
      if (!this.playing) return;
      const horizon = ctx.currentTime + 0.15;
      while (this.i < this.events.length && this.t0 + this.events[this.i].t < horizon) this._fire(this.events[this.i++]);
      if (this.total != null && ctx.currentTime > this.t0 + this.total + 0.08) { const cb = this.onEnd; this.stop(false); cb && cb(); }
    };
    tick();
    this.timer = setInterval(tick, 25);
    return this.t0;
  }
  _fire(ev) {
    if (this.mute[ev.track]) return;
    const t = this.t0 + ev.t;
    if (ev.kind === 'note') this.e.note(ev.inst, ev.p, t, ev.d, ev.vel, this.bus);
    else if (ev.kind === 'drum') this.e.drum(ev.drum, t, ev.vel, this.bus, ev.span);
    else if (ev.kind === 'click') this.e.click(t, ev.accent, this.bus);
  }
  get pos() { return this.playing ? this.e.now - this.t0 : -1; }
  stop(fade = true) {
    clearInterval(this.timer); this.timer = null;
    if (this.bus) {
      const g = this.bus.gain, now = this.e.now, b = this.bus;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + (fade ? 0.06 : 0.3));
      setTimeout(() => { try { b.disconnect(); } catch {} }, 900);
      this.bus = null;
    }
    this.playing = false;
  }
}

export const engine = new Engine();
