/* Snape's potions lessons: which are open and what has been made (2026-10-14 user decision). The lesson itself is
   potion.js (#/potion/<n>); the recipes and his words are potions/potions.json.
   A year of his lines is film n + book n (the deck is learnt in that order). When every line of a year has been
   learnt, Snape's letter PO-<n> comes (one a day, the earliest year first) and opens that year's potion; its button
   goes to the dungeon. The key ingredient is bought at Slug & Jiggers; the very first time only, Snape lends it
   ("this once"), and the next day Dumbledore writes (PD) how to come by it — if the shops are not open yet.
   The best result of each potion is kept and the phial stands in the potion cabinet on the wall of the guest room.
   state.potions = {sent: {n: date}, best: {n: 'perfect'|'fair'}, lent: date the stores were borrowed from,
                    dd: date of Dumbledore's letter, day: date of the last letter}   ?potion=<n> sends that letter now */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as shops from './shops.js';

let DATA = null, CARDS = null;
export const load = () => DATA ? Promise.resolve(DATA) : fetch('potions/potions.json').then(r => r.ok ? r.json() : null).then(j => (DATA = j)).catch(() => null);
const cards = () => CARDS ? Promise.resolve(CARDS) : fetch('data/snape.json').then(r => r.ok ? r.json() : null).then(j => (CARDS = j)).catch(() => null);
export const st = () => { const s = store.get(), p = s.potions || (s.potions = {}); p.sent = p.sent || {}; p.best = p.best || {}; return p; };
export const potion = n => DATA ? DATA.potions.find(p => p.n === n) || null : null;
export const all = () => DATA ? DATA.potions : [];

/* the paper tag of each phial (measured by design/drafts/potions/labels.cjs: centre, size as fractions of the picture,
   turn in degrees). The goblet of year 3 has none: it gets a small tag of its own, tied to its stem (own) */
const LABELS = {
  'vial-boils': {x: .733, y: .484, w: .217, h: .274, rot: -26},
  'vial-polyjuice': {x: .768, y: .462, w: .201, h: .217, rot: -34},
  'vial-wolfsbane': {x: .5, y: .7, w: .34, h: .17, rot: -6, own: true},
  'vial-veritaserum': {x: .69, y: .366, w: .253, h: .191, rot: -21},
  'vial-peace': {x: .733, y: .545, w: .228, h: .227, rot: -35},
  'vial-living-death': {x: .759, y: .423, w: .223, h: .256, rot: -31},
  'vial-dittany': {x: .5, y: .696, w: .5, h: .181, rot: 0},
  'vial-empty': {x: .801, y: .456, w: .16, h: .244, rot: -29}   /* the one empty phial on Snape's door */
};
/* a Usable potion has a colour of its own, laid over the potion only (2026-10-16, the user chose one of three for each —
   under-done, clouded or overdone — in docs/usable-boils.html and docs/usable-options.html): BOWLS is where the potion
   is in each picture (centre and radii as fractions; pw, ph the picture's pixels, so the tag can be cut out of it at its
   true turn), UNDER the colour and how it is laid (blend mode, strength; dark: a little shadow over it too) */
const BOWLS = {
  'vial-boils': {x: .5, y: .70, rx: .43, ry: .27, pw: 360, ph: 640}, 'vial-polyjuice': {x: .45, y: .7, rx: .4, ry: .25, pw: 386, ph: 640},
  'vial-wolfsbane': {x: .5, y: .2, rx: .36, ry: .085, pw: 302, ph: 640}, 'vial-veritaserum': {x: .375, y: .6, rx: .19, ry: .37, pw: 224, ph: 640},
  'vial-peace': {x: .45, y: .73, rx: .4, ry: .24, pw: 328, ph: 640}, 'vial-living-death': {x: .43, y: .72, rx: .41, ry: .25, pw: 386, ph: 640},
  'vial-dittany': {x: .5, y: .69, rx: .38, ry: .27, pw: 234, ph: 640}
};
const UNDER = {
  'vial-boils': {c: '#e9c9cc', mode: 'color', o: .9},                 /* 1 under-done: barely blushing, a washed greyish pink */
  'vial-polyjuice': {c: '#8a8476', mode: 'normal', o: .5},             /* 2 clouded: settled into a murky grey-brown */
  'vial-wolfsbane': {c: '#5f7052', mode: 'color', o: .95, dark: .1},   /* 3 clouded: the blue gone a rusty grey-green */
  'vial-veritaserum': {c: '#d6bf7a', mode: 'normal', o: .45},          /* 4 clouded: yellowish, not clear */
  'vial-peace': {c: '#cdb57a', mode: 'normal', o: .5},                 /* 5 overdone: past the silver, a yellow cast */
  'vial-living-death': {c: '#7b5a9c', mode: 'color', o: 1, dark: .1},  /* 6 overdone: too deep a violet */
  'vial-dittany': {c: '#6b5232', mode: 'color', o: .9, dark: .1}       /* 7 clouded: a muddy brown, not deep green */
};
const masks = {};
function maskOf(k){
  if (masks[k]) return masks[k];
  const B = BOWLS[k], L = LABELS[k], PW = B.pw, PH = B.ph;
  let hole = '';
  if (L){ const a = L.rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), hw = L.w * PW * .62, hh = L.h * PH * .62;
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [((L.x * PW + x * c - y * sn) / PW * 100).toFixed(1), ((L.y * PH + x * sn + y * c) / PH * 100).toFixed(1)].join(',')).join(' ');
    hole = `<polygon points='${pts}' fill='black' filter='url(#b)'/>`; }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><filter id='b'><feGaussianBlur stdDeviation='1.4'/></filter><mask id='m'><rect width='100' height='100' fill='white'/>${hole}</mask></defs><ellipse cx='${B.x * 100}' cy='${B.y * 100}' rx='${B.rx * 100}' ry='${B.ry * 100}' fill='white' filter='url(#b)' mask='url(#m)'/></svg>`;
  return (masks[k] = `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}')`);
}
const escH = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
/* a phial with its name on its tag (2026-10-15, user chose: the potion's name, and under it the brewer's): src the
   picture, who the brewer (none on the empty phial Snape hangs on his door), usable: the duller colour of a Usable potion */
export function phial(src, name, who, usable){
  const k = src.split('/').pop().replace(/\.webp$/, ''), L = LABELS[k], U = usable && BOWLS[k] && UNDER[k];
  const tag = L ? `<span class="po-lbl${L.own ? ' own' : ''}" style="left:${L.x * 100}%;top:${L.y * 100}%;width:${L.w * 100}%;height:${L.h * 100}%;transform:translate(-50%, -50%) rotate(${L.rot}deg)"><b lang="en">${escH(name)}</b>${who ? `<i lang="en">${escH(who)}</i>` : ''}</span>` : '';
  const lay = (bg, mode, o) => `<span class="po-tint" style="background:${bg};mix-blend-mode:${mode};opacity:${o};-webkit-mask-image:${maskOf(k)};mask-image:${maskOf(k)}"></span>`;
  const tint = U ? lay(U.c, U.mode, U.o) + (U.dark ? lay('#000', 'normal', U.dark) : '') : '';
  return `<span class="po-ph${usable ? ' usable' : ''}"><img src="${src}" alt="">${tint}${tag}</span>`;
}
export const brewer = () => bond.fill('{name}');   /* as the result card calls the brewer */
const RANK = {fair: 1, perfect: 2};
export const best = n => st().best[n] || null;
export const isOpen = n => !!st().sent[n];

/* a year of Snape's lines, learnt to the last (cards with a record in the deck) */
function yearLearnt(n){
  if (!CARDS) return false;
  const ds = store.deck('snape').cards || {}, year = CARDS.filter(c => c.card !== false && c.film === n);
  return year.length > 0 && year.every(c => ds[c.id]);
}

/* called with the other daily letters (bond.daily) */
export async function daily(){
  if (!(await load()) || !(await cards())) return false;
  const p = st(), t = srs.today();
  /* the day after the stores were borrowed from: Dumbledore, if there is still no shop to buy from */
  if (p.lent && p.lent < t && !p.dd && !shops.isOpen() && bond.postItem('dumbledore', 'PD')){ p.dd = t; store.save(); }
  const force = +(new URLSearchParams(location.search).get('potion') || 0);
  if (p.day === t && !force) return false;
  for (const P of DATA.potions){
    if (p.sent[P.n] || P.ready === false) continue;   // a potion whose pictures are not drawn yet waits (potions.json, applypo.cjs)
    if (P.n !== force && !yearLearnt(P.n)) continue;
    bond.postItem('snape', 'PO-' + P.n);   /* false only if it went before: the record catches up, the later years are not held */
    p.sent[P.n] = t; p.day = t; store.save();
    return true;
  }
  return false;
}

/* the letters' words, for the post (bond.itemOf) */
export function textOf(id, key){
  if (!DATA) return null;
  if (key === 'PD') return id === 'dumbledore' && DATA.dumbledore ? {kind: '편지', ...DATA.dumbledore} : null;
  const P = potion(+key.slice(3)); if (!P || id !== 'snape') return null;
  return {kind: '조제 수업', en: P.letter.en, ko: P.letter.ko, go: '#/potion/' + P.n, btn: '지하 교실로 간다 · 조제 수업'};
}

/* a cauldron still stewing (its three days not up): its phial hangs on Snape's door, dull, until then */
export function stewing(){ const p = st(); if (!DATA) return null; return DATA.potions.find(P => p.sent[P.n] && !p.best[P.n] && stewLeft(P.n) > 0) || null; }

/* the phial on Snape's door in the corridor: a lesson whose letter has come and that has not been brewed yet (or whose
   cauldron, left to stew, is ready to be finished) */
export function waiting(){
  const p = st(); if (!DATA) return null;
  /* a cauldron whose three days are up comes first: it is half made, and it is the one the door should send them to */
  const open = DATA.potions.filter(P => p.sent[P.n] && !p.best[P.n] && !stewLeft(P.n));
  return open.find(P => stewOf(P.n)) || open[0] || null;
}

/* where the key ingredient comes from now: 'own' (in the bag), 'lend' (the first potion, for one who has no shop to
   buy from yet: Snape's stores, once — used up when the quills go in), 'none' */
export function source(P){
  const k = kept(P.n); if (k) return k;   /* already in a cauldron for this potion (Q3): no new one needed */
  if (shops.have(P.buy)) return 'own';
  const p = st();
  return P.n === 1 && !p.lent && !shops.isOpen() ? 'lend' : 'none';
}
/* the key ingredient once it has gone into a cauldron: kept on record until the potion is made, so that leaving and
   coming back (or the phone closing the app) does not cost a second one (2026-10-16, user: Q3 가) */
export const kept = n => (st().key || {})[n] || null;
export function keep(n, src){ const p = st(); p.key = p.key || {}; if (!p.key[n]){ p.key[n] = src === 'lend' ? 'lend' : 'own'; store.save(); } }
export function borrowed(){ const p = st(); if (!p.lent){ p.lent = srs.today(); store.save(); } }

/* a result: the better one is kept; the first potion of a kind brings Snape a little nearer (as a finished request) */
export function record(n, r){
  const p = st(), had = p.best[n];
  if (!had) bond.gain('snape', 20);
  unstew(n); if (p.key) delete p.key[n];
  p.done = p.done || {}; p.done[n] = Date.now();   /* when it was last made: a cauldron from before that is gone (sync) */
  if (!had || RANK[r] > RANK[had]) p.best[n] = r;
  store.save();
}

/* ---------- the potions brewed in two sittings (2026-10-15): the first ends with "leave it to stew for three days";
   what the cauldron holds is kept until then. stew[n] = {d: the day it was left, i: the next thing on the board,
   slips, marks, colour, used: whether the key ingredient has gone in} */
const STEW_DAYS = 3;
export const stewOf = n => (st().stew || {})[n] || null;
export function stew(n, v){ const p = st(); p.stew = p.stew || {}; p.stew[n] = v; store.save(); }
export function unstew(n){ const p = st(); if (p.stew && p.stew[n]){ delete p.stew[n]; store.save(); } }
/* days still to wait (0 = ready) */
export const stewLeft = n => { const s = stewOf(n); if (!s) return 0; let k = 0; while (k < STEW_DAYS && srs.addDays(s.d, k + 1) <= srs.today()) k++; return STEW_DAYS - k; };
