/* Gringotts (2026-10-21 user decision, docs/plan-gringotts.md): #/bank the marble hall · #/bank/vault the guest's vault.
   Reached from the far end of Diagon Alley (shops.js), open to whoever has the shops. The head goblin at the high desk keeps:
   - a vault, opened once by signing a contract (the goblin contracts: a clause at a time, one blank each, chosen from four —
     on the demanding level written, with the first letter shown; a wrong word gets a dry word and another try, nothing else);
   - deposits and withdrawals between the purse and the vault; while anything is owed, a deposit pays the debt first;
   - a loan: no interest, no due date, at most 10 Galleons owed at a time (what is repaid may be borrowed again), in whole
     Galleons, each signed with the next of six contracts; no loan while the vault holds anything (user 1가 2가 3가 4가).
     While anything is owed, half of every coin earned goes to the bank — that is manor.earn, the one place money comes in.
   No reminders and no letters about the debt: it shows in the hall and in the purse, nowhere else.
   The bank writes once, when it first opens to the guest (GR-open): under its own name in the post, like Borgin and Burkes.
   state.bank = {open: date, vault: Knuts, debt: Knuts, signed: date the vault's contract was signed, loans: loans signed,
                 n: operations (which copy is newer when two devices join without stamps), cut: Knuts taken from earnings} */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as manor from './manor.js';
import * as shops from './shops.js';
import * as errand from './errand.js';
import {$, esc, toast, openSheet, closeSheet, isSheetOpen, reduced} from './ui.js';

export const ID = 'gringotts';
export const DESK = {id: ID, ko: '그린고츠', place: 'bank'};   // the post tab (letters.js)
const SICKLE = 29, GALLEON = 493, LIMIT = 10 * GALLEON;
const st = () => { const s = store.get(); return s.bank || (s.bank = {}); };
export const isOpen = () => shops.isOpen();
export const vault = () => st().vault || 0;
export const debt = () => st().debt || 0;
export const hasVault = () => !!st().signed;
const tick = () => { const b = st(); b.n = (b.n || 0) + 1; };
/* the statement of account (2026-10-21 user): a line a transaction, newest first, the last 60; what went to the bank from
   earnings is one line a day (manor.earn writes it). Amounts as the purse sees them: + into it, − out of it */
const note = (t, k, extra = {}) => { const b = st(), log = b.log || (b.log = []); log.unshift({d: srs.today(), t, ...(k ? {k} : {}), ...extra}); log.length = Math.min(log.length, 60); };
const LINES = {open: ['Vault opened under agreement', '약정에 따라 금고 개설', 0], dep: ['Deposited', '입금 (주머니 → 금고)', -1], depdebt: ['Paid in towards the loan', '입금 → 빚 상환', -1],
  wd: ['Withdrawn', '출금 (금고 → 주머니)', 1], loan: ['Advanced on loan, Agreement {i}', '대출 (제{i}차 약정)', 1], rep: ['Repaid', '상환', -1],
  cut: ['Remitted from earnings', '벌이에서 상환', -1], settled: ['Account settled', '빚 청산', 0]};
export const statement = () => st().log || [];

/* ---------- the words (bond/gringotts.json ← docs/newfaces-work/out-bank/bank.json, reviewed) */
let TEXT = null;
export const load = () => TEXT ? Promise.resolve(TEXT) : fetch('bond/gringotts.json').then(r => r.ok ? r.json() : null).then(j => (TEXT = j)).catch(() => null);
export const data = () => TEXT;
const pick = (list, salt) => list && list.length ? list[Math.abs([...(srs.today() + salt)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)) % list.length] : null;
const any = list => list && list.length ? list[Math.floor(Math.random() * list.length)] : null;
/* amounts in the goblin's words: English for the English line, Korean for the Korean */
export function moneyEn(k){
  const c = manor.coins(k), part = (n, one, many) => n ? `${n} ${n === 1 ? one : many}` : '';
  return [part(c.g, 'Galleon', 'Galleons'), part(c.s, 'Sickle', 'Sickles'), part(c.k, 'Knut', 'Knuts')].filter(Boolean).join(' ') || 'nothing';
}
function fillLine(t, vars = {}){
  if (!t) return null;
  const sub = (s, en) => bond.fill(s.replace(/\{(amount|debt)\}/g, (_, k) => vars[k] == null ? '' : en ? moneyEn(vars[k]) : manor.money(vars[k])));
  return {...t, en: sub(t.en, true), ko: sub(t.ko, false)};
}
const marked = s => esc(s).replace(/\[\[([^\]]+)\]\]/g, '<b>$1</b>');
const keysOf = t => t && t.keys ? `<ul class="lt-keys">${Object.entries(t.keys).map(([k, v]) => `<li><b lang="en">${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>` : '';
const say = t => t ? `<span class="q" lang="en">${marked(t.en)}</span><span class="k">${esc(t.ko)}</span>` : '';

/* ---------- the money moving */
export function deposit(k){
  const b = st(); k = Math.floor(k);
  if (k <= 0 || k > manor.purse()) return {err: 'short'};
  const toDebt = Math.min(b.debt || 0, k);
  manor.earn(-k);   // out of the purse (a negative sum: nothing is taken for the debt)
  b.debt = (b.debt || 0) - toDebt; b.vault = (b.vault || 0) + (k - toDebt); tick();
  if (toDebt){ note('depdebt', toDebt); if (!b.debt) note('settled'); }
  if (k - toDebt) note('dep', k - toDebt);
  store.save();
  return {toDebt, toVault: k - toDebt};
}
export function withdraw(k){
  const b = st(); k = Math.floor(k);
  if (k <= 0 || k > (b.vault || 0)) return {err: 'short'};
  b.vault -= k; store.get().purse = manor.purse() + k; tick(); note('wd', k); store.save();   // straight into the purse: it is the guest's own money, not earned
  return {};
}
export const canBorrow = () => hasVault() && !vault() && debt() + GALLEON <= LIMIT;
export const borrowMax = () => Math.floor((LIMIT - debt()) / GALLEON);
export function borrow(g){
  const b = st();
  if (!hasVault()) return {err: 'noVault'};
  if (vault()) return {err: 'vault'};
  if (g < 1 || debt() + g * GALLEON > LIMIT) return {err: 'limit'};
  note('loan', g * GALLEON, {i: (b.loans || 0) % 6 + 1});   // the agreement it was signed under (contract())
  b.debt = debt() + g * GALLEON; b.loans = (b.loans || 0) + 1; store.get().purse = manor.purse() + g * GALLEON; tick(); store.save();
  return {};
}
export function repay(k){
  const b = st(); k = Math.floor(Math.min(k, debt()));
  if (k <= 0 || k > manor.purse()) return {err: 'short'};
  manor.earn(-k); b.debt = debt() - k; tick(); note('rep', k); if (!b.debt) note('settled'); store.save();
  return {cleared: !b.debt};
}
function openVault(){ const b = st(); if (!b.signed){ b.signed = srs.today(); tick(); note('open'); store.save(); } }

/* ---------- the bank's letter, once, when the shops (and so Diagon Alley) are open */
export function textOf(key){
  if (key === 'GR-open' && TEXT && TEXT.letter) return {kind: '안내장', ...TEXT.letter, go: '#/bank', btn: '그린고츠로 간다'};
  return null;
}
export async function daily(){
  if (!isOpen()) return;
  const b = st(); if (!b.open){ b.open = srs.today(); store.save(); }
  if (!bond.bondOf(ID).sent['GR-open'] && await load()) bond.postItem(ID, 'GR-open');
}

/* ---------- the screen */
const HEAPS = {   // the vault's gold, laid on the floor of the picture (user's choice 2, 5, 9 — design/drafts/bank/PROMPTS.md): width, foot, as fractions of the picture
  small: {p: [.184, .707], w: [.085, .79]}, middle: {p: [.351, .707], w: [.165, .79]}, full: {p: [.761, .856], w: [.36, .92]}};
const heapOf = k => !k ? null : k < 2 * GALLEON ? 'small' : k < 8 * GALLEON ? 'middle' : 'full';
const PHOTO = {p: [1080, 1910], w: [1920, 1086]};
const ITEM = {p: [.5, .6, .3], w: [.5, .55, .13]};   // the thing taken from the Lestrange vault, on the velvet: x, foot, width as fractions of the picture

export function initBank(app){
  const sec = $('#bank'), ph = $('#bkPhoto');
  let view = 'hall', run = null;
  const go = (label, attr, cls = '') => `<button type="button" class="cgo ${cls}" ${attr}><span>${label}</span><i aria-hidden="true">→</i></button>`;
  const photo = name => { const pic = f => `url("${new URL(`assets/rooms/${name}-${f}.webp`, location.href).href}")`; ph.style.setProperty('--p', pic('portrait')); ph.style.setProperty('--w', pic('wide')); };
  function placeHeap(){
    const el = $('#bkHeap'), kind = view === 'vault' ? heapOf(vault()) : null;
    el.hidden = !kind; if (!kind) return;
    const r = ph.getBoundingClientRect(); if (!r.width) return;
    const wide = matchMedia('(min-aspect-ratio: 1/1)').matches, [iw, ih] = PHOTO[wide ? 'w' : 'p'];
    const k = Math.max(r.width / iw, r.height / ih), dw = iw * k, dh = ih * k, ox = (r.width - dw) * .5, oy = (r.height - dh) * (wide ? .85 : .35);   // wide: the picture sits low so the floor stays in view (css #bank[data-view=vault])
    const [fw, fy] = HEAPS[kind][wide ? 'w' : 'p'];
    el.src = `assets/bank/heap-${kind}.webp`;
    el.style.width = (fw * dw) + 'px'; el.style.left = (ox + dw / 2) + 'px'; el.style.top = (oy + fy * dh) + 'px';
  }
  function goblin(){
    if (!TEXT) return null;
    const h = TEXT.hall, b = st();
    if (!b.seen) return h.first[0];
    if (!hasVault()) return pick(h.noVault, 'nv');
    if (debt()) return fillLine(pick(h.debt, 'debt'), {debt: debt()});
    if (vault() >= 5 * GALLEON) return pick(h.rich, 'rich');
    return fillLine(pick(h.back, 'back'));
  }
  function drawHall(){
    photo('gringotts');
    $('#bkTtl').textContent = 'Gringotts';
    $('#bkWho').textContent = 'The Head Goblin';
    $('#bkStats').innerHTML = '';
    const g = goblin(), er = errand.hallBits();   // Bellatrix's errand, when one is under way (errand.js): its line and its button first
    $('#bkLine').innerHTML = er && er.line ? er.line : g ? say(g) : '<span class="k">대리석 홀 끝, 높은 책상의 수석 고블린이 장부에서 눈을 든다.</span>';
    const own = s => er ? s.replace('class="cgo "', 'class="cgo me-second"') : s;
    $('#bkGo').innerHTML = (er ? er.btn : '') + own(!hasVault() ? go('금고를 연다 <em>계약서에 서명</em>', 'data-bk="open"')
      : go('창구로 간다 <em>맡기기 · 꺼내기 · 빌리기</em>', 'data-bk="counter"') + go('금고로 내려간다', 'data-bk="vault"', 'me-second'));
  }
  function drawVault(){
    photo('gringotts-vault');
    $('#bkTtl').textContent = 'Your Vault';
    $('#bkWho').textContent = 'The Vault';
    $('#bkStats').innerHTML = `<div><b>${vault() ? esc(manor.money(vault())) : '비었음'}</b>맡긴 돈</div>`;
    $('#bkLine').innerHTML = `<span class="k">${vault() ? '수레가 멈추고 둥근 쇠문이 열린다. 맡긴 돈이 그대로 있다.' : '수레가 멈추고 둥근 쇠문이 열린다. 금고는 비어 있다.'}</span>`;
    $('#bkGo').innerHTML = go('홀로 올라간다', 'data-bk="hall"');
  }
  /* the cart ride and the Lestrange vault, on Bellatrix's errand (errand.js says what the card says) */
  /* the ride down (2026-10-21 user): from inside the cart, once each time the cart view opens — the card waits until the cart stops.
     Without the video (offline: the worker does not keep mp4s; reduced motion) the still from the same place shows at once. */
  function ride(){
    const v = $('#bkRide'), card = $('#bkCard');
    const done = () => { card.classList.remove('bk-wait'); clearTimeout(ride.t); };
    if (reduced()){ v.hidden = true; done(); return; }
    v.hidden = false; card.classList.add('bk-wait');
    v.onended = done; v.onerror = () => { v.hidden = true; done(); };
    ride.t = setTimeout(done, 9000);
    if (!v.getAttribute('src')){ v.poster = 'assets/rooms/gringotts-ride-portrait.webp'; v.src = 'assets/bank/cart-ride.mp4'; }
    try { v.currentTime = 0; } catch (e) {}
    const p = v.play(); if (p && p.catch) p.catch(() => { v.hidden = true; done(); });
  }
  function stopRide(){ const v = $('#bkRide'); if (!v.hidden){ v.pause(); v.hidden = true; } $('#bkCard').classList.remove('bk-wait'); clearTimeout(ride.t); }
  function drawErrand(){
    const b = errand.placeBits(view); if (!b){ view = 'hall'; drawHall(); return; }
    photo(view === 'cart' ? 'gringotts-ride' : 'gringotts-lestrange');
    $('#bkTtl').textContent = 'Gringotts';
    $('#bkWho').textContent = b.who;
    $('#bkStats').innerHTML = '';
    $('#bkLine').innerHTML = b.line;
    $('#bkGo').innerHTML = b.btn;
  }
  function placeItem(){
    const el = $('#bkItem'), b = view === 'lestrange' ? errand.placeBits(view) : null;
    el.hidden = !(b && b.item); if (el.hidden) return;
    const r = ph.getBoundingClientRect(); if (!r.width) return;
    const wide = matchMedia('(min-aspect-ratio: 1/1)').matches, [iw, ih] = PHOTO[wide ? 'w' : 'p'];
    const k = Math.max(r.width / iw, r.height / ih), dw = iw * k, dh = ih * k, ox = (r.width - dw) * .5, oy = (r.height - dh) * (wide ? .5 : .35);
    const [fx, fy, fw] = wide ? ITEM.w : ITEM.p;
    if (el.getAttribute('src') !== b.item) el.src = b.item;
    el.style.width = (fw * dw) + 'px'; el.style.left = (ox + fx * dw) + 'px'; el.style.top = (oy + fy * dh) + 'px';
  }
  function draw(){
    if (view !== 'cart') stopRide();
    sec.dataset.view = view;
    if (view === 'vault') drawVault(); else if (view === 'cart' || view === 'lestrange') drawErrand(); else drawHall();
    placeHeap(); placeItem();
  }

  /* ---------- the counter: what the learner wants, said in a formal sentence; where things stand at the top */
  function counterSheet(){
    const C = TEXT.counter; run = {kind: 'counter'};
    const opt = (k, show) => show ? `<button type="button" data-bkc="${k}"><span lang="en">${esc(C[k].en)}</span><small>${esc(C[k].ko)}</small></button>` : '';
    openSheet(`<div class="sh-kind"><span>Gringotts</span><span>창구</span></div>` +
      `<p class="bk-said">${say(pick(C.ask, 'counter'))}</p>` +
      `<p class="purse-note">주머니 ${esc(manor.money(manor.purse()))} · 금고 ${vault() ? esc(manor.money(vault())) : '비었음'} · 빚 ${debt() ? esc(manor.money(debt())) : '없음'}</p>` +
      `<div class="er-choices bk-counter">${opt('deposit', true)}${opt('withdraw', vault() > 0)}${opt('borrow', true)}${opt('repay', debt() > 0)}</div>` +
      (debt() ? '<p class="purse-note">빚이 남아 있는 동안 버는 돈의 절반은 은행으로 간다.</p>' : '') +
      (statement().length ? `<button type="button" class="clink" data-bkc="statement">거래 명세 · ${statement().length}줄</button>` : ''));
  }

  /* ---------- the statement: date | what | amount, newest first; where things stand at the foot */
  const day = d => { const [, m, n] = d.split('-').map(Number); return `${m}월 ${n}일`; };
  function statementSheet(){
    const rows = statement().map(e => { const [en, ko, sign] = LINES[e.t] || [e.t, '', 0], f = s => s.replace('{i}', e.i || '');
      return `<tr><td class="bk-d">${day(e.d)}</td><td><span lang="en">${esc(f(en))}</span><small>${esc(f(ko))}</small></td><td class="bk-k${sign < 0 ? ' out' : sign > 0 ? ' in' : ''}">${e.k ? (sign < 0 ? '−' : '+') + esc(manor.money(e.k)) : ''}</td></tr>`; }).join('');
    openSheet(`<div class="sh-kind"><span>Gringotts</span><span>최근 ${statement().length}줄</span></div><h2 class="sh-expr" id="shTitle" lang="en">Statement of Account</h2><p class="bk-ctitle">거래 명세 · 금액은 주머니 기준(+ 들어옴, − 나감)</p>` +
      `<table class="bk-ledger"><thead><tr><th>날짜</th><th>내용</th><th>금액</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p class="purse-note">금고 ${vault() ? esc(manor.money(vault())) : '0'} · 빚 ${debt() ? esc(manor.money(debt())) : '없음'} · 주머니 ${esc(manor.money(manor.purse()))}</p>`);
  }

  /* ---------- amounts: a few coins at a time, or all of it */
  function amountSheet(kind){
    const max = kind === 'deposit' ? manor.purse() : kind === 'withdraw' ? vault() : Math.min(manor.purse(), debt());
    const head = {deposit: '금고에 맡긴다', withdraw: '금고에서 꺼낸다', repay: '빚을 갚는다'}[kind];
    if (max <= 0){ const l = TEXT && pick(TEXT.say.purseShort, 'ps'); toast(l ? say(l) : '<span class="k">주머니가 비었다.</span>', 3200, true); return; }
    run = {kind, max, k: 0};
    const steps = [[SICKLE, '+1시클'], [5 * SICKLE, '+5시클'], [GALLEON, '+1갈레온'], [5 * GALLEON, '+5갈레온']];
    openSheet(`<div class="sh-kind"><span>Gringotts</span><span>${esc(head)}</span></div>` +
      `<p class="bk-amt" id="bkAmt">0</p><p class="purse-note">${kind === 'withdraw' ? '금고' : '주머니'} · ${esc(manor.money(kind === 'withdraw' ? vault() : manor.purse()))}${kind === 'repay' ? ` · 빚 ${esc(manor.money(debt()))}` : ''}</p>` +
      `<div class="bk-steps">${steps.map(([k, l]) => `<button type="button" data-bkadd="${k}">${l}</button>`).join('')}<button type="button" data-bkadd="all">전부</button><button type="button" data-bkadd="0">처음부터</button></div>` +
      (kind === 'deposit' && debt() ? '<p class="purse-note">빚이 있어서 맡기는 돈은 빚부터 갚는다.</p>' : '') +
      `<button type="button" class="sh-drill" data-bkdo="1" disabled>${esc(head)}</button>`);
  }
  function showAmount(){ const b = $('#sheetBody'); b.querySelector('#bkAmt').textContent = run.k ? manor.money(run.k) : '0'; b.querySelector('[data-bkdo]').disabled = !run.k; }
  function doAmount(){
    const {kind, k} = run; run = null; closeSheet();
    let line = null;
    if (kind === 'deposit'){ const r = deposit(k); if (r.err) return; line = r.toDebt && !r.toVault ? any(TEXT.say.depositToDebt) : r.toDebt ? any(TEXT.say.depositToDebt) : any(TEXT.say.deposit); line = fillLine(line, {amount: k}); }
    if (kind === 'withdraw'){ if (withdraw(k).err) return; line = fillLine(any(TEXT.say.withdraw), {amount: k}); }
    if (kind === 'repay'){ const r = repay(k); if (r.err) return; line = fillLine(any(r.cleared ? TEXT.say.cleared : TEXT.say.repaid), {amount: k}); }
    draw(); if (line) toast(say(line), 4200, true);
  }

  /* ---------- borrowing: how many Galleons, then the contract */
  function borrowSheet(){
    if (vault()){ const l = any(TEXT.say.cannotBorrowVault); toast(say(l), 4200, true); return; }
    if (borrowMax() < 1){ const l = any(TEXT.say.limit); toast(say(l), 4200, true); return; }
    run = {kind: 'borrow', g: 1};
    openSheet(`<div class="sh-kind"><span>Gringotts</span><span>빌린다</span></div><p class="bk-amt" id="bkAmt">1갈레온</p>` +
      `<p class="purse-note">이자도 기한도 없다 · 갚지 않은 돈이 10갈레온까지${debt() ? ` · 지금 빚 ${esc(manor.money(debt()))}` : ''}</p>` +
      `<div class="bk-steps"><button type="button" data-bkg="-1">−1갈레온</button><button type="button" data-bkg="1">+1갈레온</button></div>` +
      '<p class="purse-note">빌릴 때마다 계약서에 서명한다. 빚이 남아 있는 동안 버는 돈의 절반은 은행으로 간다.</p>' +
      '<button type="button" class="sh-drill" data-bkcontract="loan">계약서를 받는다</button>');
  }

  /* ---------- a goblin contract: a clause at a time */
  const shuffled = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const high = () => store.get().settings.level === 'high';
  const norm = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
  function contract(which, then){
    const i = which === 'open' ? 0 : 1 + (st().loans || 0) % 6, c = TEXT && TEXT.contracts[i];
    if (!c){ toast('계약서를 불러오지 못했습니다.'); return; }
    const again = which !== 'open' && (st().loans || 0) >= 6;   // this agreement has been signed once before
    run = {kind: 'contract', c, k: 0, then, write: high() && again, opts: c.clauses.map(cl => shuffled([cl.answer, ...cl.options])), tried: c.clauses.map(() => new Set())};   // words tried wrongly, clause by clause (2026-10-21 user: one clause's wrong word blocked the next clause's answer)
    clause();
  }
  const filled = (cl, ok) => esc(cl.en).replace('___', ok ? `<b class="bk-filled">${esc(cl.answer)}</b>` : '<span class="bk-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
  function clause(said = null, done = false){
    const {c, k} = run, cl = c.clauses[k];
    const before = c.clauses.slice(0, k).map(x => `<li class="bk-done">${filled(x, true)}</li>`).join('');
    const ask = done ? '' : run.write
      ? `<p class="dr-ko">${esc(cl.ko)}</p><div class="bk-write"><input type="text" id="bkIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(cl.answer[0])}…" lang="en"><button type="button" class="sh-drill" data-bkcheck="1">확인</button></div>`
      : `<div class="dr-opts">${run.opts[k].map((o, n) => `<button type="button" data-bkpick="${esc(o)}"${run.tried[k].has(o) ? ' disabled class="wrong"' : ''}><i>${n + 1}</i>${esc(o)}</button>`).join('')}</div>`;
    const after = done ? `<p class="dr-ko">${esc(cl.ko)}</p><p class="bk-why">${esc(cl.note)}</p>` +
      (k + 1 < c.clauses.length ? '<button type="button" class="sh-drill" data-bknext="1">다음 조항 →</button>' : '<button type="button" class="sh-drill" data-bksign="1">서명한다</button>') : '';
    openSheet(`<div class="sh-kind"><span lang="en">${esc(c.title.en)}</span><span>조항 ${k + 1} / ${c.clauses.length}</span></div>` +
      `<p class="bk-ctitle">${esc(c.title.ko)}</p><ol class="bk-clauses">${before}<li class="bk-now">${filled(cl, done)}</li></ol>` +
      (said ? `<p class="bk-said">${say(said)}</p>` : '') + ask + after);
    const inp = $('#bkIn'); if (inp) inp.focus();
  }
  function answer(word){
    const cl = run.c.clauses[run.k];
    if (norm(word) === norm(cl.answer)){ clause(null, true); return; }
    run.tried[run.k].add(word); clause(any(TEXT.say.wrongClause));
  }
  function sign(){
    const then = run.then; run = null; closeSheet();
    then();
    draw(); toast(say(any(TEXT.say.signed)), 3800, true);
  }

  /* ---------- events */
  $('#bkGo').addEventListener('click', e => {
    const er = e.target.closest('[data-er]'); if (er){ errand.act(er.dataset.er, app, draw); return; }
    const b = e.target.closest('[data-bk]'); if (!b || !TEXT) return;
    const a = b.dataset.bk;
    if (a === 'open') contract('open', openVault);
    else if (a === 'vault') app.go('#/bank/vault');
    else if (a === 'hall') app.go('#/bank');
    else if (a === 'borrow') borrowSheet();
    else if (a === 'counter') counterSheet();
    else if (a === 'statement') statementSheet();
    else amountSheet(a);
  });
  $('#sheetBody').addEventListener('click', e => {
    if (sec.hidden || !run) return;
    const c = e.target.closest('[data-bkc]');
    if (c && run.kind === 'counter'){ const k = c.dataset.bkc; run = null; closeSheet();
      if (k === 'borrow') borrowSheet(); else if (k === 'statement') statementSheet(); else amountSheet(k); return; }
    const add = e.target.closest('[data-bkadd]');
    if (add){ const v = add.dataset.bkadd; run.k = v === 'all' ? run.max : v === '0' ? 0 : Math.min(run.max, run.k + +v); showAmount(); return; }
    if (e.target.closest('[data-bkdo]')){ doAmount(); return; }
    const g = e.target.closest('[data-bkg]');
    if (g){ run.g = Math.max(1, Math.min(borrowMax(), run.g + +g.dataset.bkg)); $('#bkAmt').textContent = run.g + '갈레온'; return; }
    if (e.target.closest('[data-bkcontract]')){ const n = run.g; contract('loan', () => { borrow(n); const l = fillLine(any(TEXT.say.borrowed), {amount: n * GALLEON}); setTimeout(() => toast(say(l), 4200, true), 3900); }); return; }
    const p = e.target.closest('[data-bkpick]'); if (p && !p.disabled){ answer(p.dataset.bkpick); return; }
    if (e.target.closest('[data-bkcheck]')){ const v = ($('#bkIn') || {}).value || ''; if (v.trim()) answer(v.trim()); return; }
    if (e.target.closest('[data-bknext]')){ run.k++; clause(); return; }
    if (e.target.closest('[data-bksign]')) sign();
  });
  $('#sheetBody').addEventListener('keydown', e => { if (!sec.hidden && run && run.kind === 'contract' && e.key === 'Enter' && e.target.id === 'bkIn'){ const v = e.target.value.trim(); if (v) answer(v); } });
  const back = () => app.go(view === 'hall' ? '#/town/diagon' : '#/bank');
  $('#bkBack').addEventListener('click', back);
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else back(); } });
  async function show({id}){
    if (!isOpen()){ app.go('#/me', true); return; }
    await errand.load();
    const c = errand.cur();
    view = id === 'vault' && hasVault() ? 'vault' : id === 'cart' && c && c.at === 'cart' ? 'cart' : id === 'lestrange' && c && (c.at === 'cart' || c.at === 'ledger') ? 'lestrange' : 'hall'; run = null;
    draw();
    if (view === 'cart') ride();
    await load(); if (sec.hidden) return;
    draw();
    if (view === 'hall' && !st().seen){ st().seen = srs.today(); store.save(); }
  }
  return {show, resize: () => { placeHeap(); placeItem(); }, refresh: () => { if (!sec.hidden) draw(); }};
}
