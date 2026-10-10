// 소리 엔진 — Web Audio 로 악기를 직접 만든다(소리 파일 0개). 크롬북 스피커에서도 음이 들리게 배음을 조금씩 섞는다.
//  · Engine.note(악기, 음, 시작, 길이, 세기, 출구, 연주법) → { stop(시각) }  · Engine.drum(종류, 시작, 세기, 출구, 한 칸 길이)
//  · Player = 미리 만든 사건 목록을 0.15초 앞서 예약해 튼다(오디오 시계 기준 — 화면이 버벅여도 박이 안 흔들린다)
//  [MUSIC-ORCH-1] 오케스트라 악기 15가지 + 팀파니 · 심벌즈 · 큰북 · 트라이앵글 · 서스펜디드 심벌(부풂). 연주법(art): 'swell' = 음 안에서 점점 크게 · 'roll' = 팀파니 굴리기
import { freq } from './theory.js';

export class Engine {
  constructor() { this.ctx = null; this._ks = new Map(); this._pk = new Map(); }
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

  note(inst, p, t, dur, vel = 0.8, out = null, art = null) {
    const ctx = this.ctx || this.ensure();
    out = out || this.live;
    t = Math.max(t, ctx.currentTime);
    const f = freq(p), fn = { piano: this._piano, xylo: this._mallet, marimba: this._mallet, recorder: this._recorder, gayageum: this._gayageum, bass: this._bass, pad: this._pad,
      // [MUSIC-ORCH-1] 오케스트라 악기
      violin: this._violin, strings: this._strings, cello: this._cello, contrabass: this._contrabass, pizz: this._pizz,
      flute: this._flute, clarinet: this._clarinet, oboe: this._oboe, trumpet: this._trumpet, horn: this._horn, tuba: this._tuba,
      harp: this._harp, celesta: this._celesta, glock: this._glock, choir: this._choir, timpani: this._timpani }[inst] || this._piano;
    return fn.call(this, f, t, Math.max(0.05, dur), vel, out, inst, art);
  }
  // [MUSIC-ORCH-1] 뜯는 소리(하프 · 피치카토) 줄 버퍼를 미리 만든다 — 틀기 전에 한 번(재생 중에 만들다 박이 늦지 않게)
  prewarm(events) {
    if (!this.ctx || !events) return;
    for (const e of events) if (e.kind === 'note' && (e.inst === 'harp' || e.inst === 'pizz')) this._pluckBuf(freq(e.p), e.inst);
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

  // ── 오케스트라 악기 [MUSIC-ORCH-1] ──
  //  크기: 한 음(세기 0.85)의 꼭대기가 피아노 한 음과 비슷하게(0.3~0.6) · 반주로 쓸 때는 편곡(orchestra.js)이 세기를 낮게 준다 → 다 합쳐도 compressor 아래에서 1.0 을 안 넘게
  //  노드 수: 음마다 4~12개(합창이 가장 많다) · 다 울리면 스스로 멈춘다(stop 시각)
  //  활로 긋거나 부는 소리의 크기 — 천천히 커졌다가(att) 이어지고 손을 떼면 줄어든다(rel) · art 'swell' = 음 끝까지 점점 크게 · 'stacc' = 짧고 또렷하게(왈츠 '짝' · 행진곡 엇박) → 다 사라지는 때
  _bowEnv(g, t, dur, peak, att, rel, art) {
    const end = t + dur;
    if (art === 'stacc') { att = Math.min(att, 0.03); rel = Math.min(rel, 0.07); }
    att = Math.min(att, dur * 0.6);
    g.gain.setValueAtTime(0, t);
    if (art === 'swell') { g.gain.linearRampToValueAtTime(peak * 0.28, t + att); g.gain.linearRampToValueAtTime(peak, t + Math.max(att + 0.02, dur * 0.9)); }
    else { g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setTargetAtTime(peak * 0.8, t + att, 0.3); }
    g.gain.setTargetAtTime(0, end, rel);
    return end + rel * 7;
  }
  //  떨림(비브라토) — 길게 끄는 음에만 · 조금 늦게 시작해 천천히 깊어진다(사람이 켜고 부는 것처럼) · cents = 떨리는 깊이
  _vibrato(t, dur, oscs, cents, rate, delay, stopAt) {
    if (dur < 0.45 || !cents) return [];
    const lfo = this._osc('sine', rate * (0.97 + Math.random() * 0.06), t), lg = this.ctx.createGain();
    const on = t + Math.min(delay, dur * 0.4);
    lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, on); lg.gain.linearRampToValueAtTime(cents, Math.min(t + dur, on + 0.4));
    lfo.connect(lg); for (const o of oscs) lg.connect(o.detune);
    lfo.start(t); lfo.stop(stopAt);
    return [lfo];
  }
  _filt(type, fq, q = 0.7, gain = 0) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = fq; b.Q.value = q; if (gain) b.gain.value = gain; return b; }
  //  여러 발진기를 한 줄로 이어 소리 내기 — parts = [[모양, 배수, 크기, 센트]] → 발진기 목록
  _oscs(parts, f, t, dest) {
    return parts.map(([type, k, a, c]) => {
      const o = this._osc(type, f * k, t); if (c) o.detune.setValueAtTime(c, t);
      if (a === 1) o.connect(dest); else { const og = this.ctx.createGain(); og.gain.value = a; o.connect(og).connect(dest); }
      return o;
    });
  }
  //  짧은 숨 · 활 소리(띠 잡음) — 시작에만 살짝(엔벨로프 밖에서 out 으로)
  _breath(t, len, fq, q, a, out) {
    const n = this._noise(t, len + 0.02), bp = this._filt('bandpass', fq, q), g = this.ctx.createGain();
    g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(bp).connect(g).connect(out);
  }

  //  바이올린(혼자) — 톱니파 + 브리지 언덕(2.6kHz) · 활 긁는 소리 · 늦게 오는 떨림
  _violin(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), body = this._filt('peaking', 2600, 1.1, 5), lp = this._filt('lowpass', Math.min(9000, f * 9), 0.5);
    const os = this._oscs([['sawtooth', 1, 1]], f, t, body);
    body.connect(lp).connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.31, 0.06, 0.12, art);
    const vib = this._vibrato(t, dur, os, 16, 5.6, 0.22, fin);
    this._breath(t, 0.1, Math.min(6000, f * 4), 1.2, vel * 0.035, out);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, [...os, ...vib], 0.12, fin);
  }
  //  현악 합주(여럿) — 조금씩 어긋난 톱니파 셋(합주 느낌) · 천천히 시작(활을 여럿이 함께)
  _strings(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), lp = this._filt('lowpass', Math.min(5200, f * 5), 0.4);
    const os = this._oscs([['sawtooth', 1, 1, -9], ['sawtooth', 1, 1, 0], ['sawtooth', 1, 1, 8]], f, t, lp);
    lp.connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.13, 0.16, 0.28, art);
    const vib = this._vibrato(t, dur, [os[0], os[2]], 9, 5, 0.3, fin);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, [...os, ...vib], 0.28, fin);
  }
  //  첼로 — 톱니 + 세모(따뜻한 몸통 420Hz)
  _cello(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), body = this._filt('peaking', 420, 0.9, 4), lp = this._filt('lowpass', Math.min(4200, f * 7), 0.5);
    const os = this._oscs([['sawtooth', 1, 1], ['triangle', 1, 0.6]], f, t, body);
    body.connect(lp).connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.22, 0.07, 0.14, art);
    const vib = this._vibrato(t, dur, os, 15, 5.2, 0.28, fin);
    this._breath(t, 0.08, Math.min(3000, f * 5), 1, vel * 0.03, out);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, [...os, ...vib], 0.14, fin);
  }
  //  콘트라베이스 — 가장 낮은 현 · 작은 스피커에서도 들리게 배음을 1.6kHz 까지 남긴다
  _contrabass(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), lp = this._filt('lowpass', Math.min(1600, f * 6), 0.6);
    const os = this._oscs([['sawtooth', 1, 1], ['triangle', 2, 0.35]], f, t, lp);
    lp.connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.3, 0.06, 0.16, art);
    const vib = this._vibrato(t, dur, os, 8, 4.8, 0.35, fin);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, [...os, ...vib], 0.16, fin);
  }
  //  뜯는 줄 버퍼(Karplus-Strong) — 하프 = 길게 둥글게 · 피치카토 = 짧게. 22050Hz 로 만들어 메모리를 반으로 · 음 높이는 playbackRate 로 맞춘다
  //   kind 마다 · 음마다 한 번만 만들어 둔다(48개 넘으면 오래된 것부터 버림)
  _pluckBuf(f, kind) {
    const key = kind + Math.round(f * 10);
    if (this._pk.has(key)) return this._pk.get(key);
    const harp = kind === 'harp', sr = 22050, len = Math.floor(sr * (harp ? 2.2 : 1.0));
    const N = Math.max(2, Math.round(sr / f - 0.5));
    const T40 = harp ? Math.max(0.9, Math.min(3.0, 3.2 - f / 600)) : Math.max(0.25, Math.min(0.8, 1.0 - f / 1500));   // −40dB 까지 걸리는 초(높은 음일수록 빨리)
    const decay = Math.pow(10, -2 / (f * T40));
    const buf = this.ctx.createBuffer(1, len, sr), y = buf.getChannelData(0);
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; a = (a + r) * 0.5; b = harp ? (b + a) * 0.5 : a; y[i] = b * (harp ? 1.6 : 1.2); }   // 하프는 두 번 고른 잡음(둥근 손가락)
    for (let i = N; i < len; i++) y[i] = decay * 0.5 * (y[i - N] + y[i - N - 1 < 0 ? 0 : i - N - 1]);
    const out = { buf, rate: f * (N + 0.5) / sr, len: len / sr / (f * (N + 0.5) / sr) };
    this._pk.set(key, out);
    if (this._pk.size > 48) this._pk.delete(this._pk.keys().next().value);
    return out;
  }
  _plucked(f, t, vel, out, kind, lpHz, gainK) {
    const ctx = this.ctx, pb = this._pluckBuf(f, kind), src = ctx.createBufferSource(), g = ctx.createGain(), lp = this._filt('lowpass', lpHz, 0.6);
    src.buffer = pb.buf; src.playbackRate.value = pb.rate;
    if (kind === 'pizz') { lp.frequency.setValueAtTime(Math.min(8000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, lpHz), t + 0.12); }
    const end = t + pb.len;
    g.gain.setValueAtTime(vel * gainK, t); g.gain.setTargetAtTime(0, end - 0.3, 0.07);
    src.connect(lp).connect(g).connect(out); src.start(t); src.stop(end);
    return this._handle(g, [src], 0.08, end);
  }
  //  피치카토 — 활 대신 손가락으로 줄을 퉁김(짧게) · 하프 — 47줄을 뜯는 소리(길게 울림 · 음 길이와 상관없이)
  _pizz(f, t, dur, vel, out) { return this._plucked(f, t, vel, out, 'pizz', Math.min(3600, f * 4), 1.0); }
  _harp(f, t, dur, vel, out) { return this._plucked(f, t, vel, out, 'harp', Math.min(7000, f * 8), 0.85); }
  //  플루트 — 사인 + 약한 세모 · 숨소리(띠 잡음)가 처음엔 크게 · 늦게 오는 떨림
  _flute(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), lp = this._filt('lowpass', Math.min(7000, f * 5), 0.5);
    const os = this._oscs([['sine', 1, 1], ['triangle', 1, 0.25], ['sine', 2, 0.08]], f, t, lp);
    lp.connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.32, 0.05, 0.08, art);
    const vib = this._vibrato(t, dur, os.slice(0, 2), 14, 5.1, 0.2, fin);
    const n = this._noise(t, dur + 0.1), bp = this._filt('bandpass', Math.min(7000, f * 1.8), 0.8), ng = this.ctx.createGain();   // 숨소리
    ng.gain.setValueAtTime(vel * 0.06, t); ng.gain.setTargetAtTime(vel * 0.012, t + 0.03, 0.05); ng.gain.setTargetAtTime(0, t + dur, 0.03);
    n.connect(bp).connect(ng).connect(out);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, [...os, ...vib, n], 0.08, fin);
  }
  //  클라리넷 — 네모파(홀수 배음 = 클라리넷 결) · 떨림 없이 곧게
  _clarinet(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), lp = this._filt('lowpass', Math.min(3800, f * 4), 0.8);
    const os = this._oscs([['square', 1, 1]], f, t, lp);
    lp.connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.18, 0.035, 0.07, art);
    this._breath(t, 0.05, Math.min(5000, f * 3), 1, vel * 0.02, out);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, os, 0.07, fin);
  }
  //  오보에 — 톱니파에서 바닥음을 덜고(하이패스) 1.3kHz 를 키운 콧소리 · 떨림
  _oboe(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), hp = this._filt('highpass', f * 0.9, 0.5), pk = this._filt('peaking', 1300, 1.4, 9), lp = this._filt('lowpass', Math.min(7000, f * 7), 0.5);
    const os = this._oscs([['sawtooth', 1, 1]], f, t, hp);
    hp.connect(pk).connect(lp).connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.17, 0.03, 0.08, art);
    const vib = this._vibrato(t, dur, os, 12, 5.6, 0.25, fin);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, [...os, ...vib], 0.08, fin);
  }
  //  트럼펫 — 처음에 밝게 열렸다 가라앉는 필터 · 살짝 아래에서 올라붙는 음(스쿱) · 긴 음엔 떨림
  _trumpet(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), lp = this._filt('lowpass', f * 1.5, 1.2);
    const os = this._oscs([['sawtooth', 1, 1]], f, t, lp);
    os[0].detune.setValueAtTime(-45, t); os[0].detune.linearRampToValueAtTime(0, t + 0.05);
    if (art === 'swell') { lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(Math.min(8000, f * 5), t + dur * 0.9); }
    else { lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(Math.min(9000, f * (5 + vel * 3)), t + 0.035); lp.frequency.setTargetAtTime(Math.min(6500, f * 3.6), t + 0.04, 0.2); }
    lp.connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.26, 0.02, 0.07, art);
    const vib = this._vibrato(t, dur, os, 10, 5.6, 0.35, fin);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, [...os, ...vib], 0.07, fin);
  }
  //  호른 — 동그랗게 말린 관 · 부드럽게 닫힌 소리(필터 낮게) · 두 대가 함께 부는 듯 살짝 어긋남
  _horn(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), lp = this._filt('lowpass', Math.min(2200, f * 3.2), 0.7);
    const os = this._oscs([['sawtooth', 1, 1], ['sawtooth', 1, 0.7, 4]], f, t, lp);
    if (art === 'swell') { lp.frequency.setValueAtTime(Math.min(1400, f * 1.6), t); lp.frequency.linearRampToValueAtTime(Math.min(2600, f * 3.2), t + dur * 0.9); }
    else lp.frequency.setTargetAtTime(Math.min(1500, f * 2.2), t + 0.06, 0.15);
    lp.connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.27, 0.06, 0.14, art);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, os, 0.14, fin);
  }
  //  튜바 — 가장 낮은 금관 · 붕붕(배음은 1kHz 까지만)
  _tuba(f, t, dur, vel, out, inst, art) {
    const g = this.ctx.createGain(), lp = this._filt('lowpass', Math.min(1000, f * 4.5), 0.6);
    const os = this._oscs([['sawtooth', 1, 1], ['sine', 1, 0.8]], f, t, lp);
    os[0].detune.setValueAtTime(-25, t); os[0].detune.linearRampToValueAtTime(0, t + 0.04);
    lp.connect(g).connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.3, 0.045, 0.1, art);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, os, 0.1, fin);
  }
  //  쇠막대를 치는 소리 — parts = [[배수, 크기, 줄어드는 시간]] · damp = 음이 끝나면 멈춤(첼레스타 = 건반 · 글로켄슈필은 그냥 울림)
  _bell(f, t, dur, vel, out, parts, peak, damp, click) {
    const ctx = this.ctx, g = ctx.createGain();
    const ring = Math.max(...parts.map(x => x[2])) * 6;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * peak, t + 0.003);
    const end = damp ? t + Math.max(0.3, dur) + 0.06 : t + ring;
    if (damp) g.gain.setTargetAtTime(0, end, 0.12);
    const fin = damp ? Math.min(t + ring, end + 0.8) : t + ring;
    const os = parts.map(([k, a, tau]) => {
      const o = this._osc('sine', f * k, t), og = ctx.createGain();
      og.gain.setValueAtTime(a, t); og.gain.setTargetAtTime(0, t + 0.003, tau);
      o.connect(og).connect(g); o.start(t); o.stop(fin); return o;
    });
    if (click) { const n = this._noise(t, 0.02), hp = this._filt('highpass', 4200, 0.7), cg = ctx.createGain(); cg.gain.setValueAtTime(vel * click, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.015); n.connect(hp).connect(cg).connect(g); }
    g.connect(out);
    return this._handle(g, os, 0.06, fin);
  }
  //  첼레스타 — 건반을 누르면 작은 망치가 쇠막대를 친다(요정 소리) · 글로켄슈필 — 쇠막대 실로폰(막대 배음 2.76 · 5.4)
  _celesta(f, t, dur, vel, out) { return this._bell(f, t, dur, vel, out, [[1, 1, 0.75], [2, 0.18, 0.28], [4, 0.07, 0.1]], 0.33, true, 0); }
  _glock(f, t, dur, vel, out) { return this._bell(f, t, dur, vel, out, [[1, 1, 0.55], [2.76, 0.3, 0.22], [5.4, 0.1, 0.08]], 0.27, false, 0.1); }
  //  합창 '아~' — 어긋난 톱니파 둘 → 모음 '아'의 소리 봉우리(포먼트 850 · 1250 · 2850Hz) + 바닥음 길
  _choir(f, t, dur, vel, out, inst, art) {
    const ctx = this.ctx, g = ctx.createGain(), sum = ctx.createGain();
    const os = this._oscs([['sawtooth', 1, 1], ['sawtooth', 1, 1, 7]], f, t, sum);
    for (const [fq, q, a] of [[850, 7, 1], [1250, 9, 0.55], [2850, 11, 0.28]]) { const bp = this._filt('bandpass', fq, q), fg = ctx.createGain(); fg.gain.value = a; sum.connect(bp).connect(fg).connect(g); }
    const lp = this._filt('lowpass', Math.min(1200, f * 2.5), 0.5), lg = ctx.createGain(); lg.gain.value = 0.3; sum.connect(lp).connect(lg).connect(g);
    g.connect(out);
    const fin = this._bowEnv(g, t, dur, vel * 0.6, 0.14, 0.3, art);
    const vib = this._vibrato(t, dur, os, 12, 5.2, 0.3, fin);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, [...os, ...vib], 0.3, fin);
  }
  //  팀파니 — 음 높이가 있는 큰 북(막 배음 1 · 1.5 · 1.98) · 말렛 '퉁' · art 'roll' = 빠르게 굴려 길게(점점 크게)
  _timpani(f, t, dur, vel, out, inst, art) {
    const ctx = this.ctx, g = ctx.createGain(), roll = art === 'roll';
    const os = [[1, 1], [1.505, 0.42], [1.985, 0.2]].map(([k, a], i) => {
      const o = this._osc('sine', f * k * (i ? 1 : 1.02), t), og = ctx.createGain();
      if (!i) o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
      og.gain.setValueAtTime(a, t); if (i && !roll) og.gain.setTargetAtTime(0, t + 0.004, 0.28);
      o.connect(og).connect(g); return o;
    });
    let fin;
    const thud = this._noise(t, roll ? dur + 0.1 : 0.08), lp = this._filt('lowpass', roll ? 520 : 700, 0.7), ng = ctx.createGain();
    if (roll) {
      g.gain.setValueAtTime(vel * 0.14, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + Math.max(0.05, dur * 0.9)); g.gain.setTargetAtTime(0, t + dur, 0.22);
      ng.gain.setValueAtTime(vel * 0.05, t); ng.gain.linearRampToValueAtTime(vel * 0.16, t + Math.max(0.05, dur * 0.9)); ng.gain.setTargetAtTime(0, t + dur, 0.12);
      const lfo = this._osc('sine', 12.5, t), lg = ctx.createGain(); lg.gain.setValueAtTime(vel * 0.1, t);   // 굴림(빠른 떨림)
      lfo.connect(lg); lg.connect(g.gain); lg.connect(ng.gain);
      fin = t + dur + 1.6; os.push(lfo);
    } else {
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.55, t + 0.004); g.gain.setTargetAtTime(0, t + 0.006, 0.5);
      ng.gain.setValueAtTime(vel * 0.3, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      fin = t + 3.2;
    }
    thud.connect(lp).connect(ng).connect(out);
    g.connect(out);
    for (const o of os) { o.start(t); o.stop(fin); }
    return this._handle(g, os, 0.15, fin);
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
      // [MUSIC-ORCH-1] 오케스트라 타악기 — 심벌즈(챙 · 길게 퍼짐) · 큰북(둥 · 작은 스피커용 배음 96Hz) · 트라이앵글(팅~) · 서스펜디드 심벌 부풂(span 초 동안 점점 크게)
      case 'cymbal': this._hiss(t, vel * 0.3, out, 'highpass', 4500, 2.4, 0.4); this._hiss(t, vel * 0.2, out, 'bandpass', 8500, 0.5, 0.7); return this._hiss(t, vel * 0.14, out, 'bandpass', 3200, 0.9, 1.2);
      case 'bassdrum': this._thump(t, vel * 0.8, out, 78, 42, 1.2); this._tone(t, vel * 0.26, out, 96, 0.45); return this._hiss(t, vel * 0.18, out, 'lowpass', 280, 0.5);
      case 'triangle': this._hiss(t, vel * 0.08, out, 'highpass', 6000, 0.02); return this._ring(t, vel, out, [[2640, 0.09], [4520, 0.06], [6980, 0.04]], 1.8);
      case 'swell': return this._swell(t, vel, out, span);
    }
  }
  _ring(t, vel, out, parts, len) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    for (const [fq, a] of parts) { const o = this._osc('sine', fq, t), og = this.ctx.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + len + 0.02); }
    g.connect(out);
  }
  _swell(t, vel, out, span) {
    const len = Math.max(0.4, span || 1), n = this._noise(t, len + 0.6), hp = this._filt('highpass', 3800, 0.6), g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.22, t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.5);
    n.connect(hp).connect(g).connect(out);
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
    this.e.prewarm && this.e.prewarm(events);   // [MUSIC-ORCH-1] 하프 · 피치카토 줄 버퍼를 시작 시각을 정하기 전에
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
    if (ev.kind === 'note') this.e.note(ev.inst, ev.p, t, ev.d, ev.vel, this.bus, ev.art);   // art = 연주법(오케스트라 · 없으면 보통) [MUSIC-ORCH-1]
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
