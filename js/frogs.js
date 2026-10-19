/* Chocolate Frog cards (2026-10-19 user decision): every Chocolate Frog bought at Honeydukes brings one card, drawn at
   random from ten (the same card can come again — user Q4 나). The frog itself still goes into the paper bag. The cards
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

export const IDS = ['dumbledore', 'merlin', 'morgana', 'circe', 'paracelsus', 'cliodna', 'agrippa', 'ptolemy', 'hengist', 'grunnion'];
/* names on the plate before the text has loaded (it is fetched once the shops or the cabinet are opened) */
const NAME = {dumbledore: 'Dumbledore', merlin: 'Merlin', morgana: 'Morgana', circe: 'Circe', paracelsus: 'Paracelsus',
  cliodna: 'Cliodna', agrippa: 'Agrippa', ptolemy: 'Ptolemy', hengist: 'Hengist of Woodcroft', grunnion: 'Alberic Grunnion'};
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
/* out of its picture today (the same all day; a new day decides again) */
export const awayToday = id => canLeave(id) && (q.has('away') || hash(srs.today() + '~' + id) % 5 === 0);
/* a card just drawn: will it empty itself? */
export const leavesNow = id => canLeave(id) && (q.has('away') || Math.random() < 1 / 3);
export function awayLine(id){
  const t = textOf(id); if (t && t.away) return t.away;
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
/* one card out of the box: any of the ten, the same chance each */
export function draw(){
  const id = IDS.includes(q.get('frog')) ? q.get('frog') : IDS[Math.floor(Math.random() * IDS.length)], f = st();
  f.n[id] = (f.n[id] || 0) + 1;
  if (!f.d[id]) f.d[id] = srs.today();
  store.save();
  return {id, n: f.n[id]};
}

/* where the brass plate lies on each painting (fractions of the card: middle of the plate from the top, its left and right
   ends) — measured by eye on design/drafts/frogcards (2026-10-19 user: the name did not sit right on its plate) */
const PLATE = {dumbledore: [.922, .15, .85], merlin: [.923, .18, .82], morgana: [.900, .16, .91], circe: [.909, .17, .83],
  paracelsus: [.905, .16, .84], cliodna: [.930, .19, .81], agrippa: [.913, .15, .85], ptolemy: [.897, .15, .85],
  hengist: [.900, .14, .86], grunnion: [.919, .17, .84]};
const marked = s => esc(s).replace(/\[\[([^\]]+)\]\]/g, '<b>$1</b>');
/* the card's face: the portrait with the name on its brass plate (and, behind it, the same painting empty — cls 'out'
   shows that one; 'still' with it skips the fading) */
export const face = (id, cls = '') => { const t = textOf(id), name = t ? t.name.en : NAME[id];
  const [y, l, r] = PLATE[id] || [.915, .19, .81];
  return `<div class="fc-card ${cls}">${canLeave(id) ? `<img class="fc-empty" src="assets/frogs/${id}-away.webp" alt="">` : ''}<img class="fc-who" src="${art(id)}" alt=""><b class="fc-name${name.length > 14 ? ' long' : ''}" lang="en" style="top:${y * 100}%;left:${l * 100 + 4}%;right:${(1 - r) * 100 + 4}%">${esc(name)}</b></div>`; };
/* the back, under the face in a sheet */
export function back(id){
  const t = textOf(id); if (!t) return '';
  return `<p class="fc-role"><span lang="en">${esc(t.role.en)}</span> · ${esc(t.name.ko)} · ${esc(t.role.ko)}</p>` +
    `<p class="sp-tag fc-back" lang="en">${marked(t.back.en)}</p><p class="sp-tag ko">${esc(t.back.ko)}</p>` +
    `<ul class="lt-keys">${Object.entries(t.back.keys).map(([k, v]) => `<li><b lang="en">${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>`;
}
