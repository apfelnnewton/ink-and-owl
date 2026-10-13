/* Bellatrix Lestrange, in the drawing room of Malfoy Manor (#/manor/drawing — the room itself is drawn by manor.js).
   She has taken Lucius's hired help for herself: the learner takes down what she says, word for word — that is the
   lesson (#/room/bellatrix: her lines from the films and the novels, one deck, the same ladder as a classroom).
   She pays no wages. A day's dictation with nothing wrong in it and she flicks one to three Sickles across the floor;
   when she changes what she calls the learner, a Galleon and some small thing of her own.
   She never becomes kind — she becomes possessive (2026-10-12 user decision: tsundere on the surface, possessive
   underneath). What shows is the name she uses, four of them, put wherever her texts say {you}:
     hireling → little scribe → my scribe → the learner's own first name
   The first three follow the bond's stages (bond.js: 80 and 250 points); the own name needs the fourth stage (600)
   AND the last of her twenty talks — T20 ends "I nearly said your name. Not today."
   The door opens after two days' work in the study (three until 2026-10-12; the user found it long): a scrap tucked into the glass cabinet (INTRO).
   Her post: notes L01 L04 L07 L19 L24 L30 L41 L48 (the common milestones), NAME2–NAME4 with K02–K04, everyday scraps
   P001–P017, scribbles across Lucius's labels S01–S12 (S01–S07 once that object's label is written, S08–S12 every
   fourth day of work in the study; one a day), and instead of a Howler two taunts each for 3, 7, 14, 30 days away
   (TN-<days>-<0|1>-<last day>). She also teaches Occlumency (spells.js, spell.js) once she says "my scribe" and
   the talk about her nephew (T12) has been had.
   state.manor.bella = {open, from: study days when she came, met, name: 0–3, tip: {d, s, v}, gal: {d, v}, scDay}
   ?bella in the address opens the drawing room at once (testing) */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as manor from './manor.js';
import {esc} from './ui.js';

const ID = 'bellatrix';
const NAMES = [['hireling', '일꾼'], ['little scribe', '꼬마 서기'], ['my scribe', '내 서기']];
const SICKLE = 29, GALLEON = 493, AWAY = [3, 7, 14, 30];
const st = () => { const s = store.get(), m = s.manor || (s.manor = {}); return m.bella || (m.bella = {}); };
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const pad2 = n => String(n).padStart(2, '0');
const between = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
export const isOpen = () => !!st().open;
export const met = () => !!st().met;
export const nameIndex = () => st().name || 0;
/* what she calls the learner now, in English or Korean */
export function you(ko){ const i = nameIndex(); return i >= 3 ? (store.get().settings.firstName || 'friend') : NAMES[i][ko ? 1 : 0]; }
const talks = () => Object.keys(bond.bondOf(ID).teas || {}).length;

/* ---------- the name moves up: a note, the thing that comes with it, and a Galleon across the floor */
export function nameCheck(){
  const m = st(); if (!m.open) return false;
  const s = bond.stage(ID), want = s >= 3 && talks() >= 20 ? 3 : Math.min(s, 2);
  let n = m.name || 0, moved = false;
  while (n < want){
    n++; m.name = n; moved = true;
    bond.postItem(ID, 'NAME' + (n + 1)); bond.postItem(ID, 'K0' + (n + 1));
    manor.earn(GALLEON); m.gal = {d: srs.today(), v: n};
  }
  return moved;
}
/* seated for the first time: the first talk is hers to begin at once, as with Sirius */
export function sit(){
  const m = st(); if (m.met) return;
  m.met = srs.today();
  const b = bond.bondOf(ID); if (!b.inv && !Object.keys(b.teas).length) b.inv = {src: 'fire', t: srs.today()};
  store.save();
}
/* Occlumency: she teaches it to her scribe, after the talk about her nephew's lessons */
export const occluReady = () => isOpen() && nameIndex() >= 2 && bond.bondOf(ID).teas.T12 !== undefined;

/* a flawless day: coins on the floor (the bond's own listener has run by now — it calls this module for the name) */
srs.hooks.push(ev => {
  if (ev.deckId !== ID || ev.kind || !ev.dayDone || !ev.dayPerfect) return;
  const m = st(), t = srs.today(); if (m.tip && m.tip.d === t) return;
  const s = 1 + hash(t + '|tip') % 3;
  manor.earn(s * SICKLE); m.tip = {d: t, s, v: hash(t + '|line')};
});

/* ---------- each day: the scrap that opens the room; scribbles in the study; taunts when the chair stays empty */
/* Her scrap, tucked into the cabinet: the door opens. Asked when the app starts (daily) and at the moment the second day's work in
   the study is finished (manor.js) — until 2026-10-13 only at the start, so a guest who had done the work saw nothing until the
   app happened to be opened afresh. → true if the door opened just now. */
export function arrive(){
  const m = st(), s = store.get(), mm = s.manor || {};
  if (m.open) return false;
  const force = new URLSearchParams(location.search).has('bella');
  if (!s.settings.named || !mm.open || !(force || (mm.days || 0) >= 2)) return false;
  if (!bond.loaded(ID) || !bond.postItem(ID, 'INTRO')) return false;
  m.open = srs.today(); m.from = mm.days || 0;
  store.save();
  return true;
}
export function daily(){
  const m = st(), t = srs.today(), mm = store.get().manor || {};
  if (!m.open){ arrive(); return; }
  nameCheck();
  const b = bond.bondOf(ID); if (!bond.loaded(ID)) return;
  if (b.days) bond.postItem(ID, 'K01');   // the ink comes with the first day's note
  /* a scribble only once she has had her scribe in front of her, and never on the day the door opened */
  if (m.met && t > m.open && m.scDay !== t){
    let key = '';
    for (let i = 1; i <= 7 && !key; i++) if (((mm.insp || {})[i] || {}).ok && !b.sent['S0' + i]) key = 'S0' + i;
    const more = Math.min(5, Math.floor(((mm.days || 0) - (m.from || 0)) / 4));
    for (let k = 1; k <= more && !key; k++) if (!b.sent['S' + pad2(7 + k)]) key = 'S' + pad2(7 + k);
    if (key && bond.postItem(ID, key)) m.scDay = t;
  }
  if (b.lastDay && s.settings.howler !== false){
    const gap = between(b.lastDay, t), lv = AWAY.filter(x => gap >= x).pop();
    if (lv) bond.postItem(ID, `TN-${lv}-${hash(b.lastDay + lv) % 2}-${b.lastDay}`);
  }
}

/* ---------- the words of her post (bond.itemOf); undefined = not hers alone, look it up the common way (gifts) */
export function textOf(key, d){
  if (!d) return null;
  let m;
  if (key === 'INTRO') return {kind: '쪽지', ...d.intro, go: '#/manor/drawing', btn: '응접실로 간다'};
  if (/^(L\d\d|NAME[234])$/.test(key)) return d.letters[key] ? {kind: '쪽지', ...d.letters[key]} : null;
  if (/^P\d{3}$/.test(key)) return d.posts[key] ? {kind: '쪽지', ...d.posts[key]} : null;
  if (/^S\d\d$/.test(key)) return d.scribbles[key] ? {kind: '서재 낙서', ...d.scribbles[key]} : null;
  if ((m = key.match(/^TN-(\d+)-(\d)-/))){ const t = (d.taunts || []).filter(x => x.days === +m[1])[+m[2]]; return t ? {kind: '쪽지', en: t.en, ko: t.ko, keys: t.keys} : null; }
  return undefined;
}
/* the scribble across one of Lucius's labels, once it is there (the glass cabinet shows it under the label) */
export function scribble(objectId){
  const d = bond.loaded(ID), k = 'S0' + objectId;
  return d && bond.bondOf(ID).sent[k] ? d.scribbles[k] : null;
}
/* her first words, in beats; what she says as coins or a Galleon cross the floor today */
export const firstWords = () => (bond.loaded(ID) || {}).first || [];
export function today(){
  const m = st(), d = bond.loaded(ID), t = srs.today(); if (!d) return {};
  const tip = m.tip && m.tip.d === t ? {s: m.tip.s, ...d.tips.sickles[m.tip.v % d.tips.sickles.length]} : null;
  const gal = m.gal && m.gal.d === t ? {...d.tips.galleon[(m.gal.v - 1) % d.tips.galleon.length]} : null;
  return {tip, gal};
}
/* the block for the end of the day's dictation (report.js) */
export function reportBlock(){
  const {tip, gal} = today(), say = l => `<div class="rx-say"><p class="q" lang="en">${esc(bond.fill(l.en))}</p><p class="k">${esc(bond.fill(l.ko))}</p></div>`;
  const purse = `<span>주머니 · ${esc(manor.money(manor.purse()))}</span>`;
  return (gal ? `<h2>새 호칭 · ${esc(you(true))}</h2>${say(gal)}<p class="mn-paid"><img src="assets/money/galleon.webp" alt=""><b>1갈레온</b>${tip ? '' : purse}</p>` : '') +
    (tip ? `<h2>바닥을 구르는 동전</h2>${say(tip)}<p class="mn-paid"><img src="assets/money/sickle.webp" alt=""><b>${tip.s}시클</b>${purse}</p>` : '');
}
