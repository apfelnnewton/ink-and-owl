/* Letters from the former owners of Borgin's things (2026-10-16 user decision, docs/plan-borgin-letters.md; words in
   bond/owners.json). Two days after a thing is bought, somebody who used to own it writes: a letter a day for three days,
   the guest answering each from three replies under the letter (the next letter begins with what that reply drew out);
   the third reply decides how it ends — SOLD (the thing leaves the shelf for good and its price comes into the purse;
   the price haggled for, if the guest haggled), KEPT, or a THIRD course (a visit paid for, a paper received, a small
   fee, or a swap for another thing). The day after the last reply comes the correspondent's last note; Mr Borgin has
   his word at the next visit.
   - One correspondent at a time, in the order the things were bought (user Q2 가). Things bought before this came in
     get their letters in turn from the day after it arrived (Q3 가). The letters stay in the post under "Borgin and
     Burkes" (Q1 가).
   - A place on the shelf that has fallen empty is filled, at the next visit, by one of six spare things Mr Borgin
     brings out: the key, the inkwell, the plan — and the dice, the barometer and the bell, which otherwise arrive by
     way of a swap (cards → dice, candle → barometer, rope → bell) and come out as spares only after that letter ended
     without the swap. Spare things have their former owners too.
   state.shop.ow = {q: [{id, from}], cur: {id, step, d, picks: [], price}, done: {id: {end, d}}, news: [{id, end}],
                    papers: {id: d}, gone: {id: d}, out: [spare ids brought out], said: [spare ids introduced],
                    lastEnd: d, began: d}       (id = the thing's key: eye, cards … dice, key …)
   Post keys under 'borgin': OL~<key>~0|1|2 the three letters, OL~<key>~end the last note.   ?owners: tomorrow is today */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';

export const ID = 'borgin';
export const DESK = {id: ID, ko: '보긴 앤 버크스', place: 'borgin'};   // the post tab (letters.js)
const SICKLE = 29;
export const SPARES = ['key', 'inkwell', 'map'];
export const SWAPS = {cards: 'dice', candle: 'barometer', rope: 'bell'};
let DATA = null;
export const load = () => DATA ? Promise.resolve(DATA) : fetch('bond/owners.json').then(r => r.ok ? r.json() : null).then(j => (DATA = j)).catch(() => null);
export const data = () => DATA;
const st = () => { const s = store.get(), m = s.shop || (s.shop = {}); const o = m.ow || (m.ow = {}); o.q = o.q || []; o.done = o.done || {}; o.news = o.news || []; o.papers = o.papers || {}; o.gone = o.gone || {}; o.out = o.out || []; o.said = o.said || []; return o; };
export const state = st;
const today = () => srs.today();
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv-SE'); };
const test = () => new URLSearchParams(location.search).has('owners');

/* the shop's bookkeeping (shops.js asks through these) */
export const gone = key => !!st().gone[key];
export const isOut = key => st().out.includes(key);
export const paperOf = key => st().papers[key] || null;
export const ended = key => st().done[key] || null;
export const writing = key => { const c = st().cur; return c && c.id === key ? c : null; };
export const queued = key => st().q.some(x => x.id === key);

/* a thing has come into the guest's hands (bought, or arrived by a swap): its former owner will write — two days on */
export function bought(key){
  const o = st(); if (o.done[key] || queued(key) || (o.cur && o.cur.id === key)) return;
  o.q.push({id: key, from: addDays(today(), 2)});
}

/* the three letters and the last note, as the post shows them */
export function textOf(key){
  const m = key.match(/^OL~([a-z]+)~(0|1|2|end)$/); if (!m || !DATA) return null;
  const c = DATA[m[1]], o = st(); if (!c) return null;
  const rec = (o.cur && o.cur.id === m[1]) ? o.cur : (o.done[m[1]] ? o.done[m[1]] : null);
  const picks = rec ? rec.picks || [] : [];
  const keys = n => n && n.keys ? n.keys : {};
  const thing = {key: m[1]};
  if (m[2] === 'end'){
    const end = o.done[m[1]] && o.done[m[1]].end; if (!end) return null;
    const n = c.ends[end].note;
    return {kind: '마지막 쪽지', en: n.en, ko: n.ko, keys: keys(n), from: c.from, title: c.title, thing, owner: {key: m[1], step: 3}};
  }
  const k = +m[2], t = c.turns[k], before = k > 0 && picks[k - 1] != null ? c.turns[k - 1].options[picks[k - 1]].open : null;
  return {kind: '편지', en: (before ? before.en + '\n\n' : '') + t.body.en, ko: (before ? before.ko + '\n\n' : '') + t.body.ko,
    keys: {...keys(before), ...keys(t.body)}, from: c.from, title: c.title, thing, owner: {key: m[1], step: k}, offer: t.offer || 0};
}
/* the replies under a letter: offered while it is the letter waiting for an answer; once answered, the one sent */
export function replies(key, step){
  const c = DATA && DATA[key], o = st(); if (!c || step > 2) return null;
  const cur = o.cur && o.cur.id === key ? o.cur : null, rec = cur || o.done[key];
  const picked = rec && rec.picks ? rec.picks[step] : null;
  const open = !!cur && cur.step === step && picked == null;
  return {open, picked: picked == null ? null : picked, options: c.turns[step].options};
}
/* the guest answers: kept; the next letter (or the last note) comes tomorrow */
export function answer(key, step, i){
  const o = st(), c = DATA && DATA[key], cur = o.cur;
  if (!c || !cur || cur.id !== key || cur.step !== step || cur.picks[step] != null) return false;
  const opt = c.turns[step].options[i]; if (!opt) return false;
  cur.picks[step] = i;
  if (opt.price) cur.price = opt.price;
  if (step === 2) cur.end = opt.end;
  store.save();
  return true;
}

/* the money, the shelf and the paper an ending leaves */
function settle(key, end, cur, earn){
  const o = st(), c = DATA[key], t = today();
  if (end === 'sold'){ earn((cur.price || c.turns[1].offer) * SICKLE); o.gone[key] = t; }
  else if (end === 'third'){
    const x = c.ends.third;
    if (x.kind === 'visit' || x.kind === 'fee') earn((x.gain || 0) * SICKLE);
    if (x.kind === 'paper') o.papers[key] = t;
    if (x.kind === 'swap' && x.swap){ o.gone[key] = t; return x.swap; }   // the thing that comes in its place
  }
  return null;
}

/* each day (bond.daily, through shops.daily): a letter moves on, or a new correspondent begins */
export async function daily({owned, earn, arrive, room}){
  await load(); if (!DATA) return;
  const o = st(), t = today(), ahead = test();
  /* things bought before the letters came in: their owners write in turn, from tomorrow (Q3 가) */
  if (!o.began){ o.began = t; for (const k of owned()) if (!o.done[k] && !queued(k)) o.q.push({id: k, from: addDays(t, 1)}); }
  const due = d => d < t || ahead;
  const cur = o.cur;
  if (cur && o.done[cur.id]){ o.cur = null; }   // settled already (a half-finished day): never paid twice
  else if (cur && due(cur.d) && cur.picks[cur.step] != null){
    if (cur.step < 2){ cur.step++; cur.d = t; store.save(); bond.postItem(ID, `OL~${cur.id}~${cur.step}`); }
    else {
      /* the record is complete and saved before anything else happens, so that nothing can be settled twice */
      const swapIn = settle(cur.id, cur.end, cur, earn);
      o.done[cur.id] = {end: cur.end, d: t, picks: cur.picks.slice(), price: cur.price || 0};
      o.news.push({id: cur.id, end: cur.end});
      /* a swap left undone: the thing it would have brought can now come out as a spare */
      if (SWAPS[cur.id] && cur.end !== 'third') o.spareOk = [...new Set([...(o.spareOk || []), SWAPS[cur.id]])];
      o.cur = null; o.lastEnd = t;
      if (swapIn) arrive(swapIn);
      store.save();
      bond.postItem(ID, `OL~${cur.id}~end`);
    }
  } else if (!cur && o.q.length && (!o.lastEnd || due(o.lastEnd))){
    o.q.sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
    const nx = o.q[0];
    if (nx.from <= t || ahead){
      o.q.shift();
      o.cur = {id: nx.id, step: 0, d: t, picks: []};
      bond.postItem(ID, `OL~${nx.id}~0`);
    }
  }
  /* a place on the shelf fallen empty (and not filled by a swap, nor waiting for a spare already on the counter): a spare
     is brought out, shown at the next visit. room() = how many such places (shops.js) */
  const next = () => [...SPARES, ...(o.spareOk || [])].find(k => !o.out.includes(k) && !owned().includes(k) && !o.gone[k]);
  for (let n = room(); n > 0 && next(); n--) o.out.push(next());
  store.save();
}

/* what Mr Borgin has to say first at a visit: how a correspondence ended, then a spare he has brought out */
export function borginWord(){
  if (!DATA) return null;
  const o = st();
  if (o.news.length){ const n = o.news.shift(); store.save(); const c = DATA[n.id]; return c ? c.ends[n.end].borgin : null; }
  const k = o.out.find(x => !o.said.includes(x));
  if (k){ o.said.push(k); store.save(); const c = DATA[k]; return c && c.extra ? c.extra.intro : null; }
  return null;
}
