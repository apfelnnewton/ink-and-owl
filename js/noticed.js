/* "교수에게 들킨다" (2026-10-19 user decisions): one of Borgin's things carried home in the guest's bag is noticed, after
   one night, by the professor who would know it — whether or not their door has been opened — who writes (words in
   bond/noticed.json ← docs/newfaces-work/assemble-noticed.cjs). The guest answers with one of three replies; the next day
   comes the professor's closing note, the professor's regard moves with the reply (as at tea), and a consequence in
   character follows: kept by them a few days (Moody also returns an examination slip), handed back, a fine (Umbridge),
   bought (Slughorn: the thing is gone for good), lent (Slughorn, Dumbledore), or nothing (Lupin). Each thing once.
   The bag stands on the rug in the guest room while a thing is in it (myroom.js); the shelf leaves its place empty
   (shops.js onShelf).
   state.shop.nc = {carry: {key, d}, cur: {key, prof, d, pick, pd}, done: {key: {prof, pick, d}}, away: {key: {by, back}},
                    sold: {key: d}, papers: {key: d}}            (shop is synced whole: sync-core KEYS)
   Post keys under the professor: NC~<key>~0 the letter, NC~<key>~end the closing note.   ?noticed: the night passes at once */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';

const SICKLE = 29;
export const PROF = {eye: 'moody', rope: 'moody', hand: 'moody', candle: 'snape', opals: 'snape', shadows: 'snape',
  musicbox: 'umbridge', inkwell: 'umbridge', bell: 'umbridge', cards: 'mcgonagall', watch: 'mcgonagall',
  dice: 'slughorn', barometer: 'slughorn', mask: 'lupin', map: 'lupin', key: 'lupin', shell: 'dumbledore', mirror: 'dumbledore'};
const TASTE = {1: 8, 0: 3, '-1': -4};   // as at tea (bond.js TASTE_PTS)
let DATA = null;
export const data = () => DATA;
export const load = () => DATA ? Promise.resolve(DATA) : fetch('bond/noticed.json').then(r => r.ok ? r.json() : null).then(j => (DATA = j)).catch(() => null);
const st = () => { const s = store.get(), m = s.shop || (s.shop = {}); const o = m.nc || (m.nc = {}); o.done = o.done || {}; o.away = o.away || {}; o.sold = o.sold || {}; o.papers = o.papers || {}; return o; };
const today = () => srs.today();
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv-SE'); };
const quick = () => new URLSearchParams(location.search).has('noticed');

/* what the shop and the room ask */
export const carrying = () => st().carry || null;
export const inBag = key => !!(st().carry && st().carry.key === key);
export const away = key => st().away[key] || null;            // kept by a professor for now: {by, back} (back '' = until the reply)
export const sold = key => !!st().sold[key];                  // bought by Slughorn: gone for good
export const noticed = key => st().done[key] || null;
export const paper = key => st().papers[key] || null;          // Moody's examination slip came back with it
export const waiting = () => st().cur || null;                // a letter is out and the reply or the closing note is due
/* may this thing go in the bag? On the shelf, not noticed before, the bag empty and no professor's letter pending */
export const canCarry = key => !!PROF[key] && !st().carry && !st().cur && !st().done[key] && !st().away[key] && !st().sold[key];
/* the thing a letter is out about (in the bag, or already taken) */
export const pendingKey = () => st().cur ? st().cur.key : null;
export function carry(key){ if (!canCarry(key)) return false; st().carry = {key, d: today()}; store.save(); return true; }
/* back to Mr Borgin's shelf — only before anyone has noticed */
export function putBack(){ const o = st(); if (!o.carry || o.cur) return false; o.carry = null; store.save(); return true; }

/* the letter and the closing note, as the post shows them */
export function textOf(key){
  const m = key.match(/^NC~([a-z]+)~(0|end)$/); if (!m || !DATA || !DATA[m[1]]) return null;
  const c = DATA[m[1]], o = st();
  if (m[2] === 'end'){
    const d = o.done[m[1]]; if (!d) return null;
    const n = c.closing[d.pick] || {};
    return {kind: '답장', en: n.en, ko: n.ko, title: c.title, thing: {key: m[1]}, noticed: {key: m[1], step: 1}};
  }
  return {kind: '편지', en: c.letter.en, ko: c.letter.ko, keys: c.letter.keys || null, title: c.title, thing: {key: m[1]}, noticed: {key: m[1], step: 0}};
}
/* the replies under the letter: open while it waits; once answered, the one sent */
export function replies(key){
  const c = DATA && DATA[key], o = st(); if (!c) return null;
  const cur = o.cur && o.cur.key === key ? o.cur : null, done = o.done[key];
  const picked = cur ? cur.pick : done ? done.pick : null;
  return {open: !!cur && cur.pick == null, picked: picked == null ? null : picked, options: c.options};
}
export function answer(key, i){
  const o = st(), c = DATA && DATA[key];
  if (!c || !o.cur || o.cur.key !== key || o.cur.pick != null || !c.options[i]) return false;
  o.cur.pick = i; o.cur.pd = today(); store.save(); return true;   // the closing note the day after the reply
}

/* each day (bond.daily): things come back; a reply is answered and its consequence follows; a carried thing is noticed */
export async function daily({earn, take, purse, gone}){
  const o = st();
  if (!o.carry && !o.cur && !Object.keys(o.away).length) return;   // nothing in the bag, no letter out, nothing kept
  await load(); if (!DATA) return;
  const t = today(), due = d => d < t || quick();
  /* kept by a professor: back on the shelf on the day said (Moody's slip with it) */
  for (const [key, a] of Object.entries(o.away)) if (a.back && a.back <= t){ delete o.away[key]; if (a.by === 'moody') o.papers[key] = t; }
  const cur = o.cur;
  if (cur && cur.pick != null && due(cur.pd || cur.d)){
    const c = DATA[cur.key], opt = c.options[cur.pick], out = opt.out || {};
    /* the record first, so that nothing is settled twice */
    o.done[cur.key] = {prof: cur.prof, pick: cur.pick, d: t};
    o.cur = null; o.carry = null; delete o.away[cur.key];   // taken at the letter: now kept for the days said, or back at once
    if (out.held) o.away[cur.key] = {by: cur.prof, back: addDays(t, out.held)};
    if (out.fine) take(Math.min(out.fine * SICKLE, purse()));
    if (out.sell){ earn(out.sell * SICKLE); o.sold[cur.key] = t; gone(cur.key); }
    bond.gain(cur.prof, TASTE[opt.taste] || 0);
    store.save();
    bond.postItem(cur.prof, `NC~${cur.key}~end`);
  } else if (!cur && o.carry && due(o.carry.d)){
    const key = o.carry.key, prof = PROF[key]; if (!prof) return;
    o.cur = {key, prof, d: t, pick: null};
    /* a letter written with the thing already in the professor's hands (its `taken`): out of the bag now; otherwise it stays
       in the bag until the closing note */
    if (DATA[key].taken){ o.away[key] = {by: prof, back: ''}; o.carry = null; }
    store.save();
    bond.postItem(prof, `NC~${key}~0`);
  }
  store.save();
}
