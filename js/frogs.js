/* Chocolate Frog cards (2026-10-19 user decision): every Chocolate Frog bought at Honeydukes brings one card, drawn at
   random from twenty since 2026-10-20 (ten until then; the same card can come again — user Q4 나). The frog itself still goes into the paper bag. The cards
   are kept in the guest room, in a "카드" drawer of the specimen cabinet (#/me/cabinet/cards, user Q3 가).
   The front is a portrait (assets/frogs/<id>.webp — faces allowed here by the user's decision; the name is written by
   the app on the brass plate), the back a short paragraph of formal written English with two marked expressions
   (bond/frogcards.json ← docs/newfaces-work/assemble-frog.cjs).
   state.shop.fc = {n: {id: times drawn}, d: {id: day first drawn}} — inside state.shop, so it travels with the shop
   between the owner's devices (sync-core KEYS) and in a file merge.
   AWAY (2026-10-19 user 가 가 가): the person on a card sometimes steps out of the picture, as in the books — the frame,
   the room and the plate stay (assets/frogs/<id>-away.webp, the same painting with nobody in it). In the cabinet each card
   is out for the day about one day in five; a card just drawn empties itself a few seconds after it turns over, one time
   in three. The line under an empty card is the card's own (`away` in the text), or a plain one until it is written.
   Test switches: ?frog=<id> draws that card, ?away empties every card that can be empty.
   TO A FRIEND (2026-10-19 user 가 가): a card held twice or more can go with a letter to a friend (friends.js, the letter's
   x.card — firestore.rules okX); one stays. A Chocolate Frog sent as a sweet is opened by the friend who gets it, and a
   card comes out of it then (post.js takeIn). */
import * as store from './store.js';
import * as srs from './srs.js';
import {esc} from './ui.js';

/* the second ten (2026-10-20 user): six more famous names and the four founders of Hogwarts (house crests and colours
   allowed on these since that day) — art design/drafts/frogcards/PROMPTS-2.md, text FROGCARDS2.md. A new id must also go
   into firestore.rules okX (card) before a friend can be sent it, and into sw.js. */
export const IDS = ['dumbledore', 'merlin', 'morgana', 'circe', 'paracelsus', 'cliodna', 'agrippa', 'ptolemy', 'hengist', 'grunnion',
  'flamel', 'bott', 'mungo', 'gwenog', 'wendelin', 'cassandra', 'gryffindor', 'hufflepuff', 'ravenclaw', 'slytherin'];
/* names on the plate before the text has loaded (it is fetched once the shops or the cabinet are opened) */
const NAME = {dumbledore: 'Dumbledore', merlin: 'Merlin', morgana: 'Morgana', circe: 'Circe', paracelsus: 'Paracelsus',
  cliodna: 'Cliodna', agrippa: 'Agrippa', ptolemy: 'Ptolemy', hengist: 'Hengist of Woodcroft', grunnion: 'Alberic Grunnion',
  flamel: 'Nicolas Flamel', bott: 'Bertie Bott', mungo: 'Mungo Bonham', gwenog: 'Gwenog Jones', wendelin: 'Wendelin the Weird',
  cassandra: 'Cassandra Vablatsky', gryffindor: 'Godric Gryffindor', hufflepuff: 'Helga Hufflepuff', ravenclaw: 'Rowena Ravenclaw',
  slytherin: 'Salazar Slytherin'};
let TEXT = null;
export const load = () => TEXT ? Promise.resolve(TEXT) : fetch('bond/frogcards.json').then(r => r.ok ? r.json() : null)
  .then(j => (TEXT = j && Object.fromEntries(j.map(c => [c.id, c])))).catch(() => null);
export const textOf = id => (TEXT && TEXT[id]) || null;
export const nameOf = id => (textOf(id) || {name: {en: NAME[id] || id, ko: NAME[id] || id}}).name;
export const art = id => `assets/frogs/${id}.webp`;
/* the cards whose empty painting has been made */
const EMPTY = IDS;
const q = new URLSearchParams(location.search);
export const canLeave = id => EMPTY.includes(id);
const hash = s => Math.abs([...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261));
/* out of its picture on a day (the same all day; a new day decides again) */
const awayOn = (id, d) => q.has('away') || hash(d + '~' + id) % 5 === 0;
export const awayToday = id => canLeave(id) && awayOn(id, srs.today());
/* a card just drawn: will it empty itself? */
export const leavesNow = id => canLeave(id) && (q.has('away') || Math.random() < 1 / 3);
/* the line under an empty card. Each card has three since 2026-10-20 (user: one line wore out — `away` is a list, or one
   line in older text): in the cabinet they are used in turn, one per day the card is out, counted from FIRST, so the
   same line never comes twice running and every viewer of a day sees the same; a card emptying itself just after it was
   drawn (fresh) picks one at random. */
const FIRST = '2026-01-01';
function awayDays(id){ let n = 0; for (let d = FIRST, t = srs.today(); d <= t; d = srs.addDays(d, 1)) if (awayOn(id, d)) n++; return n; }
export function awayLine(id, fresh = false){
  const t = textOf(id), ls = t && t.away ? [].concat(t.away) : [];
  if (ls.length) return ls[fresh ? Math.floor(Math.random() * ls.length) : (Math.max(1, awayDays(id)) - 1) % ls.length];
  return {en: `${t ? t.name.en : NAME[id]} has stepped out of the picture.`, ko: `${t ? t.name.ko : NAME[id]} · 잠시 자리를 비웠다.`};
}

const st = () => { const s = store.get(), m = s.shop || (s.shop = {}), f = m.fc || (m.fc = {}); f.n = f.n || {}; f.d = f.d || {}; return f; };
export const count = id => st().n[id] || 0;
export const kinds = () => IDS.filter(id => count(id) > 0).length;
export const firstDay = id => st().d[id] || '';

/* the cards there are two or more of: the ones that can go to a friend */
export const spares = () => IDS.filter(id => count(id) >= 2);
export function give(id){ const f = st(); if ((f.n[id] || 0) < 2) return false; f.n[id]--; store.save(); return true; }
/* a card that came with a friend's letter */
export function receive(id){
  if (!IDS.includes(id)) return null;
  const f = st(); f.n[id] = (f.n[id] || 0) + 1; if (!f.d[id]) f.d[id] = srs.today(); store.save();
  return {id, n: f.n[id]};
}
/* one card out of the box: any of them, the same chance each */
export function draw(){
  const id = IDS.includes(q.get('frog')) ? q.get('frog') : IDS[Math.floor(Math.random() * IDS.length)], f = st();
  f.n[id] = (f.n[id] || 0) + 1;
  if (!f.d[id]) f.d[id] = srs.today();
  store.save();
  return {id, n: f.n[id]};
}

/* where the brass plate lies on each painting (fractions of the card: middle of the plate from the top, its left and right
   ends) — measured by eye on design/drafts/frogcards (2026-10-19 user: the name did not sit right on its plate) */
const PLATE = {dumbledore: [.922, .15, .85], merlin: [.923, .18, .82], morgana: [.915, .17, .82], circe: [.909, .17, .83],
  paracelsus: [.905, .16, .84], cliodna: [.930, .19, .81], agrippa: [.913, .15, .85], ptolemy: [.898, .15, .85],
  hengist: [.906, .14, .86], grunnion: [.919, .17, .84],
  /* the second ten, read the same way off a grid of the card's foot (2026-10-20); eight re-read on a finer grid the same
     day (user: morgana · ptolemy · hengist · bott · wendelin · cassandra · ravenclaw · slytherin sat off their plates when
     opened) — design/drafts/frogcards/plategrid.cjs */
  flamel: [.912, .15, .86], bott: [.914, .18, .83], mungo: [.896, .12, .88], gwenog: [.913, .12, .84], wendelin: [.906, .19, .81],
  cassandra: [.901, .14, .86], gryffindor: [.923, .18, .82], hufflepuff: [.928, .16, .86], ravenclaw: [.905, .14, .86],
  slytherin: [.926, .19, .80]};
const marked = s => esc(s).replace(/\[\[([^\]]+)\]\]/g, '<b>$1</b>');
/* the card's face: the portrait with the name on its brass plate (and, behind it, the same painting empty — cls 'out'
   shows that one; 'still' with it skips the fading) */
export const face = (id, cls = '') => { const t = textOf(id), name = t ? t.name.en : NAME[id];
  const [y, l, r] = PLATE[id] || [.915, .19, .81];
  return `<div class="fc-card ${cls}">${canLeave(id) ? `<img class="fc-empty" src="assets/frogs/${id}-away.webp" alt="">` : ''}<img class="fc-who" src="${art(id)}" alt=""><b class="fc-name${name.length > 17 ? ' long' : ''}" lang="en" style="top:${y * 100}%;left:${l * 100 + 4}%;right:${(1 - r) * 100 + 4}%">${esc(name)}</b></div>`; };
/* the back, under the face in a sheet; the role in English on its own line, the Korean name · role under it (2026-10-20 user) */
export function back(id){
  const t = textOf(id); if (!t) return '';
  return `<p class="fc-role"><span lang="en">${esc(t.role.en)}</span>${esc(t.name.ko)} · ${esc(t.role.ko)}</p>` +
    `<p class="sp-tag fc-back" lang="en">${marked(t.back.en)}</p><p class="sp-tag ko">${esc(t.back.ko)}</p>` +
    `<ul class="lt-keys">${Object.entries(t.back.keys).map(([k, v]) => `<li><b lang="en">${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>`;
}
