/* Small sound effects made in the browser (Web Audio), no files (2026-10-06): the Howler's paper tearing open, the low
   rumble under its voice, and the fire that takes it. Only after a tap (browsers need a gesture to make sound), and
   only when the learner chose "소리 내어 열기". */
let ctx = null;
const ac = () => {
  if (!ctx){ const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
/* white or brown noise, `sec` long */
function noise(c, sec, brown){
  const n = Math.max(1, Math.round(c.sampleRate * sec)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++){
    const w = Math.random() * 2 - 1;
    if (brown){ last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  const s = c.createBufferSource(); s.buffer = buf; return s;
}

/* thick paper torn open: a bright rip, a flap, a low thump */
export function rip(){
  const c = ac(); if (!c) return;
  const t = c.currentTime, out = c.createGain(); out.gain.value = .55; out.connect(c.destination);
  const r = noise(c, .45), bp = c.createBiquadFilter(), g = c.createGain();
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(1600, t); bp.frequency.exponentialRampToValueAtTime(4200, t + .32); bp.Q.value = .9;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.9, t + .02);
  for (let k = 0; k < 7; k++) g.gain.setValueAtTime(.35 + Math.random() * .6, t + .03 + k * .045);   // the fibres giving way
  g.gain.exponentialRampToValueAtTime(.001, t + .45);
  r.connect(bp).connect(g).connect(out); r.start(t); r.stop(t + .5);
  const th = c.createOscillator(), tg = c.createGain();
  th.type = 'sine'; th.frequency.setValueAtTime(110, t + .05); th.frequency.exponentialRampToValueAtTime(45, t + .35);
  tg.gain.setValueAtTime(0, t + .05); tg.gain.linearRampToValueAtTime(.5, t + .07); tg.gain.exponentialRampToValueAtTime(.001, t + .4);
  th.connect(tg).connect(out); th.start(t + .05); th.stop(t + .45);
}

/* a low, angry rumble that swells and trembles while the Howler speaks; returns stop() */
export function rumble(){
  const c = ac(); if (!c) return () => {};
  const t = c.currentTime, out = c.createGain();
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.32, t + .8); out.connect(c.destination);
  const b = noise(c, 4, true), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
  b.loop = true; b.connect(lp).connect(out); b.start(t);
  const o1 = c.createOscillator(), o2 = c.createOscillator(), og = c.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = 46; o2.type = 'sine'; o2.frequency.value = 69; og.gain.value = .07;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
  o1.connect(f); o2.connect(f); f.connect(og).connect(out); o1.start(t); o2.start(t);
  /* the tremble: a slow wobble in loudness */
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = .12;
  lfo.connect(lg).connect(out.gain); lfo.start(t);
  return () => {
    const e = c.currentTime; out.gain.cancelScheduledValues(e); out.gain.setValueAtTime(out.gain.value, e); out.gain.linearRampToValueAtTime(0, e + .6);
    [b, o1, o2, lfo].forEach(n => { try { n.stop(e + .7); } catch (x){} });
  };
}

/* the fire: a whoosh as it catches, a bed of roar, and crackles that thin out as the paper is gone (`sec` long) */
export function fire(sec = 4.5){
  const c = ac(); if (!c) return;
  const t = c.currentTime, out = c.createGain(); out.gain.value = .6; out.connect(c.destination);
  const w = noise(c, 1), wf = c.createBiquadFilter(), wg = c.createGain();
  wf.type = 'lowpass'; wf.frequency.setValueAtTime(250, t); wf.frequency.exponentialRampToValueAtTime(3500, t + .45);
  wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(.7, t + .25); wg.gain.exponentialRampToValueAtTime(.05, t + 1);
  w.connect(wf).connect(wg).connect(out); w.start(t); w.stop(t + 1);
  const r = noise(c, sec, true), rf = c.createBiquadFilter(), rg = c.createGain();
  rf.type = 'lowpass'; rf.frequency.value = 700;
  rg.gain.setValueAtTime(0, t + .1); rg.gain.linearRampToValueAtTime(.55, t + .6); rg.gain.linearRampToValueAtTime(.35, t + sec * .6); rg.gain.linearRampToValueAtTime(0, t + sec);
  r.connect(rf).connect(rg).connect(out); r.start(t + .1); r.stop(t + sec);
  /* crackles: short bright pops, many at first, fewer at the end */
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800; hp.connect(out);
  let at = .25;
  while (at < sec - .2){
    const k = 1 - at / sec, p = noise(c, .012 + Math.random() * .02), pg = c.createGain(), when = t + at;
    pg.gain.setValueAtTime(.25 + Math.random() * .7 * k, when); pg.gain.exponentialRampToValueAtTime(.001, when + .03);
    p.connect(pg).connect(hp); p.start(when);
    at += (.02 + Math.random() * .12) / Math.max(.25, k);
  }
}
