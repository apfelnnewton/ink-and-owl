/* Bellatrix's vault errands at Gringotts (2026-10-21 user, docs/plan-gringotts.md "심부름 흐름 다시"). Thirty-six, in order:
   one each time she changes what she calls the learner (three — a Galleon each), the rest one every third day of her dictation
   (days she was taken down, not calendar days — 3 to 10 Sickles each). One at a time, never two on one day.
   1. the drawing room: she holds out a photograph of a thing in her vault and a small gold key (manor.js asks drawingBits);
   2. the hall at Gringotts: the learner states the business to the head goblin, formally, every time (bank.js asks hallBits) —
      errands 1–12 pick the proper sentence of three, 13–36 fill the blank of one;
   3. the cart ride down (#/bank/cart); 4. the Lestrange vault (#/bank/lestrange): the goblin's inventory, the photograph as a hint —
      the line that matches (four lines, then six);
   5. the hall: the goblin's ledger entry — read and sign (1–12), a blank (13–24), the one wrong word (25–36);
   6. the drawing room: the thing is handed over, her word on it, and coins across the floor.
   The words: bond/errands.json (← docs/newfaces-work/out-errand/errands.json, brief ERRAND.md, reviewed). The pictures:
   assets/bank/items/<item>.webp, assets/rooms/gringotts-ride|lestrange-*.webp (ride = from inside the cart; the video assets/bank/cart-ride.mp4), assets/bank/key.webp.
   state.bank.er = {n: errands given, names: of them, on a new name, last: her dictation days at the last day's errand, d: date of the
                    last, cur: {i, gal, at: 'ask'|'cart'|'ledger'|'back', d, look: wrong things brought out, took: the wrong thing
                    taken {item, en, ko}, miss: times sent back}, done, paid: {d, k, gal, v, look}} — inside state.bank, so it
   travels with the bank (store.mergeData whole('bank'), sync-core KEYS). */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as manor from './manor.js';
import * as shops from './shops.js';
import * as bella from './bella.js';
import {$, esc, openSheet, closeSheet} from './ui.js';

const BID = 'bellatrix', SICKLE = 29, GALLEON = 493, EVERY = 3, TOTAL = 36, NAMED = 3;
const bank = () => { const s = store.get(); return s.bank || (s.bank = {}); };
const st = () => { const b = bank(); return b.er || (b.er = {}); };
const tick = () => { const b = bank(); b.n = (b.n || 0) + 1; };
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

let TEXT = null;
export const load = () => TEXT ? Promise.resolve(TEXT) : fetch('bond/errands.json').then(r => r.ok ? r.json() : null).then(j => (TEXT = j)).catch(() => null);
export const cur = () => st().cur || null;
const errandOf = c => TEXT && c ? TEXT.errands[c.i] || null : null;
const level = i => i < 12 ? 1 : i < 24 ? 2 : 3;
const itemSrc = e => `assets/bank/items/${e.item}.webp`;
const days = () => bond.bondOf(BID).days || 0;
const ready = () => shops.isOpen() && bella.isOpen() && bella.met();

/* what is owed now: 'gal' (a new name not yet sent for), 'day' (three days of her dictation since the last), or null */
export function due(){
  const e = st();
  if (!TEXT || !ready() || e.cur || (e.n || 0) >= TOTAL || e.d === srs.today()) return null;
  if ((e.names || 0) < NAMED && bella.nameIndex() > (e.names || 0)) return 'gal';
  if ((e.n || 0) - (e.names || 0) >= TOTAL - NAMED) return null;
  return e.last == null || days() - e.last >= EVERY ? 'day' : null;   // the first comes as soon as the bank and she are both there
}
function give(){
  const kind = due(); if (!kind) return null;
  const e = st(), t = srs.today();
  e.cur = {i: e.n || 0, gal: kind === 'gal', at: 'ask', d: t}; e.n = (e.n || 0) + 1; e.d = t;
  if (kind === 'gal') e.names = (e.names || 0) + 1; else e.last = days();
  tick(); store.save();
  return e.cur;
}
function step(at){ const c = cur(); if (!c) return; c.at = at; tick(); store.save(); }
function finish(){
  const e = st(), c = e.cur, x = errandOf(c); if (!c || !x) return null;
  /* a Sickle less for each wrong thing the goblin was made to bring out (2026-10-21 user 1가), never less than one */
  const k = Math.max(SICKLE, (c.gal ? GALLEON : SICKLE * (3 + hash(x.id + '|coin') % 8)) - (c.look || 0) * SICKLE);
  manor.earn(k);
  e.paid = {d: srs.today(), k, gal: c.gal, v: hash(x.id + '|line'), look: c.look || 0}; e.done = (e.done || 0) + 1; e.cur = null;
  tick(); store.save();
  return e.paid;
}

/* ---------- the words */
const fill = s => bond.fill(String(s || ''));
const marked = s => esc(fill(s)).replace(/\[\[([^\]]+)\]\]/g, '<b>$1</b>');
const keysOf = (...ts) => { const all = Object.assign({}, ...ts.filter(Boolean).map(t => t.keys || {})), ks = Object.entries(all);
  return ks.length ? `<ul class="lt-keys">${ks.map(([k, v]) => `<li><b lang="en">${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>` : ''; };
const say = t => t ? `<span class="q" lang="en">${marked(t.en)}</span><span class="k">${esc(fill(t.ko))}</span>` : '';
const said = t => t ? `<p class="bk-said">${say(t)}</p>` : '';
const pick = (list, salt) => list && list.length ? list[hash(srs.today() + salt) % list.length] : null;
const any = list => list && list.length ? list[Math.floor(Math.random() * list.length)] : null;
const shuffled = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const high = () => store.get().settings.level === 'high';
const norm = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
const head = (left, c) => `<div class="sh-kind"><span>${left}</span><span>심부름 ${c.i + 1} / ${TOTAL}</span></div>`;
const photo = (e, small) => `<figure class="er-photo${small ? ' small' : ''}"><img src="${itemSrc(e)}" alt="그녀가 준 사진"><figcaption>${small ? '그녀의 사진' : ''}</figcaption></figure>`;

/* ---------- on the cards of the two places */
const go = (label, attr, cls = '') => `<button type="button" class="cgo ${cls}" ${attr}><span>${label}</span><i aria-hidden="true">→</i></button>`;
/* the drawing room: {line, btn, first} or null — first: the button goes above her dictation */
export function drawingBits(){
  const c = cur(), x = errandOf(c);
  if (c && x && c.at === 'back') return {line: '<span class="bond">레스트레인지 금고에서 꺼내 온 물건을 들고 있다</span>', btn: go('그녀에게 건넨다', 'data-er="hand"'), first: true};
  if (c && x) return {line: '<span class="bond">그녀의 심부름 · 그린고츠에서 사진 속 물건을 가져와야 한다</span>', btn: go('그녀의 사진 · 다시 본다', 'data-er="photo"', 'me-second')};
  if (due()) return {line: '<span class="bond">그녀가 사진 한 장과 작은 금 열쇠를 내민다</span>', btn: go('사진을 받는다', 'data-er="take"'), first: true};
  return null;
}
/* the hall at Gringotts: {line, btn} or null */
export function hallBits(){
  const c = cur(), x = errandOf(c); if (!c || !x) return null;
  const S = TEXT.shared;
  if (c.at === 'ask') return {line: say(pick(S.hall, 'hall')), btn: go('레스트레인지 부인의 심부름 <em>용건을 말한다</em>', 'data-er="ask"')};
  if (c.at === 'cart') return {line: '', btn: go('금고로 내려간다 <em>수레</em>', 'data-er="cart"')};
  if (c.at === 'ledger') return {line: say(pick(S.ledger, 'ledger')), btn: go('장부에 적는다 <em>꺼내 온 물건</em>', 'data-er="ledger"')};
  return {line: '', btn: go('응접실로 가져간다 <em>그녀의 물건</em>', 'data-er="manor"')};
}
/* the two pictures under the bank: what the card says there */
export function placeBits(view){
  const c = cur(), x = errandOf(c); if (!c || !x) return null;
  const S = TEXT.shared;
  if (view === 'cart'){ const t = S.cart[c.i % S.cart.length]; return {who: 'The Cart Ride', line: say(t), btn: go('레스트레인지 금고 앞에 선다', 'data-er="vault"')}; }
  const who = 'The Lestrange Vault';
  if (c.at === 'cart'){
    const sh = shown && shown.i === c.i ? vaultLines(c, x)[shown.n] : null;
    if (!sh) return {who, line: say(pick(S.vault, 'vault')), btn: go('고블린의 목록을 본다', 'data-er="list"')};
    /* what the goblin brought out to the velvet — or nothing, for a thing the vault does not hold */
    if (sh.none) return {who: '', line: say(pick(S.none, 'none' + shown.n)), btn: go('다시 찾아본다', 'data-er="list"'), empty: true};
    return {who: '', line: say(pick(shown.again ? S.again : S.shown, 'shown' + shown.n)),
      btn: go('가져간다', 'data-er="takeit"') + go('다시 찾아본다', 'data-er="list"', 'me-second'), item: itemSrc(sh)};
  }
  return {who, line: say(pick(S.found, 'found')), btn: go('홀로 올라간다', 'data-er="up"'), item: itemSrc(c.took || x)};
}
/* the inventory, four lines (2026-10-21 user): the thing in her photograph, two other things that really are in the vault (another
   errand's line — what they look like is known, there is a picture of each), and one the vault does not hold (a near miss). The
   others are of any kind in errands 1–12, of the same kind as hers from 13 on. Fixed for each errand. */
const KIND = n => /goblet|cup/.test(n) ? 'cup' : /necklace|locket|pearls/.test(n) ? 'neck' : /dagger/.test(n) ? 'blade' : /box/.test(n) ? 'box' : /candle/.test(n) ? 'candle'
  : /mirror/.test(n) ? 'mirror' : /ring/.test(n) ? 'ring' : /comb|tiara/.test(n) ? 'hair' : /brooch/.test(n) ? 'brooch' : /decanter|perfume/.test(n) ? 'bottle' : /book|scroll/.test(n) ? 'paper' : n;
function vaultLines(c, x){
  const h = s => hash(x.id + '|' + s), others = [...new Map(TEXT.errands.map(e => [e.item, e])).values()].filter(e => e.item !== x.item);
  const sorted = a => a.slice().sort((p, q) => h(p.item) - h(q.item));
  const same = sorted(others.filter(e => KIND(e.item) === KIND(x.item))), rest = sorted(others.filter(e => KIND(e.item) !== KIND(x.item)));
  const real = (level(c.i) === 1 ? rest.concat(same) : same.concat(rest)).slice(0, 2).map(e => ({en: e.vault.right.en, ko: e.vault.right.ko, item: e.item}));
  const none = x.vault.wrong[h('none') % x.vault.wrong.length];
  return [{...x.vault.right, ok: true, item: x.item}, ...real, {...none, none: true}];
}
let shown = null, seen = null;   // what is on the velvet now {i, n, again}; the list's order and the lines already looked at {i, order, tried}

/* ---------- the sheets */
let run = null, ctx = null;   // ctx = {app, redraw}
function photoSheet(c, fresh){
  const x = errandOf(c); if (!x) return;
  run = {kind: 'photo'};
  const narr = fresh && TEXT.shared.photo ? `<p class="er-narr">${esc(pick(TEXT.shared.photo, 'photo').ko)}</p>` : '';
  openSheet(head('응접실 · 그녀의 심부름', c) + narr + photo(x) +
    `<div class="tea-say"><p class="en" lang="en" id="shTitle">${marked(x.ask.en)}</p><p class="ko">${esc(fill(x.ask.ko))}</p></div>` + keysOf(x.ask) +
    `<p class="er-key"><img src="assets/bank/key.webp" alt="">작은 금 열쇠 · 레스트레인지 금고</p>` +
    (c.at === 'ask' ? '<button type="button" class="sh-drill" data-ergo="#/bank">그린고츠로 간다</button>' : ''));
}

/* step 2: the business, stated to the head goblin */
function askSheet(){
  const c = cur(), x = errandOf(c); if (!x) return;
  const r = x.request;
  run = {kind: 'ask', c, x, tried: new Set(), opts: r.choices ? shuffled(r.choices.map((ch, n) => n)) : shuffled([r.answer, ...r.options])};
  askDraw();
}
function askDraw(said1 = null, done = false){
  const {c, x} = run, r = x.request, S = TEXT.shared;
  let body;
  if (r.choices){
    const ok = r.choices.find(ch => ch.ok);
    body = done ? `<p class="er-line" lang="en">${marked(ok.en)}</p><p class="dr-ko">${esc(ok.ko)}</p><p class="bk-why">${esc(ok.why || '')}</p>`
      : `<div class="er-choices">${run.opts.map(n => { const ch = r.choices[n], off = run.tried.has(n);
          return `<button type="button" data-erch="${n}"${off ? ' disabled class="wrong"' : ''}><span lang="en">${marked(ch.en)}</span>${off ? `<small>${esc(ch.why || '')}</small>` : ''}</button>`; }).join('')}</div>`;
  } else {
    const line = esc(fill(r.en)).replace('___', done ? `<b class="bk-filled">${esc(r.answer)}</b>` : '<span class="bk-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
    body = `<p class="er-line" lang="en">${line}</p>` + (done ? `<p class="dr-ko">${esc(r.ko)}</p><p class="bk-why">${esc(r.note || '')}</p>` : blankAsk(r.answer));
  }
  openSheet(head('그린고츠 · 수석 고블린에게', c) +
    `<p class="bk-ctitle">${r.choices ? '어느 말로 용건을 말할까? 격식을 갖춘 하나' : '빈칸에 맞는 말 — 격식을 갖춘 요청'}</p>` + body +
    (said1 ? said(said1) : '') +
    (done ? keysOf(r, ...(r.choices || [])) + said(any(S.askOk)) + '<button type="button" class="sh-drill" data-erstep="cart">수레에 오른다</button>' : ''));
  focusIn();
}
const blankAsk = answer => high()
  ? `<div class="bk-write"><input type="text" id="erIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(answer[0])}…" lang="en"><button type="button" class="sh-drill" data-ercheck="1">확인</button></div>`
  : `<div class="dr-opts">${run.opts.map((o, n) => `<button type="button" data-erpick="${esc(o)}"${run.tried.has(o) ? ' disabled class="wrong"' : ''}><i>${n + 1}</i>${esc(o)}</button>`).join('')}</div>`;
const focusIn = () => { const i = $('#erIn'); if (i) i.focus(); };

/* step 4: the inventory of the Lestrange vault — the photograph stays in sight */
function listSheet(){
  const c = cur(), x = errandOf(c); if (!x) return;
  const lines = vaultLines(c, x);
  if (!seen || seen.i !== c.i) seen = {i: c.i, order: shuffled(lines.map((l, n) => n)), tried: new Set()};
  run = {kind: 'list', c, x, lines};
  const n = c.look || 0;
  openSheet(head('레스트레인지 금고 · 고블린의 목록', c) + photo(x, true) +
    `<h2 class="sh-expr" id="shTitle" lang="en">Inventory</h2><p class="bk-ctitle">사진 속 물건과 맞는 줄을 누르면 고블린이 꺼내 온다</p>` +
    `<ol class="er-list">${seen.order.map(k => { const l = lines[k], off = seen.tried.has(k);
      return `<li><button type="button" data-erline="${k}" class="${off ? 'wrong' : ''}"><span lang="en">${esc(fill(l.en))}</span>${off ? `<small>${l.none ? '금고에 없는 물건' : '꺼내 봤다 · 사진과 다르다'}</small>` : ''}</button></li>`; }).join('')}</ol>` +
    `<p class="purse-note">${n ? `사진과 다른 물건을 ${n}번 꺼내 보게 했다 · 그녀가 던질 시클이 ${n}닢 준다` : '사진과 다른 물건을 꺼내 보게 할 때마다 그녀가 던질 시클이 1닢씩 준다'}</p>`);
}
/* a line pressed: the goblin brings it to the velvet (or says there is no such thing); the card under the picture offers to take it */
function look(k){
  const c = cur(), l = run.lines[k]; run = null; closeSheet();
  const again = !!(c.look || seen.tried.size);
  if (!l.ok && !l.none && !seen.tried.has(k)){ c.look = (c.look || 0) + 1; tick(); store.save(); }
  if (!l.ok) seen.tried.add(k);
  shown = {i: c.i, n: k, again};
  if (ctx) ctx.redraw();
}
function takeIt(){
  const c = cur(), x = errandOf(c); if (!c || !shown || shown.i !== c.i) return;
  const l = vaultLines(c, x)[shown.n]; if (!l || l.none) return;
  c.took = l.ok ? null : {item: l.item, en: l.en, ko: l.ko};   // the wrong thing: she will see it in the drawing room (user 2가)
  shown = null; step('ledger');
  if (ctx) ctx.redraw();
}

/* step 5: the ledger entry */
function ledgerSheet(){
  const c = cur(), x = errandOf(c); if (!x) return;
  /* the wrong thing taken: the goblin writes down what was taken, plainly — read and sign (she finds out in the drawing room) */
  const L = c.took ? tookEntry(c.took) : x.ledger, lv = c.took ? 1 : level(c.i);
  run = {kind: 'ledger', c, x, L, lv, tried: new Set(), opts: lv === 2 ? shuffled([L.answer, ...L.options]) : null};
  ledgerDraw();
}
function ledgerDraw(said1 = null, done = false){
  const {c, x, lv, L} = run, S = TEXT.shared;
  let entry, ask = '';
  if (lv === 1) entry = esc(fill(L.en));
  else if (lv === 2){ entry = esc(fill(L.en)).replace('___', done ? `<b class="bk-filled">${esc(L.answer)}</b>` : '<span class="bk-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>'); if (!done) ask = blankAsk(L.answer); }
  else {
    /* every word a button; the wrong one, once found, shown struck through with the right one beside it */
    let n = 0;
    entry = fill(L.en).split(/(\s+)/).map(w => { if (/^\s+$/.test(w)) return w;
      const i = n++, bare = w.replace(/^[^A-Za-z]+|[^A-Za-z-]+$/g, ''), isWrong = bare.toLowerCase() === String(L.wrong).toLowerCase();
      if (done && isWrong) return `<s class="er-x">${esc(w)}</s> <b class="bk-filled">${esc(w.replace(bare, L.right))}</b>`;
      return done ? esc(w) : `<button type="button" class="er-w${run.tried.has(i) ? ' wrong' : ''}" data-erword="${i}" data-bare="${esc(bare)}"${run.tried.has(i) ? ' disabled' : ''}>${esc(w)}</button>`; }).join('');
  }
  const how = lv === 1 ? '고블린이 적은 반출 기록 — 읽고 서명한다' : lv === 2 ? '장부의 빈칸 — 사진을 보고' : '사진과 다르게 적힌 낱말 하나를 누른다';
  openSheet(head('그린고츠 · 장부', c) + (lv > 1 ? photo(x, true) : '') +
    `<h2 class="sh-expr" id="shTitle" lang="en">The Ledger</h2><p class="bk-ctitle">${how}</p>` +
    `<p class="er-entry" lang="en">${entry}</p>` + ask + (said1 ? said(said1) : '') +
    (done ? (L.ko ? `<p class="dr-ko">${esc(fill(L.ko))}</p>` : '') + (L.note ? `<p class="bk-why">${esc(L.note)}</p>` : '') + said(any(S.signed)) +
      '<button type="button" class="sh-drill" data-erstep="back">응접실로 가져간다</button>'
      : lv === 1 ? '<button type="button" class="sh-drill" data-ersign="1">서명한다</button>' : ''));
  focusIn();
}

const tookEntry = l => { const E = TEXT.shared.entry, low = s => s.charAt(0).toLowerCase() + s.slice(1);
  return {en: E.en.replace('{item}', low(l.en)), ko: E.ko.replace('{item}', l.ko)}; };

/* step 6: handed over */
function handSheet(){
  const c = cur(), x = errandOf(c); if (!x) return;
  if (c.took){   // the wrong thing (user 2가): she scolds, no coins, and back down to the vault — no need to state the business again
    const t = c.took, S = TEXT.shared;
    c.took = null; c.miss = (c.miss || 0) + 1; step('cart');
    run = {kind: 'hand'};
    openSheet(head('응접실 · 건넨다', c) +
      `<figure class="lt-gift"><img src="${itemSrc(t)}" alt=""></figure>` +
      `<div class="tea-say"><p class="en" lang="en" id="shTitle">${marked(S.scold[(c.miss - 1 + c.i) % S.scold.length].en)}</p><p class="ko">${esc(fill(S.scold[(c.miss - 1 + c.i) % S.scold.length].ko))}</p></div>` + keysOf(S.scold[(c.miss - 1 + c.i) % S.scold.length]) +
      '<p class="purse-note">사진 속 물건이 아니다. 동전은 없다 — 그린고츠로 돌아가 다시 금고로 내려간다.</p>' +
      '<button type="button" class="sh-drill" data-ergo="#/bank">그린고츠로 간다</button>');
    if (ctx) ctx.redraw();
    return;
  }
  const p = finish(); if (!p) return;
  run = {kind: 'hand'};
  const S = TEXT.shared, toss = p.gal ? S.galleon[p.v % S.galleon.length] : S.sickles[p.v % S.sickles.length];
  openSheet(head('응접실 · 건넨다', c) +
    `<figure class="lt-gift"><img src="${itemSrc(x)}" alt=""></figure>` +
    `<div class="tea-say"><p class="en" lang="en" id="shTitle">${marked(x.give.en)}</p><p class="ko">${esc(fill(x.give.ko))}</p></div>` + keysOf(x.give) +
    said(toss) +
    `<p class="mn-paid"><img src="assets/money/${p.gal ? 'galleon' : 'sickle'}.webp" alt=""><b>${p.gal ? '1갈레온' : `${p.k / SICKLE}시클`}</b><span>주머니 · ${esc(manor.money(manor.purse()))}</span></p>` +
    (p.look ? `<p class="purse-note">사진과 다른 물건을 ${p.look}번 꺼내 보게 해서 ${p.look}시클 덜 받았다.</p>` : '') +
    (manor.debtNote() ? `<p class="purse-note">${esc(manor.debtNote())}</p>` : '') +
    (st().done >= TOTAL ? '<p class="purse-note">그녀의 심부름은 이것으로 다 했다.</p>' : ''));
  if (ctx) ctx.redraw();
}

/* ---------- what the buttons on the cards do; the sheets' own buttons */
export function act(what, app, redraw){
  ctx = {app, redraw};
  if (what === 'take'){ const c = give(); if (c){ redraw(); photoSheet(c, true); } }
  else if (what === 'photo') photoSheet(cur(), false);
  else if (what === 'hand') handSheet();
  else if (what === 'ask') askSheet();
  else if (what === 'cart') app.go('#/bank/cart');
  else if (what === 'vault') app.go('#/bank/lestrange');
  else if (what === 'list') listSheet();
  else if (what === 'takeit') takeIt();
  else if (what === 'up') app.go('#/bank');
  else if (what === 'ledger') ledgerSheet();
  else if (what === 'manor') app.go('#/manor/drawing');
}
function answer(word){
  const exp = run.kind === 'ask' ? run.x.request.answer : run.L.answer;
  const S = TEXT.shared, redo = run.kind === 'ask' ? askDraw : ledgerDraw;
  if (norm(word) === norm(exp)){ redo(null, true); return; }
  run.tried.add(word); redo(any(run.kind === 'ask' ? S.wrongAsk : S.wrongLedger));
}
export function initErrand(){
  const body = $('#sheetBody');
  body.addEventListener('click', e => {
    if (!run || !TEXT) return;
    const S = TEXT.shared;
    const g = e.target.closest('[data-ergo]'); if (g){ const to = g.dataset.ergo; run = null; closeSheet(); if (ctx) ctx.app.go(to); return; }
    const ch = e.target.closest('[data-erch]');
    if (ch && !ch.disabled && run.kind === 'ask'){ const n = +ch.dataset.erch, it = run.x.request.choices[n];
      if (it.ok) askDraw(null, true); else { run.tried.add(n); askDraw(any(S.wrongAsk)); } return; }
    const p = e.target.closest('[data-erpick]'); if (p && !p.disabled){ answer(p.dataset.erpick); return; }
    if (e.target.closest('[data-ercheck]')){ const v = ($('#erIn') || {}).value || ''; if (v.trim()) answer(v.trim()); return; }
    const ln = e.target.closest('[data-erline]');
    if (ln && run.kind === 'list'){ look(+ln.dataset.erline); return; }
    const w = e.target.closest('[data-erword]');
    if (w && !w.disabled && run.kind === 'ledger'){
      if (w.dataset.bare.toLowerCase() === String(run.L.wrong).toLowerCase()) ledgerDraw(null, true);
      else { run.tried.add(+w.dataset.erword); ledgerDraw(any(S.wrongLedger)); }
      return; }
    if (e.target.closest('[data-ersign]')){ ledgerDraw(null, true); return; }
    const s = e.target.closest('[data-erstep]');
    if (s){ const at = s.dataset.erstep; step(at); run = null; closeSheet();
      if (!ctx) return;
      if (at === 'cart') ctx.app.go('#/bank/cart');
      else if (at === 'back') ctx.app.go('#/manor/drawing');
      else ctx.redraw();
    }
  });
  body.addEventListener('keydown', e => { if (run && e.key === 'Enter' && e.target.id === 'erIn'){ const v = e.target.value.trim(); if (v) answer(v); } });
}
