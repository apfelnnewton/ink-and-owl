/* The shops (2026-10-12 user decision, phase 3-가): somewhere to spend what the manor pays.
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
   ?shops in the address opens the two places at once (testing). */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as doors from './doors.js';
import * as manor from './manor.js';
import * as bella from './bella.js';
import {floo} from './fire.js';
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
  ['porcupine-quills', 'apothecary', 'ingredient', 'Porcupine Quills', '호저 가시', 8, 'Added after the cauldron comes off the fire. Not before.', '솥을 불에서 내린 뒤에 넣는다. 그 전이 아니라.'],
  ['lacewing-flies', 'apothecary', 'ingredient', 'Lacewing Flies', '풀잠자리', 10, 'To be stewed for twenty-one days.', '스물하루 동안 뭉근히 달여야 한다.'],
  ['powdered-moonstone', 'apothecary', 'ingredient', 'Powdered Moonstone', '월장석 가루', 12, 'For a hand that does not shake when it measures.', '분량을 잴 때 떨리지 않는 손을 위한 재료.'],
  ['aconite', 'apothecary', 'ingredient', 'Aconite', '투구꽃', 14, 'Also called monkshood; also called wolfsbane.', '몽크스후드라고도, 울프스베인이라고도 부른다.'],
  ['bezoar', 'apothecary', 'ingredient', 'A Bezoar', '베조아르', 15, 'A stone from the stomach of a goat. It will save you from most poisons.', '염소 위에서 꺼낸 돌. 웬만한 독은 막아 준다.'],
  ['boomslang-skin', 'apothecary', 'ingredient', 'Boomslang Skin', '붐슬랭 껍질', 17, 'Scarce. The apothecary asks no questions and answers none.', '귀한 물건. 약재상은 묻지도 않고 대답하지도 않는다.'],
  ['butterbeer', 'broomsticks', 'drink', 'Butterbeer', '버터맥주', 3, 'A bottle to send with a letter. The owls carry it under protest.', '편지와 함께 보내는 한 병. 부엉이는 투덜대면서도 나른다.', 'butterbeer']
].map(([id, shop, kind, en, ko, s, tag, tagKo, wire]) => ({id, shop, kind, en, ko, s, tag, tagKo, wire: wire || ''}));
export const good = id => GOODS.find(g => g.id === id);
export const byWire = w => GOODS.find(g => g.wire && g.wire === w) || null;
export const art = id => `assets/shop/${id}.webp`;
const price = g => g.s === 17 ? '1갈레온' : `${g.s}시클`;

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
  const cost = g.s * SICKLE; if (manor.purse() < cost) return '주머니가 가볍다. 저택에서 하루 더 일해야 한다.';
  manor.earn(-cost); st().bag[id] = have(id) + 1; store.save();
  return '';
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
  const data = GIFTS && GIFTS[id]; if (!data) return null;
  let m;
  if ((m = key.match(/^GM~(5|10)$/))){ const n = data[m[1] === '5' ? 'fifth' : 'tenth']; return n ? {kind: '답장', ...n} : null; }
  if (!(m = key.match(/^GF~([a-z-]+)~(a?)(\d)(?:~\d+)?$/))) return null;
  const it = data.items[m[1]], g = good(m[1]); if (!it || !g) return null;
  const n = m[2] ? data.again[+m[3]] : it.replies[+m[3]];
  return n ? {kind: '답장', ...n, thing: {id: g.id, en: g.en, ko: g.ko, back: !m[2] && (it.taste === -1 || !!it.back)}} : null;
}

/* ---------- each day: the two places open; yesterday's presents are answered */
export async function daily(){
  const m = st(), s = store.get(), t = srs.today();
  if (!m.open && s.settings.named && manor.isOpen() && (((s.manor || {}).days || 0) >= 1 || new URLSearchParams(location.search).has('shops'))) m.open = t;
  if (!m.due.some(x => x.d < t)) return;
  await load(); if (!GIFTS) return;
  await Promise.all([...new Set(m.due.map(x => x.who))].map(w => bond.load(w)));
  m.due = m.due.filter(x => {
    if (x.d >= t) return true;
    if (!bond.postItem(x.who, x.key)) return false;   // said already, or nothing to say: let it go
    if (x.pts) bond.gain(x.who, x.pts);
    if (x.back && x.item) m.bag[x.item] = (m.bag[x.item] || 0) + 1;
    return false;
  });
  store.save();
}

/* ---------- the paper bag in the guest's room: what has been bought, and to whom it may go */
const fig = (g, big) => `<figure class="sp-fig${big ? ' big' : ''}"><img src="${art(g.id)}" alt=""><figcaption><b lang="en">${esc(g.en)}</b><span>${esc(g.ko)}</span></figcaption></figure>`;
export function bagSheet(){
  const list = owned();
  openSheet(`<div class="sh-kind"><span>종이 봉지</span><span>${list.length ? `${bagCount()}개` : ''}</span></div>` +
    `<figure class="purse-fig"><img src="${art('bag')}" alt=""></figure>` +
    (list.length ? `<ul class="sp-bag">${list.map(g => `<li><button type="button" data-bagitem="${g.id}"><img src="${art(g.id)}" alt=""><span><b lang="en">${esc(g.en)}</b><em>${esc(g.ko)}</em></span><i>× ${have(g.id)}</i></button></li>`).join('')}</ul>` +
        `<p class="purse-note">${sentToday() ? '오늘은 이미 선물을 하나 보냈다. 다음은 내일.' : '물건을 누르면 누구에게 보낼지 고른다. 선물은 하루에 하나.'}</p>`
      : `<p class="purse-note">비어 있다. 벽난로의 플루 가루로 호그스미드나 다이애건 앨리에 가면 채울 수 있다.</p>`) +
    `<p class="purse-note">주머니 · ${esc(manor.money(manor.purse()))}</p>`);
}
function itemSheet(id){
  const g = good(id); if (!g || !have(id)) return bagSheet();
  const who = recipients(), busy = sentToday(), drink = g.kind === 'drink';
  openSheet(`<div class="sh-kind"><span>종이 봉지 · ${have(id)}개</span></div>` + fig(g, true) +
    `<p class="sp-tag" lang="en">${esc(g.tag)}</p><p class="sp-tag ko">${esc(g.tagKo)}</p>` +
    (drink ? `<p class="purse-note">버터맥주는 친구에게만 보낸다. 친구에게 편지를 쓸 때 함께 붙일 수 있다.</p><button type="button" class="sh-drill" data-baggo="#/letters/friends">편지함 · 친구 칸으로</button>`
      : `<h3 class="gr-h">${busy ? '오늘은 이미 하나 보냈다 · 다음은 내일' : '누구에게 보낼까'}</h3>` +
        `<ul class="sp-who">${who.map(d => { const n = ((st().sent[d.id] || {})[id]) || 0;
          return `<li><button type="button" data-give="${d.id}" data-item="${id}"${busy ? ' disabled' : ''}><i class="seal s-${d.id}"></i><span>${esc(d.ko)}</span><em>${n ? `${n}번 보냄` : ''}</em></button></li>`; }).join('')}</ul>` +
        (g.wire ? `<p class="purse-note">과자는 친구에게 쓰는 편지에도 붙일 수 있다.</p>` : '')) +
    `<button type="button" class="clink sp-back" data-bagback>봉지로 돌아가기</button>`);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('#sheetBody [data-bagitem], #sheetBody [data-give], #sheetBody [data-bagback], #sheetBody [data-baggo]'); if (!b) return;
  if (b.dataset.bagitem){ await load(); itemSheet(b.dataset.bagitem); return; }
  if (b.hasAttribute('data-bagback')){ bagSheet(); return; }
  if (b.dataset.baggo){ closeSheet(); location.hash = b.dataset.baggo; return; }
  await Promise.all([load(), bond.load(b.dataset.give)]);
  const err = give(b.dataset.give, b.dataset.item);
  if (err){ toast(esc(err)); return; }
  closeSheet();
});

/* ---------- the screen: two streets and three shops */
const PHOTO = {p: [1080, 1910], w: [1920, 1086]};
const PLACES = {
  diagon: {photo: 'diagon', ttl: 'Diagon Alley', who: 'Diagon Alley', line: '런던 · 비 그친 밤의 다이애건 앨리. 가스등 아래 가게 창마다 불이 켜져 있다.',
    spots: [{id: 'apothecary', ko: '약재상', p: [.19, .40, 'l'], w: [.19, .42, 'l']}, {id: 'ollivander', ko: '올리밴더', p: [.885, .44, 'r'], w: [.90, .46, 'r']}],
    rows: [['apothecary', '약재상', 'Slug & Jiggers Apothecary'], ['ollivander', '지팡이 가게', 'Ollivanders']]},
  hogsmeade: {photo: 'hogsmeade', ttl: 'Hogsmeade', who: 'Hogsmeade', line: '눈 덮인 호그스미드 큰길. 과자 가게 창만 분홍빛으로 환하다.',
    spots: [{id: 'honeydukes', ko: '허니듀크스', p: [.25, .53, 'l'], w: [.195, .64, 'l']}, {id: 'broomsticks', ko: '스리 브룸스틱스', p: [.87, .50, 'r'], w: [.85, .62, 'r']}],
    rows: [['honeydukes', '과자 가게', 'Honeydukes'], ['broomsticks', '주점', 'The Three Broomsticks']]},
  honeydukes: {shop: true, street: 'hogsmeade', photo: 'honeydukes', ttl: 'Honeydukes', head: 'Honeydukes', sub: '호그스미드의 과자 가게 · 과자 열 가지', tip: '과자는 선물로 보낼 수 있다. 누가 무엇을 좋아하는지는 보내 봐야 안다.'},
  apothecary: {shop: true, street: 'diagon', photo: 'apothecary', ttl: 'Slug & Jiggers', head: 'Slug & Jiggers Apothecary', sub: '다이애건 앨리의 약재상 · 약재 일곱 가지', tip: '약재도 선물이 된다. 반길 사람은 많지 않지만, 반기는 사람은 진심으로 반긴다.'},
  broomsticks: {shop: true, street: 'hogsmeade', photo: 'broomsticks', ttl: 'The Three Broomsticks', head: 'The Three Broomsticks', sub: '호그스미드의 주점 · 병에 든 버터맥주', tip: '버터맥주는 친구에게 쓰는 편지에 붙여 보낸다.'}
};
export function initTown(app){
  const sec = $('#town'), ph = $('#twPhoto');
  let view = 'diagon';
  const go = (label, attr, cls = '') => `<button type="button" class="cgo ${cls}" ${attr}><span>${label}</span><i aria-hidden="true">→</i></button>`;
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
    $('#twWho').textContent = P.who;
    $('#twLine').innerHTML = `<span class="k">${esc(P.line)}</span>`;
    $('#twGo').innerHTML = P.rows.map(([id, ko, en], i) => go(`${esc(ko)} <em lang="en">${esc(en)}</em>`, `data-spot="${id}"`, i ? 'me-second' : '')).join('');
    $('#twSpots').innerHTML = P.spots.map(t => `<button type="button" class="me-spot" data-spot="${t.id}" aria-label="${esc(t.ko)}"><i aria-hidden="true"></i><b>${esc(t.ko)}</b></button>`).join('');
    placeSpots();
  }
  function drawShop(P){
    $('#twHead').innerHTML = `<span lang="en">${esc(P.head)}</span><small>${esc(P.sub)}</small><em>주머니 · ${esc(manor.money(manor.purse()))}</em>`;
    $('#twGrid').innerHTML = GOODS.filter(g => g.shop === view).map(g =>
      `<li><button type="button" class="mn-obj done sp-good" data-good="${g.id}"><span class="pic"><img src="${art(g.id)}" alt="" loading="lazy"></span>` +
      `<span class="tx"><b lang="en">${esc(g.en)}</b><em>${esc(g.ko)}</em><small>${price(g)}${have(g.id) ? ` · 봉지에 ${have(g.id)}개` : ''}</small></span></button></li>`).join('');
    $('#twTip').textContent = P.tip;
  }
  function draw(){
    const P = PLACES[view], pic = f => `url("${new URL(`assets/rooms/${P.photo}-${f}.webp`, location.href).href}")`;
    ph.style.setProperty('--p', pic('portrait')); ph.style.setProperty('--w', pic('wide'));
    $('#twTtl').textContent = P.ttl;
    $('#twCard').hidden = !!P.shop; $('#twSpots').hidden = !!P.shop; $('#twShop').hidden = !P.shop;
    sec.classList.toggle('shop', !!P.shop); sec.dataset.view = view;
    if (P.shop) drawShop(P); else drawStreet(P);
  }
  function goodSheet(id){
    const g = good(id); if (!g) return;
    const short = manor.purse() < g.s * SICKLE;
    openSheet(`<div class="sh-kind"><span>${esc(PLACES[g.shop].head)}</span><span>${have(id) ? `봉지에 ${have(id)}개` : ''}</span></div>` + fig(g, true) +
      `<p class="sp-tag" lang="en">${esc(g.tag)}</p><p class="sp-tag ko">${esc(g.tagKo)}</p>` +
      `<p class="mn-paid"><img src="assets/money/${g.s === 17 ? 'galleon' : 'sickle'}.webp" alt=""><b>${price(g)}</b><span>주머니 · ${esc(manor.money(manor.purse()))}</span></p>` +
      `<button type="button" class="sh-drill" data-buy="${g.id}"${short ? ' disabled' : ''}>${short ? '주머니가 모자란다' : '산다 · 종이 봉지에 담기'}</button>`);
  }
  const enter = id => { if (id === 'ollivander') app.go('#/ollivander/again'); else app.go('#/town/' + id); };
  $('#twSpots').addEventListener('click', e => { const b = e.target.closest('[data-spot]'); if (b) enter(b.dataset.spot); });
  $('#twGo').addEventListener('click', e => { const b = e.target.closest('[data-spot]'); if (b) enter(b.dataset.spot); });
  $('#twGrid').addEventListener('click', e => { const b = e.target.closest('[data-good]'); if (b) goodSheet(b.dataset.good); });
  $('#sheetBody').addEventListener('click', e => {
    const b = e.target.closest('[data-buy]'); if (!b || sec.hidden) return;
    const err = buy(b.dataset.buy); if (err){ toast(esc(err)); return; }
    const g = good(b.dataset.buy); closeSheet(); draw();
    toast(`<span class="q" lang="en">Into the paper bag.</span><span class="k">${esc(g.ko)}${/[가-힣]$/.test(g.ko) && (g.ko.charCodeAt(g.ko.length - 1) - 0xAC00) % 28 ? '을' : '를'} 종이 봉지에 담았다. 봉지는 내 방에 있다.</span>`, 2800, true);
  });
  const back = () => { const P = PLACES[view]; if (P.shop) app.go('#/town/' + P.street); else floo(app, '#/me'); };
  $('#twBack').addEventListener('click', back);
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else back(); } });
  function show({id}){
    if (!isOpen()){ app.go('#/me', true); return; }
    view = PLACES[id] ? id : 'diagon';
    draw();
    if (PLACES[view].shop) $('#twShop').scrollTop = 0;
  }
  return {show, resize: placeSpots, refresh: () => { if (!sec.hidden) draw(); }};
}
