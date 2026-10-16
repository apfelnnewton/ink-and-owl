/* The shops (2026-10-12 user decision, phases 3-가 and 3-나): somewhere to spend what the manor pays.
   The fire in the guest's room goes to two more places once a first day's wages have been earned (fire.js DEST):
     Diagon Alley  (#/town/diagon)     — Slug & Jiggers Apothecary (#/town/apothecary), and Ollivander's door
     Hogsmeade     (#/town/hogsmeade)  — Honeydukes (#/town/honeydukes), the Three Broomsticks (#/town/broomsticks)
   A street is a picture with lit names on it, like the manor's hall; a shop is its counter and what it sells.
   What is bought goes into the paper bag in the guest's room (state.shop.bag).
   PRESENTS. A sweet or a potion ingredient can be sent to any professor whose door is open, to Sirius and to Bellatrix
   — one present a day, to one person. The next day that person answers (bond/gifts.json: for each person, each thing
   has a taste — 1 likes it, 0 takes it as it comes, -1 turns it down — and one or two replies; three more for a thing
   sent yet again; one each for the fifth and tenth present). Liked +15 to the bond, taken +5, turned down nothing —
   and what is turned down comes back in the bag. Nobody is told beforehand who likes what.
   BUTTERBEER is for friends only: a bottle (or a sweet) goes with a letter (friends.js, post.js: the letter's x.gift).
   state.shop = {open, bag: {id: n}, sent: {who: {id: times}}, n: {who: presents}, day: last day a present went,
                 due: [{who, item, key, d, pts, back}]}
   Post keys: GF~<item>~<0|1> a thing's own replies · GF~<item>~a<0-2>~<times> sent yet again · GM~5, GM~10.
   THE SECOND SET (3-나), both in Diagon Alley: Weasleys' joke shop (#/town/weasleys) — the Skiving Snackbox (one missed
   day counted as attended, owned up to the next day; two kept at most), three inks and three papers for letters to
   friends (the letter's x.ink / x.paper; ten letters a bottle, ten sheets a bundle; Bellatrix's crimson ink too, once
   she has given it) — and, down the dark turning, Borgin and Burkes (#/town/borgin): twelve dark things, all on the
   counter from the first day, bought in any order, one of each, kept on the shelf in the back room (#/town/shelf).
   The day after each is bought Bellatrix leaves a scrap about it (BG~<thing>). Words: bond/shops.json.
   state.shop also holds: ink {id: letters left}, paper {id: sheets left}, dark {id: day bought}, bg [{key, d}] her
   scraps still to come, borginSeen, snackAsked, snacked [days excused].
   ?shops in the address opens the two places at once (testing). */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as doors from './doors.js';
import * as manor from './manor.js';
import * as bella from './bella.js';
import {floo} from './fire.js';
import * as owners from './owners.js';
import {byId, PROFS} from './decks.js';
import {$, esc, toast, openSheet, closeSheet, isSheetOpen} from './ui.js';

const SICKLE = 29;
/* id · shop · kind · names · price in Sickles · one line on the ticket · the short name a friend's letter carries (firestore.rules okX) */
export const GOODS = [
  ['sherbet-lemons', 'honeydukes', 'sweet', 'Sherbet Lemons', '셔벗 레몬', 4, 'Hard lemon sweets with a fizz of sherbet in the middle.', '가운데에 톡 쏘는 셔벗 가루가 든 딱딱한 레몬 사탕.', 'sherbet-lemons'],
  ['pepper-imps', 'honeydukes', 'sweet', 'Pepper Imps', '후추 도깨비', 4, 'Tiny black peppermints. Smoke comes out of your ears.', '작고 검은 박하사탕. 먹으면 귀에서 연기가 난다.', 'pepper-imps'],
  ['every-flavour-beans', 'honeydukes', 'sweet', "Bertie Bott's Every Flavour Beans", '온갖 맛 젤리', 5, 'Every flavour there is. Every one.', '세상의 모든 맛. 정말로 모든 맛.', 'beans'],
  ['sugar-quill', 'honeydukes', 'sweet', 'A Sugar Quill', '설탕 깃펜', 5, 'A quill of spun sugar: suck it and look as if you are thinking.', '설탕으로 뽑은 깃펜. 물고 있으면 생각하는 것처럼 보인다.', 'sugar-quill'],
  ['fizzing-whizzbees', 'honeydukes', 'sweet', 'Fizzing Whizzbees', '톡톡 튀는 윙윙벌', 6, 'Sherbet balls that lift you a few inches off the floor.', '먹으면 바닥에서 한 뼘쯤 떠오르는 셔벗 사탕.', 'whizzbees'],
  ['chocolate-frog', 'honeydukes', 'sweet', 'A Chocolate Frog', '개구리 초콜릿', 6, 'It jumps once. The card inside is worth keeping.', '한 번은 뛴다. 안에 든 카드는 모아 둘 만하다.', 'choc-frog'],
  ['ginger-newts', 'honeydukes', 'sweet', 'Ginger Newts', '생강 도롱뇽 과자', 7, 'Ginger biscuits in the shape of newts, by the tin.', '도롱뇽 모양 생강 과자. 깡통째로 판다.', 'ginger-newts'],
  ['coconut-ice', 'honeydukes', 'sweet', 'Coconut Ice', '분홍 코코넛 아이스', 8, 'Shimmering squares, half pink, half white.', '반은 분홍, 반은 흰색으로 반짝이는 네모 조각.', 'coconut-ice'],
  ['best-chocolate', 'honeydukes', 'sweet', "Honeydukes' Best Chocolate", '허니듀크스 최고급 초콜릿', 10, 'The largest slab in the shop, and the best.', '가게에서 가장 크고 가장 좋은 판 초콜릿.', 'best-choc'],
  ['crystallised-pineapple', 'honeydukes', 'sweet', 'Crystallised Pineapple', '설탕 절임 파인애플', 12, "A box of pineapple in sugar. Somebody's favourite.", '설탕에 절인 파인애플 한 상자. 누군가는 이걸 가장 좋아한다.', 'pineapple'],
  ['dried-nettles', 'apothecary', 'ingredient', 'Dried Nettles', '말린 쐐기풀', 6, 'The first thing a first-year is asked to weigh.', '1학년이 맨 처음 저울에 올리는 재료.'],
  ['porcupine-quills', 'apothecary', 'ingredient', 'Porcupine Quills', '호저 가시', 8, 'In a cure for boils, added after the cauldron comes off the fire. Not before.', '종기 치료약에서는 솥을 불에서 내린 뒤에 넣는다. 그 전이 아니라.'],
  ['lacewing-flies', 'apothecary', 'ingredient', 'Lacewing Flies', '풀잠자리', 10, 'To be stewed for twenty-one days.', '스물하루 동안 뭉근히 달여야 한다.'],
  ['powdered-moonstone', 'apothecary', 'ingredient', 'Powdered Moonstone', '월장석 가루', 12, 'For a hand that does not shake when it measures.', '분량을 잴 때 떨리지 않는 손을 위한 재료.'],
  ['aconite', 'apothecary', 'ingredient', 'Aconite', '투구꽃', 14, 'Also called monkshood; also called wolfsbane.', '몽크스후드라고도, 울프스베인이라고도 부른다.'],
  ['bezoar', 'apothecary', 'ingredient', 'A Bezoar', '베조아르', 15, 'A stone from the stomach of a goat. It will save you from most poisons.', '염소 위에서 꺼낸 돌. 웬만한 독은 막아 준다.'],
  ['jobberknoll-feather', 'apothecary', 'ingredient', 'Jobberknoll Feathers', '조버놀 깃털', 15, 'From a bird that never makes a sound. Its feather makes other people talk.', '평생 소리를 내지 않는 새의 깃털. 이 깃털은 남의 입을 연다.'],
  ['boomslang-skin', 'apothecary', 'ingredient', 'Boomslang Skin', '붐슬랭 껍질', 17, 'Scarce. The apothecary asks no questions and answers none.', '귀한 물건. 약재상은 묻지도 않고 대답하지도 않는다.'],
  ['sopophorous-bean', 'apothecary', 'ingredient', 'Sopophorous Beans', '졸음콩', 18, 'Shrivelled, slippery and hard to cut. Some say a blade is the wrong tool.', '쭈글쭈글하고 미끄러워 잘 썰리지 않는다. 칼이 맞는 연장이 아니라는 사람도 있다.'],
  ['dried-dittany', 'apothecary', 'ingredient', 'Dried Dittany', '말린 디터니', 20, 'A few drops of its essence, and a fresh wound closes.', '이것으로 만든 원액 몇 방울이면 갓 난 상처가 아문다.'],
  ['butterbeer', 'broomsticks', 'drink', 'Butterbeer', '버터맥주', 3, 'A bottle to send with a letter. The owls carry it under protest.', '편지와 함께 보내는 한 병. 부엉이는 투덜대면서도 나른다.', 'butterbeer']
].map(([id, shop, kind, en, ko, s, tag, tagKo, wire]) => ({id, shop, kind, en, ko, s, tag, tagKo, wire: wire || ''}));
/* the second set (phase 3-나): the joke shop and Borgin and Burkes. Their tickets are in bond/shops.json (TEXT), under `key`.
   ink / paper: the short name a friend's letter carries (firestore.rules okX); drop: how far the picture must sink to stand on a shelf */
GOODS.push(
  {id: 'skiving-snackbox', shop: 'weasleys', kind: 'snack', en: 'A Skiving Snackbox', ko: '땡땡이 과자 상자', s: 17, key: 'snackbox'},
  {id: 'ink-changing', shop: 'weasleys', kind: 'ink', en: 'Ever-Changing Ink', ko: '변덕쟁이 잉크', s: 6, key: 'ink-changing', ink: 'i1'},
  {id: 'ink-blushing', shop: 'weasleys', kind: 'ink', en: 'Blushing Ink', ko: '얼굴 붉히는 잉크', s: 6, key: 'ink-blushing', ink: 'i2'},
  {id: 'ink-starlight', shop: 'weasleys', kind: 'ink', en: 'Spilt-Starlight Ink', ko: '엎지른 별빛 잉크', s: 6, key: 'ink-starlight', ink: 'i3'},
  {id: 'paper-whizbang', shop: 'weasleys', kind: 'paper', en: 'Whiz-Bang Paper', ko: '불꽃놀이 편지지', s: 8, key: 'paper-whizbang', paper: 'p1'},
  {id: 'paper-swamp', shop: 'weasleys', kind: 'paper', en: 'Portable Swamp Paper', ko: '휴대용 늪 편지지', s: 8, key: 'paper-swamp', paper: 'p2'},
  {id: 'paper-howler', shop: 'weasleys', kind: 'paper', en: 'Mock Howler Paper', ko: '가짜 호울러 편지지', s: 8, key: 'paper-howler', paper: 'p3'},
  {id: 'borgin-01-eye', shop: 'borgin', kind: 'dark', en: 'A Glass Eye', ko: '유리 눈알', s: 17, key: 'eye', drop: 4},
  {id: 'borgin-02-cards', shop: 'borgin', kind: 'dark', en: 'A Stained Pack of Cards', ko: '얼룩진 카드 한 벌', s: 17, key: 'cards', drop: 4},
  {id: 'borgin-03-candle', shop: 'borgin', kind: 'dark', en: 'A Candle That Burns Cold', ko: '차갑게 타는 초', s: 25, key: 'candle', drop: 4},
  {id: 'borgin-04-musicbox', shop: 'borgin', kind: 'dark', en: 'A Music Box with One Wrong Note', ko: '한 음이 틀리는 오르골', s: 34, key: 'musicbox', drop: 4},
  {id: 'borgin-05-watch', shop: 'borgin', kind: 'dark', en: 'A Watch That Runs Backwards', ko: '거꾸로 가는 회중시계', s: 34, key: 'watch', drop: 7},
  {id: 'borgin-06-mask', shop: 'borgin', kind: 'dark', en: 'A Leering Mask', ko: '흘겨보는 가면', s: 42, key: 'mask', drop: 4},
  {id: 'borgin-07-shell', shop: 'borgin', kind: 'dark', en: 'A Whispering Shell', ko: '속삭이는 조개껍데기', s: 51, key: 'shell', drop: 20},
  {id: 'borgin-08-rope', shop: 'borgin', kind: 'dark', en: 'A Coil of Rope', ko: '저절로 매듭짓는 밧줄', s: 51, key: 'rope', drop: 17},
  {id: 'borgin-09-mirror', shop: 'borgin', kind: 'dark', en: 'A Mirror for the Back of the Head', ko: '뒤통수만 비추는 거울', s: 59, key: 'mirror', drop: 4},
  {id: 'borgin-10-shadows', shop: 'borgin', kind: 'dark', en: 'A Jar of Borrowed Shadows', ko: '빌린 그림자 병', s: 68, key: 'shadows', drop: 4},
  {id: 'borgin-11-hand', shop: 'borgin', kind: 'dark', en: 'The Hand with the Candle', ko: '초를 쥔 손', s: 76, key: 'hand', drop: 4},
  {id: 'borgin-12-opals', shop: 'borgin', kind: 'dark', en: 'The Opal Necklace', ko: '오팔 목걸이', s: 85, key: 'opals', drop: 4},
  /* the six spare things (2026-10-16, owners.js): not on the counter until Mr Borgin brings one out for a place fallen empty */
  {id: 'borgin-13-dice', shop: 'borgin', kind: 'dark', spare: true, en: 'A Pair of Bone Dice', ko: '뼈 주사위 한 쌍', s: 21, key: 'dice', drop: 4},
  {id: 'borgin-14-key', shop: 'borgin', kind: 'dark', spare: true, en: 'A Key That Opens Nothing', ko: '아무것도 열지 못하는 열쇠', s: 34, key: 'key', drop: 4},
  {id: 'borgin-15-inkwell', shop: 'borgin', kind: 'dark', spare: true, en: 'A Green Glass Inkwell', ko: '녹색 유리 잉크병', s: 42, key: 'inkwell', drop: 4},
  {id: 'borgin-16-barometer', shop: 'borgin', kind: 'dark', spare: true, en: 'A Barometer for Tempers', ko: '방의 기분을 읽는 청우계', s: 51, key: 'barometer', drop: 4},
  {id: 'borgin-17-bell', shop: 'borgin', kind: 'dark', spare: true, en: "A Visitor's Bell", ko: '손님을 미리 알리는 종', s: 59, key: 'bell', drop: 4},
  {id: 'borgin-18-map', shop: 'borgin', kind: 'dark', spare: true, en: 'The Plan of a House That Is Not There', ko: '없는 집의 평면도', s: 68, key: 'map', drop: 4}
);
export const DARK = GOODS.filter(g => g.kind === 'dark');
export const ORIGINAL = DARK.filter(g => !g.spare);   // the twelve on the counter from the first day; their order is their place on the shelf
export const good = id => GOODS.find(g => g.id === id);
export const byWire = w => GOODS.find(g => g.wire && g.wire === w) || null;
export const art = id => `assets/shop/${id}.webp`;

const st = () => { const s = store.get(), m = s.shop || (s.shop = {}); m.bag = m.bag || {}; m.sent = m.sent || {}; m.n = m.n || {}; m.due = m.due || []; return m; };
export const isOpen = () => !!(store.get().shop || {}).open;
export const have = id => st().bag[id] || 0;
export const bagCount = () => Object.values(st().bag).reduce((a, n) => a + n, 0);
export const owned = () => GOODS.filter(g => have(g.id) > 0);
/* what can go with a friend's letter: a sweet or a bottle */
export const sendable = () => owned().filter(g => g.wire);
export function take(id){ const b = st().bag; if (!b[id]) return false; b[id]--; if (!b[id]) delete b[id]; store.save(); return true; }

export function buy(id){
  const g = good(id); if (!g) return '없는 물건입니다.';
  const m = st2(), cost = g.s * SICKLE;
  if (g.kind === 'dark' && m.dark[id]) return '이미 맡겨 둔 물건입니다.';
  if (g.kind === 'snack' && have(id) >= 2) return 'full';   // two boxes is the limit (the shop says so itself)
  if (manor.purse() < cost) return '주머니가 가볍다. 저택에서 하루 더 일해야 한다.';
  manor.earn(-cost);
  if (g.kind === 'ink') m.ink[id] = (m.ink[id] || 0) + USES;
  else if (g.kind === 'paper') m.paper[id] = (m.paper[id] || 0) + USES;
  else if (g.kind === 'dark'){ m.dark[id] = srs.today(); (m.bg = m.bg || []).push({key: g.key, d: srs.today()}); placeOf(g); owners.bought(g.key); }   // she will have something to say about it tomorrow; its former owner, in two days
  else m.bag[id] = have(id) + 1;
  store.save();
  return '';
}

/* ---------- the second set: ink and paper for friends' letters, the box of excuses, the dark things kept at Borgin's */
const USES = 10;   // letters a bottle of ink writes, sheets in a bundle
const st2 = () => { const m = st(); m.ink = m.ink || {}; m.paper = m.paper || {}; m.dark = m.dark || {}; return m; };
let TEXT = null;
export const loadText = () => TEXT ? Promise.resolve(TEXT) : fetch('bond/shops.json').then(r => r.ok ? r.json() : null).then(j => (TEXT = j)).catch(() => null);
const pick = (list, salt) => list && list.length ? list[Math.abs([...(srs.today() + salt)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)) % list.length] : null;
/* the ticket of a thing: the first set carries its own line, the second set's are in TEXT */
export function tagOf(g){
  if (g.tag) return {en: g.tag, ko: g.tagKo};
  const t = TEXT && (g.shop === 'borgin' ? TEXT.borgin.tags : TEXT.weasley.tags)[g.key];
  return t || {en: '', ko: ''};
}
const marked = s => esc(s).replace(/\[\[([^\]]+)\]\]/g, '<b>$1</b>');
const keysOf = t => t.keys ? `<ul class="lt-keys">${Object.entries(t.keys).map(([k, v]) => `<li><b lang="en">${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>` : '';
const say = t => t ? `<span class="q" lang="en">${marked(t.en)}</span><span class="k">${esc(t.ko)}</span>` : '';
/* what is left to write with: [{g, n}] — the inks and papers bought, and her crimson ink (never runs out) once she has given it */
export const inkLeft = id => st2().ink[id] || 0;
export const paperLeft = id => st2().paper[id] || 0;
export const hasBlood = () => { const b = bond.bondOf('bellatrix'); return !!(b.keep.K01 || b.sent.K01); };
export const inks = () => GOODS.filter(g => g.kind === 'ink' && inkLeft(g.id) > 0);
export const papers = () => GOODS.filter(g => g.kind === 'paper' && paperLeft(g.id) > 0);
export const BLOOD = {id: 'blood', en: 'Her Crimson Ink', ko: '그녀의 붉은 잉크', ink: 'blood', art: 'assets/keepsakes/bellatrix-K01.webp'};
export const byInk = w => w === 'blood' ? BLOOD : GOODS.find(g => g.ink && g.ink === w) || null;
export const byPaper = w => GOODS.find(g => g.paper && g.paper === w) || null;
/* a letter has gone: a letter's worth of that ink, a sheet of that paper */
export function spend(ink, paper){
  const m = st2();
  if (ink && ink !== 'blood'){ const g = byInk(ink); if (g && m.ink[g.id]){ m.ink[g.id]--; if (!m.ink[g.id]) delete m.ink[g.id]; } }
  if (paper){ const g = byPaper(paper); if (g && m.paper[g.id]){ m.paper[g.id]--; if (!m.paper[g.id]) delete m.paper[g.id]; } }
  store.save();
}
/* a thing on the shelf: bought (or swapped in) and not sold or swapped away since (owners.js) */
export const owns = id => { const g = good(id); return !!st2().dark[id] && !(g && owners.gone(g.key)); };
export const darkCount = () => DARK.filter(g => owns(g.id)).length;
/* on the counter: the twelve until bought; a spare once Mr Borgin has brought it out; nothing sold or swapped away */
export const onCounter = g => g.kind !== 'dark' || (!st2().dark[g.id] && !owners.gone(g.key) && (!g.spare || owners.isOut(g.key)));
/* its place on the shelf: one of the twelve keeps its own; a spare takes a place left by a thing gone (kept in shop.slot) */
export function placeOf(g){
  const m = st2(), i = ORIGINAL.indexOf(g); if (i >= 0) return i;
  m.slot = m.slot || {};
  if (m.slot[g.id] != null) return m.slot[g.id];
  const taken = new Set(DARK.filter(x => x !== g && owns(x.id)).map(x => ORIGINAL.indexOf(x) >= 0 ? ORIGINAL.indexOf(x) : m.slot[x.id]));
  const free = [...Array(ORIGINAL.length).keys()].filter(k => !taken.has(k) && (owners.gone(ORIGINAL[k].key) || Object.entries(m.slot).some(([id, s]) => s === k && !owns(id))));
  m.slot[g.id] = free.length ? free[0] : null;
  return m.slot[g.id];
}
/* places on the shelf that a spare could fill: left by a thing gone, not taken again, not already promised to a spare on the counter */
function room(){
  const held = new Set(DARK.filter(g => owns(g.id)).map(g => placeOf(g)));
  const empty = ORIGINAL.filter((g, i) => owners.gone(g.key) && !held.has(i)).length;
  return empty - DARK.filter(g => g.spare && onCounter(g)).length;
}
/* a thing that comes in by a swap: on the shelf at once, in the place of the one that went; its own former owner writes too */
function arrive(key){
  const g = DARK.find(x => x.key === key), m = st2(); if (!g || m.dark[g.id]) return;
  m.dark[g.id] = srs.today(); placeOf(g); owners.bought(key);
  (m.bg = m.bg || []).push({key, d: srs.today()});
}

/* the Skiving Snackbox: one missed day is counted as attended — the streak runs on and the Howlers reckon from a day later.
   Only for yesterday, only when the day before it was a day of study, and only when the guest says so (asked once). */
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv-SE'); };
export function snackDue(){
  const s = store.get(), m = st2(), t = srs.today();
  return isOpen() && have('skiving-snackbox') > 0 && m.snackAsked !== t && s.streak.n > 0 && s.streak.last === addDays(t, -2) && !(s.log || {})[addDays(t, -1)];
}
function snackAnswer(yes){
  const s = store.get(), m = st2(), t = srs.today(), y = addDays(t, -1);
  m.snackAsked = t;
  if (yes && take('skiving-snackbox')){
    s.streak.last = y; s.streak.n += 1;
    s.log[y] = {snack: {n: 0, good: 0, hard: 0, again: 0, learn: 0}};   // a day with nothing learnt in it, but a day: the Howlers count from here
    (m.snacked = m.snacked || []).push(y);
  }
  store.save();
  const l = TEXT && TEXT.weasley.snack[yes ? 'used' : 'kept'];
  if (l) toast(say(l), 3600, true);
}
export async function askSnack(app){
  await loadText(); if (!snackDue()) return;
  const l = TEXT ? TEXT.weasley.snack.ask : {en: 'Shall we say you ate one yesterday?', ko: '어제는 과자를 먹었다고 할까요?'};
  const g = good('skiving-snackbox');
  openSheet(`<div class="sh-kind"><span>땡땡이 과자 상자</span><span>${have(g.id)}개</span></div>` + fig(g) +
    `<p class="sp-tag" lang="en">${marked(l.en)}</p><p class="sp-tag ko">${esc(l.ko)}</p>` + keysOf(l) +
    `<p class="purse-note">어제는 공부를 쉬었다. 한 상자를 쓰면 어제도 출석한 날로 친다.</p>` +
    `<button type="button" class="sh-drill" data-snack="yes">먹은 걸로 한다 · 한 상자 쓰기</button>` +
    `<button type="button" class="clink sp-back" data-snack="no">아니, 그냥 둔다</button>`);
  const body = $('#sheetBody'), on = e => { const b = e.target.closest('[data-snack]'); if (!b) return; body.removeEventListener('click', on); closeSheet(); snackAnswer(b.dataset.snack === 'yes'); app && app.refresh && app.refresh(); };
  body.addEventListener('click', on);
  st2().snackAsked = srs.today(); store.save();   // asked once: closing the slip without answering keeps the box
}

/* ---------- presents */
let GIFTS = null;
export const load = () => GIFTS ? Promise.resolve(GIFTS) : fetch('bond/gifts.json').then(r => r.ok ? r.json() : null).then(j => (GIFTS = j)).catch(() => null);
/* whom a present can reach: the professors behind opened doors; Sirius once he has come to the fire; Bellatrix once seated before her */
export function recipients(){
  const list = PROFS.filter(d => doors.available(d.id));
  if (doors.available('sirius') && (store.get().fire || {}).met) list.push(byId('sirius'));
  if (bella.met()) list.push(byId('bellatrix'));
  return list;
}
export const sentToday = () => st().day === srs.today();
const HOW = {fire: ['Into the fire it goes.', '불 속에 넣었다. 시리우스네 벽난로에서 나올 것이다. 답은 내일.'], drawing: ['Left on her table.', '응접실 탁자 위에 두고 나왔다. 답은 내일.']};
export function give(who, id){
  const m = st(), g = good(id), d = byId(who), data = GIFTS && GIFTS[who];
  if (!g || !d || g.kind === 'drink') return '보낼 수 없는 물건입니다.';
  if (sentToday()) return '오늘은 이미 하나 보냈다. 선물은 하루에 하나.';
  if (!data || !data.items[id]) return '아직 보낼 수 없습니다. 잠시 뒤에 다시 해 보세요.';
  if (!take(id)) return '봉지에 없는 물건입니다.';
  const t = srs.today(), it = data.items[id];
  const times = (m.sent[who] = m.sent[who] || {})[id] = ((m.sent[who] || {})[id] || 0) + 1;
  const total = m.n[who] = (m.n[who] || 0) + 1;
  const key = times <= it.replies.length ? `GF~${id}~${times - 1}` : `GF~${id}~a${(times - it.replies.length - 1) % 3}~${times}`;
  const back = it.taste === -1 || !!it.back;
  m.due.push({who, item: id, key, d: t, pts: it.taste === 1 ? 15 : it.taste === 0 ? 5 : 0, back});
  if (total === 5 || total === 10) m.due.push({who, item: '', key: 'GM~' + total, d: t, pts: 0, back: false});
  m.day = t; store.save();
  const how = HOW[d.place] || ['The owl takes it.', `부엉이가 ${d.ko}에게 들고 갔다. 답장은 내일.`];
  toast(`<span class="q" lang="en">${how[0]}</span><span class="k">${esc(how[1])}</span>`, 3200, true);
  return '';
}
export function textOf(id, key){
  let m;
  /* her scrap about a thing bought at Borgin's (bond/shops.json → bella) */
  if ((m = key.match(/^BG~([a-z]+)$/))){ const n = TEXT && TEXT.bella && TEXT.bella[m[1]], g = DARK.find(x => x.key === m[1]); return id === 'bellatrix' && n && g ? {kind: '쪽지', ...n, thing: {id: g.id, en: g.en, ko: g.ko, back: false}} : null; }
  const data = GIFTS && GIFTS[id]; if (!data) return null;
  if ((m = key.match(/^GM~(5|10)$/))){ const n = data[m[1] === '5' ? 'fifth' : 'tenth']; return n ? {kind: '답장', ...n} : null; }
  if (!(m = key.match(/^GF~([a-z-]+)~(a?)(\d)(?:~\d+)?$/))) return null;
  const it = data.items[m[1]], g = good(m[1]); if (!it || !g) return null;
  const n = m[2] ? data.again[+m[3]] : it.replies[+m[3]];
  return n ? {kind: '답장', ...n, thing: {id: g.id, en: g.en, ko: g.ko, back: !m[2] && (it.taste === -1 || !!it.back)}} : null;
}

/* ---------- each day: the places open; yesterday's presents are answered; she has heard what was bought at Borgin's */
export async function daily(){
  const m = st2(), s = store.get(), t = srs.today();
  if (!m.open && s.settings.named && manor.isOpen() && (((s.manor || {}).days || 0) >= 1 || new URLSearchParams(location.search).has('shops'))) m.open = t;
  if (!m.open) return;
  /* the words are fetched every day the shops are open, not only when an answer is due: the post box needs them to
     show the answers already received (2026-10-12: without this they dropped out of the list the day after) */
  await Promise.all([load(), loadText()]);
  if (GIFTS && m.due.some(x => x.d < t)){
    await Promise.all([...new Set(m.due.map(x => x.who))].map(w => bond.load(w)));
    m.due = m.due.filter(x => {
      if (x.d >= t) return true;
      if (!bond.postItem(x.who, x.key)) return false;   // said already, or nothing to say: let it go
      if (x.pts) bond.gain(x.who, x.pts);
      if (x.back && x.item) m.bag[x.item] = (m.bag[x.item] || 0) + 1;
      return false;
    });
  }
  /* the former owners' letters (owners.js): a letter moves on, a correspondence ends, a spare comes out */
  if (DARK.some(g => m.dark[g.id])) await owners.daily({owned: () => DARK.filter(g => owns(g.id)).map(g => g.key), arrive, room,
    earn: k => manor.earn(Math.max(-manor.purse(), k))});
  if (TEXT && TEXT.bella && (m.bg || []).some(x => x.d < t) && bella.met()){
    await bond.load('bellatrix');
    m.bg = m.bg.filter(x => { if (x.d >= t) return true; bond.postItem('bellatrix', 'BG~' + x.key); return false; });
  }
  store.save();
}

/* ---------- the paper bag in the guest's room: what has been bought, and to whom it may go */
const fig = (g, big) => `<figure class="sp-fig${big ? ' big' : ''}"><img src="${g.art || art(g.id)}" alt=""><figcaption><b lang="en">${esc(g.en)}</b><span>${esc(g.ko)}</span></figcaption></figure>`;
const leftOf = g => g.kind === 'ink' ? `편지 ${inkLeft(g.id)}통분` : g.kind === 'paper' ? `${paperLeft(g.id)}장` : `× ${have(g.id)}`;
export function bagSheet(){
  const list = [...owned(), ...inks(), ...papers()], n = bagCount() + inks().length + papers().length;
  openSheet(`<div class="sh-kind"><span>종이 봉지</span><span>${list.length ? `${n}가지` : ''}</span></div>` +
    `<figure class="purse-fig"><img src="${art('bag')}" alt=""></figure>` +
    (list.length ? `<ul class="sp-bag">${list.map(g => `<li><button type="button" data-bagitem="${g.id}"><img src="${art(g.id)}" alt=""><span><b lang="en">${esc(g.en)}</b><em>${esc(g.ko)}</em></span><i>${leftOf(g)}</i></button></li>`).join('')}</ul>` +
        `<p class="purse-note">${sentToday() ? '오늘은 이미 선물을 하나 보냈다. 다음은 내일.' : '과자나 약재를 누르면 누구에게 보낼지 고른다. 선물은 하루에 하나.'}</p>`
      : `<p class="purse-note">비어 있다. 벽난로의 플루 가루로 호그스미드나 다이애건 앨리에 가면 채울 수 있다.</p>`) +
    (darkCount() ? `<p class="purse-note">보긴 앤 버크스에 맡겨 둔 물건 ${darkCount()}점은 그 가게 뒷방 선반에 있다.</p>` : '') +
    `<p class="purse-note">주머니 · ${esc(manor.money(manor.purse()))}</p>`);
}
function itemSheet(id){
  const g = good(id); if (!g || !(have(id) || inkLeft(id) || paperLeft(id))) return bagSheet();
  const who = recipients(), busy = sentToday(), t = tagOf(g);
  const friendOnly = txt => `<p class="purse-note">${txt}</p><button type="button" class="sh-drill" data-baggo="#/letters/friends">편지함 · 친구 칸으로</button>`;
  openSheet(`<div class="sh-kind"><span>종이 봉지 · ${leftOf(g).replace('× ', '')}${/^×/.test(leftOf(g)) ? '개' : ''}</span></div>` + fig(g, true) +
    `<p class="sp-tag" lang="en">${marked(t.en)}</p><p class="sp-tag ko">${esc(t.ko)}</p>` + keysOf(t) +
    (g.kind === 'drink' ? friendOnly('버터맥주는 친구에게만 보낸다. 친구에게 편지를 쓸 때 함께 붙일 수 있다.')
      : g.kind === 'ink' ? friendOnly('친구에게 편지를 쓸 때 이 잉크를 고를 수 있다. 한 통에 한 번씩 줄어든다.')
      : g.kind === 'paper' ? friendOnly('친구에게 편지를 쓸 때 이 편지지를 고를 수 있다. 한 통에 한 장씩 줄어든다.')
      : g.kind === 'snack' ? `<p class="purse-note">공부를 쉰 다음 날, 상자가 먼저 묻는다. 그때 한 상자를 쓰면 쉰 날도 출석한 날로 친다. 두 상자까지 둘 수 있다.</p>`
      : `<h3 class="gr-h">${busy ? '오늘은 이미 하나 보냈다 · 다음은 내일' : '누구에게 보낼까'}</h3>` +
        `<ul class="sp-who">${who.map(d => { const n = ((st().sent[d.id] || {})[id]) || 0;
          return `<li><button type="button" data-give="${d.id}" data-item="${id}"${busy ? ' disabled' : ''}><i class="seal s-${d.id}"></i><span>${esc(d.ko)}</span><em>${n ? `${n}번 보냄` : ''}</em></button></li>`; }).join('')}</ul>` +
        (g.wire ? `<p class="purse-note">과자는 친구에게 쓰는 편지에도 붙일 수 있다.</p>` : '')) +
    `<button type="button" class="clink sp-back" data-bagback>봉지로 돌아가기</button>`);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('#sheetBody [data-bagitem], #sheetBody [data-give], #sheetBody [data-bagback], #sheetBody [data-baggo]'); if (!b) return;
  if (b.dataset.bagitem){ await Promise.all([load(), loadText()]); itemSheet(b.dataset.bagitem); return; }
  if (b.hasAttribute('data-bagback')){ bagSheet(); return; }
  if (b.dataset.baggo){ closeSheet(); location.hash = b.dataset.baggo; return; }
  await Promise.all([load(), bond.load(b.dataset.give)]);
  const err = give(b.dataset.give, b.dataset.item);
  if (err){ toast(esc(err)); return; }
  closeSheet();
});

/* a thing on the shelf: where its former owner's letters stand (owners.js), and the paper, if one came of them */
const END_KO = {kept: '지켰다', third: '세 번째 길로 끝났다'};
function ownerLine(g){
  const D = owners.data(), c = D && D[g.key], done = owners.ended(g.key), paper = owners.paperOf(g.key);
  const go = '<button type="button" class="sh-drill" data-baggo="#/letters/borgin">편지함 · 보긴 앤 버크스 칸</button>';
  if (owners.writing(g.key)) return `<p class="purse-note">옛 주인${c ? ` ${esc(c.from.ko)}` : ''}와(과) 편지가 오가는 중이다.</p>` + go;
  if (owners.queued(g.key)) return '<p class="purse-note">이 물건의 옛 주인이 곧 편지를 보낼 것이다.</p>';
  if (!done) return '';
  return `<p class="purse-note">옛 주인${c ? ` ${esc(c.from.ko)}` : ''}와(과)의 편지 · ${END_KO[done.end] || ''}</p>` +
    (paper && c ? `<div class="sp-paper"><h3 class="gr-h">받은 문서</h3><p class="sp-tag" lang="en">${marked(c.ends.third.note.en)}</p><p class="sp-tag ko">${esc(c.ends.third.note.ko)}</p></div>` : '') + go;
}

/* ---------- the screen: two streets, five shops, and the shelf in Borgin's back room */
const PHOTO = {p: [1080, 1910], w: [1920, 1086]};
const PLACES = {
  /* a street is its picture and its name at the foot of it: the doors are the names of light on the picture (no card of rows underneath — user, 2026-10-12) */
  diagon: {photo: 'diagon', ttl: 'Diagon Alley', line: '비에 젖은 돌길. 등불이 닿지 않는 골목이 하나 있다.',
    spots: [{id: 'apothecary', ko: '약재상', p: [.19, .40, 'l'], w: [.14, .40, 'l']}, {id: 'weasleys', ko: '장난감 가게', p: [.557, .50, 't'], w: [.40, .50, 't']},
      {id: 'borgin', ko: '녹턴 앨리', p: [.83, .455, 't'], w: [.835, .47, 't']}, {id: 'ollivander', ko: '올리밴더', p: [.915, .525, 'r'], w: [.94, .50, 'r']}]},   // the shops' English names do not fit under four doors on a phone (tried 2026-10-12: they run into each other)
  hogsmeade: {photo: 'hogsmeade', ttl: 'Hogsmeade', line: '눈 덮인 큰길. 과자 가게 창만 분홍빛으로 환하다.',
    spots: [{id: 'honeydukes', ko: '허니듀크스', p: [.25, .53, 'l'], w: [.195, .64, 'l']}, {id: 'broomsticks', ko: '스리 브룸스틱스', p: [.87, .50, 'r'], w: [.85, .62, 'r']}]},
  honeydukes: {shop: true, street: 'hogsmeade', photo: 'honeydukes', ttl: 'Honeydukes', head: 'Honeydukes', sub: '호그스미드의 과자 가게 · 과자 열 가지', tip: '과자는 선물로 보낼 수 있다. 누가 무엇을 좋아하는지는 보내 봐야 안다.'},
  apothecary: {shop: true, street: 'diagon', photo: 'apothecary', ttl: 'Slug & Jiggers', head: 'Slug & Jiggers Apothecary', sub: '다이애건 앨리의 약재상 · 약재 열 가지', tip: '약재도 선물이 된다. 반길 사람은 많지 않지만, 반기는 사람은 진심으로 반긴다.'},
  broomsticks: {shop: true, street: 'hogsmeade', photo: 'broomsticks', ttl: 'The Three Broomsticks', head: 'The Three Broomsticks', sub: '호그스미드의 주점 · 병에 든 버터맥주', tip: '버터맥주는 친구에게 쓰는 편지에 붙여 보낸다.'},
  weasleys: {shop: true, street: 'diagon', photo: 'weasleys', ttl: "Weasleys' Wizard Wheezes", head: "Weasleys' Wizard Wheezes", sub: '다이애건 앨리의 장난감 가게 · 과자 상자, 잉크, 편지지', tip: '잉크와 편지지는 친구에게 편지를 쓸 때 고른다.'},
  borgin: {shop: true, street: 'diagon', photo: 'borgin', ttl: 'Borgin and Burkes', head: 'Borgin and Burkes', sub: '녹턴 앨리 · 물건마다 하나뿐', tip: '산 물건은 가게 밖으로 들고 나갈 수 없다. 보긴 씨가 뒷방 선반에 맡아 둔다.'},
  shelf: {shop: true, shelf: true, street: 'borgin', photo: 'borgin', ttl: 'The Back Room', head: 'The Back Room'}
};
/* the twelve compartments of the shelf (assets/shop/borgin-shelf.webp, 1200 × 1608): centre of each column, floor of each row, as fractions */
const COL = [.21, .50, .79], FLOOR = [.249, .463, .657, .858], NICHE = 15;   // NICHE: the side of a thing's picture, % of the shelf's height
export function initTown(app){
  const sec = $('#town'), ph = $('#twPhoto');
  let view = 'diagon', visit = null;
  const price = g => manor.money(g.s * SICKLE);
  function placeSpots(){
    const P = PLACES[view], r = ph.getBoundingClientRect(); if (!r.width || !P.spots) return;
    const wide = matchMedia('(min-aspect-ratio: 1/1)').matches, [iw, ih] = PHOTO[wide ? 'w' : 'p'];
    const k = Math.max(r.width / iw, r.height / ih), dw = iw * k, dh = ih * k, ox = (r.width - dw) * .5, oy = (r.height - dh) * (wide ? .5 : .35);
    $('#twSpots').querySelectorAll('[data-spot]').forEach(b => {
      const t = P.spots.find(x => x.id === b.dataset.spot); if (!t) return;
      const [fx, fy, side] = wide ? t.w : t.p;
      b.className = 'me-spot ' + side;
      b.style.left = Math.max(26, Math.min(r.width - 26, ox + fx * dw)) + 'px'; b.style.top = (oy + fy * dh) + 'px';
    });
  }
  function drawStreet(P){
    $('#twWho').textContent = P.ttl; $('#twLine').innerHTML = `<span class="k">${esc(P.line)}</span>`;
    $('#twSpots').innerHTML = P.spots.map(t => `<button type="button" class="me-spot" data-spot="${t.id}" aria-label="${esc(t.ko)}"><i aria-hidden="true"></i><b>${esc(t.ko)}</b></button>`).join('');
    placeSpots();
  }
  /* what Mr Borgin says today: the first visit, a bare counter, a light purse, a shelf half full — or one of his ordinary greetings */
  function borginSays(){
    if (!TEXT) return null;
    if (visit) return visit;   // how a correspondence ended, or a spare brought out: taken once a visit (owners.borginWord)
    const g = TEXT.borgin.greet, m = st2(), n = darkCount(), left = DARK.filter(x => onCounter(x));
    if (!m.borginSeen) return g.first;
    if (!left.length) return g.done;
    if (left.every(x => manor.purse() < x.s * SICKLE)) return g.empty;
    if (n >= 6 && pick([0, 1, 2], 'half') === 0) return g.half;
    return pick(g.back, 'borgin');
  }
  const row = (g, small) => `<li><button type="button" class="mn-obj done sp-good${g.kind === 'dark' ? ' sp-dark' : ''}" data-good="${g.id}"><span class="pic"><img src="${art(g.id)}" alt="" loading="lazy"></span>` +
    `<span class="tx"><b lang="en">${esc(g.en)}</b><em>${esc(g.ko)}</em><small>${small}</small></span></button></li>`;
  function drawShop(P){
    const says = view === 'borgin' ? borginSays() : view === 'weasleys' && TEXT ? pick(TEXT.weasley.greet, 'w') : null;
    $('#twHead').innerHTML = `<span lang="en">${esc(P.head)}</span><small>${esc(P.sub)}</small>` + (says ? `<p class="sp-says">${say(says)}</p>` : '') + `<em>주머니 · ${esc(manor.money(manor.purse()))}</em>`;
    const goods = GOODS.filter(g => g.shop === view && onCounter(g));
    $('#twGrid').innerHTML = goods.map(g => row(g, price(g) + (g.kind === 'ink' ? (inkLeft(g.id) ? ` · 편지 ${inkLeft(g.id)}통분 남음` : ' · 편지 열 통분') : g.kind === 'paper' ? (paperLeft(g.id) ? ` · ${paperLeft(g.id)}장 남음` : ' · 열 장') : g.kind === 'dark' ? '' : have(g.id) ? ` · 봉지에 ${have(g.id)}개` : ''))).join('') +
      (view === 'borgin' ? `<li><button type="button" class="mn-obj done sp-good sp-toshelf" data-spot="shelf"><span class="tx"><b lang="en">The Back Room</b><em>뒷방 · 맡아 둔 선반</em><small>맡아 둔 물건 ${darkCount()}점</small></span></button></li>` : '');
    $('#twTip').textContent = view === 'borgin' && !goods.length ? '계산대가 비었다. 내놓을 물건이 생기면 보긴 씨가 꺼내 온다.' : P.tip;
  }
  function drawShelf(P){
    const mine = DARK.filter(g => owns(g.id)), cap = TEXT ? TEXT.borgin.shelf[mine.length % 2] : null;
    $('#twShelfIn').innerHTML = DARK.map(g => ({g, i: owns(g.id) ? placeOf(g) : null})).map(({g, i}) => i == null ? '' :
      `<button type="button" class="tw-on" data-good="${g.id}" aria-label="${esc(g.ko)}" style="left:${COL[i % 3] * 100}%;bottom:${((1 - FLOOR[Math.floor(i / 3)]) * 100).toFixed(1)}%;height:${NICHE}%;--drop:${g.drop || 0}%"><img src="${art(g.id)}" alt=""></button>`).join('');
    $('#twShelfCap').innerHTML = mine.length ? (cap ? say(cap) : '') + `<small>맡아 둔 물건 ${mine.length}점</small>` : `<span class="k">선반은 아직 비어 있다. 칸마다 빈 놋쇠 이름표만 붙어 있다.</span>`;
  }
  function draw(){
    const P = PLACES[view], pic = f => `url("${new URL(`assets/rooms/${P.photo}-${f}.webp`, location.href).href}")`;
    ph.style.setProperty('--p', pic('portrait')); ph.style.setProperty('--w', pic('wide'));
    $('#twTtl').textContent = P.shop ? P.ttl : '';   // on a street the name stands large at the foot of the picture instead
    $('#twCard').hidden = !!P.shop; $('#twSpots').hidden = !!P.shop; $('#twShop').hidden = !P.shop || !!P.shelf; $('#twShelf').hidden = !P.shelf;
    sec.classList.toggle('shop', !!P.shop); sec.dataset.view = view;
    if (P.shelf) drawShelf(P); else if (P.shop) drawShop(P); else drawStreet(P);
  }
  function goodSheet(id){
    const g = good(id); if (!g) return;
    const t = tagOf(g), mine = g.kind === 'dark' && owns(id), short = manor.purse() < g.s * SICKLE, coin = g.s >= 17 ? 'galleon' : 'sickle';
    const label = g.kind === 'dark' ? '산다 · 뒷방 선반에 맡긴다' : g.kind === 'ink' || g.kind === 'paper' ? '산다' : '산다 · 종이 봉지에 담기';
    openSheet(`<div class="sh-kind"><span>${esc(PLACES[g.shop].head)}</span><span>${mine ? `맡아 둠 · ${st2().dark[id].slice(5).replace(/^0/, '').replace('-0', '-').replace('-', '월 ')}일` : g.kind === 'ink' && inkLeft(id) ? `편지 ${inkLeft(id)}통분` : g.kind === 'paper' && paperLeft(id) ? `${paperLeft(id)}장` : have(id) ? `봉지에 ${have(id)}개` : ''}</span></div>` + fig(g, true) +
      `<p class="sp-tag" lang="en">${marked(t.en)}</p><p class="sp-tag ko">${esc(t.ko)}</p>` + keysOf(t) +
      (mine ? ownerLine(g) : `<p class="mn-paid"><img src="assets/money/${coin}.webp" alt=""><b>${price(g)}</b><span>주머니 · ${esc(manor.money(manor.purse()))}</span></p>` +
        `<button type="button" class="sh-drill" data-buy="${g.id}"${short ? ' disabled' : ''}>${short ? '주머니가 모자란다' : label}</button>`));
  }
  const enter = id => { if (id === 'ollivander') app.go('#/ollivander/again'); else app.go('#/town/' + id); };
  $('#twSpots').addEventListener('click', e => { const b = e.target.closest('[data-spot]'); if (b) enter(b.dataset.spot); });
  $('#twGrid').addEventListener('click', e => { const s = e.target.closest('[data-spot]'); if (s){ enter(s.dataset.spot); return; } const b = e.target.closest('[data-good]'); if (b) goodSheet(b.dataset.good); });
  $('#twShelfIn').addEventListener('click', e => { const b = e.target.closest('[data-good]'); if (b) goodSheet(b.dataset.good); });
  $('#sheetBody').addEventListener('click', e => {
    const b = e.target.closest('[data-buy]'); if (!b || sec.hidden) return;
    const g = good(b.dataset.buy), err = buy(g.id);
    if (err === 'full'){ const l = TEXT && TEXT.weasley.snack.full; toast(l ? say(l) : '두 상자까지 둘 수 있다.', 3400, !!l); return; }
    if (err){ toast(esc(err)); return; }
    closeSheet(); draw();
    const eul = /[가-힣]$/.test(g.ko) && (g.ko.charCodeAt(g.ko.length - 1) - 0xAC00) % 28 ? '을' : '를';
    if (g.kind === 'dark'){ const l = TEXT && TEXT.borgin.sold[g.key]; toast(l ? say(l) : `<span class="k">${esc(g.ko)}${eul} 뒷방 선반에 맡겼다.</span>`, 4600, true); }
    else if (g.kind === 'ink' || g.kind === 'paper') toast(`<span class="q" lang="en">Yours.</span><span class="k">${esc(g.ko)}${eul} 샀다. 친구에게 편지를 쓸 때 고를 수 있다.</span>`, 3000, true);
    else toast(`<span class="q" lang="en">Into the paper bag.</span><span class="k">${esc(g.ko)}${eul} 종이 봉지에 담았다. 봉지는 내 방에 있다.</span>`, 2800, true);
  });
  const back = () => { const P = PLACES[view]; if (P.shop) app.go('#/town/' + P.street); else floo(app, '#/me'); };
  $('#twBack').addEventListener('click', back);
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else back(); } });
  async function show({id}){
    if (!isOpen()){ app.go('#/me', true); return; }
    view = PLACES[id] ? id : 'diagon'; visit = null;
    draw();
    if (PLACES[view].shop){ $('#twShop').scrollTop = 0; await Promise.all([loadText(), owners.load()]); if (sec.hidden) return; if (view === 'borgin') visit = owners.borginWord(); draw(); if (view === 'borgin' && !st2().borginSeen){ st2().borginSeen = srs.today(); store.save(); } }
  }
  return {show, resize: placeSpots, refresh: () => { if (!sec.hidden) draw(); }};
}
