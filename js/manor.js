/* Malfoy Manor (#/manor the entrance hall · #/manor/study the study · #/manor/cabinet the glass cabinet): paid work.
   Lucius Malfoy keeps seven of his own things in the study cabinet; each has heard what he said while he wore it.
   Cleaning one lets the words out — that is the lesson (#/room/lucius, the same ladder as a classroom, fewer new lines
   a day: srs.js NEW_AT) — and when every line of an object is learnt he inspects it (#/room/lucius/insp: up to six of
   its lines, written, no choosing; a miss fails it until tomorrow). A passed object shines and shows its label.
   Wages: the first finished day's work of a day pays 3 Sickles, 4 if nothing was wrong; every fifth day of work a card
   lies on the salver beside them (C01–C12, kept in the post under his name). No bond: he does not make friends.
   He sends for the guest once they have a wand and three professors' doors open (a card by owl, CARD).
   The drawing room (Bellatrix) stays shut until its own work is written.
   state.manor = {open: date, days, pay: {d, s, v}, insp: {<object>: {d, ok}}, cur: <object under inspection>}
   state.purse = money in Knuts (1 Galleon = 17 Sickles = 493 Knuts)      ?manor in the address sends the card at once */
import {byId, PROFS} from './decks.js';
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as doors from './doors.js';
import * as wand from './wand.js';
import {floo} from './fire.js';
import {$, esc, toast, openSheet, closeSheet, isSheetOpen} from './ui.js';

const ID = 'lucius';
const SICKLE = 29, GALLEON = 493, WAGE = 3, CARD_EVERY = 5, ASKED = 6;
/* how many of the deck's lines each object heard, in the order of the films (docs/plan-newfaces.md §3) */
const SIZES = [10, 8, 11, 5, 5, 8, 10];
const st = () => { const s = store.get(); return s.manor || (s.manor = {}); };
export const isOpen = () => !!st().open;
const pad2 = n => String(n).padStart(2, '0');
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const fmt = t => { const [, m, d] = t.split('-').map(Number); return `${m}월 ${d}일`; };
const art = n => new URL(`assets/manor/object-${n}.webp`, location.href).href;

/* ---------- money */
export const purse = () => store.get().purse || 0;
export const coins = k => ({g: Math.floor(k / GALLEON), s: Math.floor(k % GALLEON / SICKLE), k: k % SICKLE});
export function money(k){
  const c = coins(k), out = [c.g && `${c.g}갈레온`, c.s && `${c.s}시클`, c.k && `${c.k}크넛`].filter(Boolean);
  return out.length ? out.join(' ') : '빈 주머니';
}
const earn = k => { store.get().purse = purse() + k; };
const coinRow = k => { const c = coins(k);
  return `<ul class="purse-coins">${[['galleon', 'Galleons', '갈레온', c.g], ['sickle', 'Sickles', '시클', c.s], ['knut', 'Knuts', '크넛', c.k]].map(([f, en, ko, n]) =>
    `<li class="${n ? '' : 'none'}"><img src="assets/money/${f}.webp" alt=""><b>${n}</b><span lang="en">${en}</span><small>${ko}</small></li>`).join('')}</ul>`; };
/* the purse in the guest room: what is in it (the shops that take it are not open yet) */
export const purseSheet = () => `<div class="sh-kind"><span>동전 주머니</span></div><figure class="purse-fig"><img src="assets/money/purse.webp" alt=""></figure>` +
  `<h2 class="sh-expr" id="shTitle" lang="en">The Coin Purse</h2>${coinRow(purse())}` +
  `<p class="purse-note">1갈레온 = 17시클 · 1시클 = 29크넛</p><p class="purse-note">말포이 저택에서 일하고 받은 삯이 여기 모인다.</p>`;

/* ---------- the seven objects */
const usable = cards => cards.filter(c => c.card !== false).slice().sort((a, b) => a.order - b.order);
export function objects(cards){
  const list = usable(cards || []), ds = store.deck(ID).cards, m = st(), t = srs.today(), names = (bond.loaded(ID) || {}).objects || [];
  let at = 0;
  return SIZES.map((n, i) => {
    const cs = list.slice(at, at + n); at += n;
    const seen = cs.filter(c => ds[c.id]).length, r = (m.insp || {})[i + 1];
    const state = r && r.ok ? 'done' : cs.length && seen >= cs.length ? (r && r.d === t ? 'wait' : 'ready') : seen ? 'work' : 'new';
    return {id: i + 1, cards: cs, seen, total: cs.length, state, date: r && r.d, ...(names[i] || {})};
  });
}
/* the lines he asks for at an inspection: up to six of the object's, in an order fixed for the day */
export function inspectIds(cards){
  const o = objects(cards).find(x => x.id === st().cur && x.state === 'ready'); if (!o) return null;
  /* which six is the day's chance; they are asked in the order they were said */
  const pick = new Set(o.cards.map(c => [hash(srs.today() + c.id), c.id]).sort((a, b) => a[0] - b[0]).slice(0, ASKED).map(x => x[1]));
  return o.cards.filter(c => pick.has(c.id)).map(c => c.id);
}
export const inspecting = () => { const d = bond.loaded(ID), o = d && d.objects.find(x => x.id === st().cur); return o || null; };
/* his verdict on the last inspection, for the end of the day's work (report.js) */
export function verdict(){
  const m = st(), d = bond.loaded(ID), r = (m.insp || {})[m.cur]; if (!d || !r) return null;
  const set = d.inspect[r.ok ? 'pass' : 'fail'];
  return {ok: r.ok, name: (inspecting() || {}).name, ...set[hash(r.d + m.cur) % set.length]};
}
/* today's wages, in his words */
export function wages(){
  const m = st(), d = bond.loaded(ID); if (!d || !m.pay || m.pay.d !== srs.today()) return null;
  const a = d.pay.base[m.pay.v % d.pay.base.length], b = m.pay.s > WAGE ? d.pay.perfect[m.pay.v % d.pay.perfect.length] : null;
  const card = m.pay.card && bond.itemOf(ID, m.pay.card) ? m.pay.card : '';
  return {s: m.pay.s, en: a.en + (b ? ' ' + b.en : ''), ko: a.ko + (b ? ' ' + b.ko : ''), card};
}
/* the block for the end-of-work sheet (report.js) */
export function reportBlock(){
  const w = wages(); if (!w) return '';
  return `<h2>오늘의 삯</h2><div class="rx-say"><p class="q" lang="en">${esc(w.en)}</p><p class="k">${esc(w.ko)}</p></div>` +
    `<p class="mn-paid"><img src="assets/money/sickle.webp" alt=""><b>${w.s}시클</b><span>주머니 · ${esc(money(purse()))}</span></p>` +
    (w.card ? `<button type="button" class="rp-teago" data-go="#/letters/${ID}/${w.card}">은쟁반에 카드 한 장이 놓여 있다 →</button>` : '');
}

srs.hooks.push(ev => {
  if (ev.deckId !== ID) return;
  const m = st(), t = srs.today();
  if (ev.kind === 'insp' && ev.roundDone && m.cur){
    const r = (store.deck(ID).day || {}).insp, ok = !!r && !Object.values(r.results).includes('again');
    (m.insp || (m.insp = {}))[m.cur] = {d: t, ok};
  }
  if (!ev.kind && ev.dayDone && (!m.pay || m.pay.d !== t)){
    m.days = (m.days || 0) + 1;
    const s = WAGE + (ev.dayPerfect ? 1 : 0);
    earn(s * SICKLE);
    m.pay = {d: t, s, v: m.days};
    if (m.days % CARD_EVERY === 0){ const k = 'C' + pad2(m.days / CARD_EVERY); if (bond.postItem(ID, k)) m.pay.card = k; }
  }
});

/* ---------- the card that sends for the guest; the words of his post */
export function daily(){
  const m = st(), s = store.get();
  if (m.open || !s.settings.named) return;
  const force = new URLSearchParams(location.search).has('manor');
  if (!force && !(wand.get() && PROFS.filter(d => doors.isOpen(d.id)).length >= 3)) return;
  if (!bond.postItem(ID, 'CARD')) return;
  m.open = srs.today();
  store.save();
}
export function textOf(key, d){
  if (!d) return null;
  if (key === 'CARD') return {kind: '카드', ...d.card, go: '#/fire', btn: '벽난로로 간다 · 플루 가루'};
  return /^C\d\d$/.test(key) && d.cards[key] ? {kind: '카드', ...d.cards[key]} : null;
}

/* ---------- the screen */
const PHOTO = {p: [1080, 1910], w: [1920, 1086]};
/* things in the two pictures (fractions of the photograph, tall and wide; side of the label as in myroom.js) */
const SPOTS = {
  hall: [{id: 'study', ko: '서재', p: [.125, .47, 'l'], w: [.065, .56, 'l']}, {id: 'drawing', ko: '응접실', p: [.875, .47, 'r'], w: [.935, .56, 'r']}],
  study: [{id: 'cabinet', ko: '유리장', p: [.48, .335, 't'], w: [.48, .40, 't']}, {id: 'salver', ko: '은쟁반', p: [.755, .69, 't'], w: [.84, .80, 't']}]
};

export function initManor(app){
  const sec = $('#manor'), ph = $('#mnPhoto');
  let view = 'hall';
  const go = (label, attr, cls = '') => `<button type="button" class="cgo ${cls}" ${attr}><span>${label}</span><i aria-hidden="true">→</i></button>`;
  const cardsOf = () => app.data[ID] || null;

  function photo(name){
    const pic = f => `url("${new URL(`assets/rooms/${name}-${f}.webp`, location.href).href}")`;
    ph.style.setProperty('--p', pic('portrait')); ph.style.setProperty('--w', pic('wide'));
  }
  /* the same crop as the photograph (background-size: cover; tall: centred, 35% down; wide: centred) */
  function placeSpots(){
    const r = ph.getBoundingClientRect(); if (!r.width) return;
    const wide = matchMedia('(min-aspect-ratio: 1/1)').matches, [iw, ih] = PHOTO[wide ? 'w' : 'p'];
    const k = Math.max(r.width / iw, r.height / ih), dw = iw * k, dh = ih * k, ox = (r.width - dw) * .5, oy = (r.height - dh) * (wide ? .5 : .35);
    $('#mnSpots').querySelectorAll('[data-spot]').forEach(b => {
      const t = (SPOTS[view] || []).find(x => x.id === b.dataset.spot); if (!t) return;
      const [fx, fy, side] = wide ? t.w : t.p;
      b.className = 'me-spot ' + side;
      /* a narrow phone crops the sides of the picture: a thing at its edge keeps its light on the screen */
      b.style.left = Math.max(26, Math.min(r.width - 26, ox + fx * dw)) + 'px'; b.style.top = (oy + fy * dh) + 'px';
    });
  }
  function spots(small = {}){
    $('#mnSpots').innerHTML = (SPOTS[view] || []).map(t => `<button type="button" class="me-spot" data-spot="${t.id}" aria-label="${esc(t.ko)}"><i aria-hidden="true"></i><b>${esc(t.ko)}${small[t.id] ? `<small>${esc(small[t.id])}</small>` : ''}</b></button>`).join('');
    placeSpots();
  }

  function drawHall(){
    photo('manor-hall');
    $('#mnTtl').textContent = 'Malfoy Manor';
    $('#mnWho').textContent = 'The Entrance Hall';
    $('#mnStats').innerHTML = '';
    $('#mnLine').innerHTML = '<span class="k">윌트셔 · 말포이 저택의 현관 홀. 양쪽에 문이 하나씩 있다.</span>';
    $('#mnGo').innerHTML = go('서재 <em>루시우스 말포이</em>', 'data-to="#/manor/study"') + go('응접실 <em>문이 잠겨 있다</em>', 'data-shut', 'me-second locked');
    spots({drawing: '잠김'});
  }

  function drawStudy(){
    photo(ID);
    $('#mnTtl').textContent = 'The Study';
    $('#mnWho').textContent = byId(ID).who;
    const cards = cardsOf();
    if (!cards){ $('#mnStats').innerHTML = ''; $('#mnLine').innerHTML = '<span class="k">유리장의 자물쇠가 풀리는 중…</span>'; $('#mnGo').innerHTML = ''; spots(); return; }
    const p = srs.preview(ID, cards), g = srs.progress(ID, cards), objs = objects(cards), done = p.done || p.empty;
    const labelled = objs.filter(o => o.state === 'done').length, ready = objs.filter(o => o.state === 'ready'), w = wages();
    $('#mnStats').innerHTML = done ? `<div><b>${g.seen}</b>들은 말 / ${g.total}</div><div><b>${labelled}</b>내력표 / ${objs.length}</div>`
      : `<div><b>${p.review}</b>복습</div><div><b>${p.fresh}</b>새 대사</div><div><b>${labelled}</b>내력표 / ${objs.length}</div>`;
    /* the card stays short, clear of the salver on the desk: his words about the wages are on the salver itself */
    const line = [w && `<span class="k">오늘 삯 ${w.s}시클은 은쟁반 위에 있다</span>`,
      !w && done && `<span class="k">${g.complete ? '물건들은 할 말을 다 했다' : '오늘은 손댈 물건이 없다'}</span>`,
      ready.length && `<span class="bond">검수를 기다리는 물건 · ${esc(ready.map(o => o.name.ko).join(' · '))}</span>`].filter(Boolean).join('');
    $('#mnLine').innerHTML = line; $('#mnLine').hidden = !line;
    $('#mnGo').innerHTML = (done ? (g.seen ? go('더 도전 · 배운 대사 10문제', `data-to="#/room/${ID}/extra"`) : '') : go('일 시작하기', `data-to="#/room/${ID}"`)) +
      (w ? `<button type="button" class="clink" data-to="#/report/${ID}">오늘 한 일 보기</button>` : '');
    spots({cabinet: ready.length ? '검수' : '', salver: w ? `${w.s}시클` : ''});
  }

  /* the glass cabinet: the seven objects, each with how far its cleaning has come */
  const STATE = o => ({new: '아직 손대지 않았다', work: `닦는 중 · ${o.seen} / ${o.total}`, ready: '검수를 기다린다', wait: '내일 다시 검수', done: '내력표를 붙였다'})[o.state];
  function drawCabinet(){
    photo(ID);
    $('#mnTtl').textContent = 'The Glass Cabinet';
    const objs = objects(cardsOf());
    $('#mnGrid').innerHTML = objs.map(o => `<li><button type="button" class="mn-obj ${o.state}" data-obj="${o.id}">` +
      `<span class="pic"><img src="${art(o.id)}" alt="" loading="lazy"></span>` +
      `<span class="tx"><b lang="en">${esc((o.name || {}).en || '')}</b><em>${esc((o.name || {}).ko || '')}</em><small>${esc(STATE(o))}</small></span></button></li>`).join('');
  }
  function openObject(id){
    const o = objects(cardsOf()).find(x => x.id === id); if (!o || !o.name) return;
    const head = `<div class="sh-kind"><span>유리장 · ${o.id} / ${SIZES.length}</span></div>` +
      `<figure class="lt-gift mn-fig ${o.state}"><img src="${art(o.id)}" alt=""><figcaption><b lang="en">${esc(o.name.en)}</b><span>${esc(o.name.ko)}</span></figcaption></figure>`;
    const d = bond.loaded(ID);
    let body;
    if (o.state === 'done') body = `<div class="mn-tag"><small>내력표${o.date ? ' · ' + fmt(o.date) : ''}</small><p lang="en" id="shTitle">${esc(o.tag.en)}</p><p class="ko">${esc(o.tag.ko)}</p></div>`;
    else if (o.state === 'ready') body = `<div class="tea-say"><p class="en" lang="en" id="shTitle">${esc(o.ask.en)}</p><p class="ko">${esc(o.ask.ko)}</p></div>` +
      `<p class="mn-how">이 물건이 들은 말 가운데 ${Math.min(ASKED, o.total)}줄을 직접 쓴다. 하나라도 틀리면 내력표는 내일로 미뤄진다.</p>` +
      `<button type="button" class="sh-drill" data-insp="${o.id}">검수를 받는다</button>`;
    else if (o.state === 'wait'){ const f = d.inspect.fail[hash(o.date + o.id) % d.inspect.fail.length];
      body = `<div class="tea-say"><p class="en" lang="en" id="shTitle">${esc(f.en)}</p><p class="ko">${esc(f.ko)}</p></div><p class="mn-how">내력표는 아직 비어 있다. 내일 다시 검수를 받을 수 있다.</p>`; }
    else body = `<p class="mn-how" id="shTitle">${o.state === 'work' ? `닦는 중이다. 이 물건이 들은 말 ${o.total}줄 가운데 ${o.seen}줄이 새어 나왔다.` : `아직 손대지 않은 물건이다. 앞의 물건을 다 닦으면 차례가 온다. 들은 말은 ${o.total}줄.`}</p>`;
    openSheet(head + body);
  }
  function salver(){
    const w = wages(), m = st(), mail = bond.bondOf(ID).mail.filter(x => /^C\d\d$/.test(x.id)).slice().reverse();
    openSheet(`<div class="sh-kind"><span>은쟁반</span></div><h2 class="sh-expr" id="shTitle" lang="en">The Salver</h2>` +
      (w ? `<div class="tea-say"><p class="en" lang="en">${esc(w.en)}</p><p class="ko">${esc(w.ko)}</p></div>` : `<p class="mn-how">오늘 삯은 아직 놓이지 않았다. 하루 일을 끝까지 하면 시클 ${WAGE}닢, 하나도 틀리지 않으면 한 닢 더.</p>`) +
      coinRow(purse()) + `<p class="purse-note">일한 날 ${m.days || 0}일 · 주머니 ${esc(money(purse()))}</p>` +
      (mail.length ? `<ul class="mn-cards">${mail.map(x => `<li><button type="button" data-go="#/letters/${ID}/${x.id}"><i class="seal s-${ID}"></i><span>카드 · ${fmt(x.t)}</span><em>${x.read ? '' : '새 카드'}</em></button></li>`).join('')}</ul>`
        : `<p class="purse-note">일한 날이 ${CARD_EVERY}일 찰 때마다 삯 옆에 카드가 한 장 놓인다.</p>`));
  }

  /* ---------- events */
  $('#mnGo').addEventListener('click', e => {
    if (e.target.closest('[data-shut]')){ toast('<span class="q" lang="en">The drawing-room door is locked.</span><span class="k">응접실 문은 잠겨 있다. 안쪽에서 누군가 낮게 웃는다.</span>', 2800, true); return; }
    const to = e.target.closest('[data-to]'); if (to) app.go(to.dataset.to);
  });
  $('#mnSpots').addEventListener('click', e => {
    const b = e.target.closest('[data-spot]'); if (!b) return;
    const id = b.dataset.spot;
    if (id === 'study') app.go('#/manor/study');
    else if (id === 'drawing') $('#mnGo [data-shut]').click();
    else if (id === 'cabinet') app.go('#/manor/cabinet');
    else if (id === 'salver') salver();
  });
  $('#mnGrid').addEventListener('click', e => { const b = e.target.closest('[data-obj]'); if (b) openObject(+b.dataset.obj); });
  $('#sheetBody').addEventListener('click', e => {
    if (sec.hidden) return;
    const i = e.target.closest('[data-insp]'); if (i){ st().cur = +i.dataset.insp; store.save(); closeSheet(); app.go(`#/room/${ID}/insp`); return; }
    const g = e.target.closest('[data-go]'); if (g){ closeSheet(); app.go(g.dataset.go); }
  });
  const back = () => { if (view === 'cabinet') app.go('#/manor/study'); else if (view === 'study') app.go('#/manor'); else floo(app, '#/me'); };
  $('#mnBack').addEventListener('click', back);
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else back(); } });

  function mode(v){
    view = v;
    const cab = v === 'cabinet';
    $('#mnCard').hidden = cab; $('#mnSpots').hidden = cab; $('#mnCab').hidden = !cab;
    sec.classList.toggle('cabinet', cab);
    sec.dataset.view = v;
  }
  const draw = () => view === 'cabinet' ? drawCabinet() : view === 'study' ? drawStudy() : drawHall();
  async function show({id}){
    if (!isOpen()){ app.go('#/me', true); return; }
    mode(id === 'study' || id === 'cabinet' ? id : 'hall');
    draw();
    if (view === 'hall') return;
    await Promise.all([bond.load(ID), app.loadDeck(ID).catch(() => null)]);
    if (!sec.hidden) draw();
    if (view === 'cabinet') $('#mnCab').scrollTop = 0;
  }
  return {show, resize: () => { if (view !== 'cabinet') placeSpots(); }, refresh: () => { if (!sec.hidden) draw(); }};
}
