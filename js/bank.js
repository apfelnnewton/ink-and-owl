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
import {$, esc, toast, openSheet, closeSheet, isSheetOpen} from './ui.js';

export const ID = 'gringotts';
export const DESK = {id: ID, ko: '그린고츠', place: 'bank'};   // the post tab (letters.js)
const SICKLE = 29, GALLEON = 493, LIMIT = 10 * GALLEON;
const st = () => { const s = store.get(); return s.bank || (s.bank = {}); };
export const isOpen = () => shops.isOpen();
export const vault = () => st().vault || 0;
export const debt = () => st().debt || 0;
export const hasVault = () => !!st().signed;
const tick = () => { const b = st(); b.n = (b.n || 0) + 1; };

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
  b.debt = (b.debt || 0) - toDebt; b.vault = (b.vault || 0) + (k - toDebt); tick(); store.save();
  return {toDebt, toVault: k - toDebt};
}
export function withdraw(k){
  const b = st(); k = Math.floor(k);
  if (k <= 0 || k > (b.vault || 0)) return {err: 'short'};
  b.vault -= k; store.get().purse = manor.purse() + k; tick(); store.save();   // straight into the purse: it is the guest's own money, not earned
  return {};
}
export const canBorrow = () => hasVault() && !vault() && debt() + GALLEON <= LIMIT;
export const borrowMax = () => Math.floor((LIMIT - debt()) / GALLEON);
export function borrow(g){
  const b = st();
  if (!hasVault()) return {err: 'noVault'};
  if (vault()) return {err: 'vault'};
  if (g < 1 || debt() + g * GALLEON > LIMIT) return {err: 'limit'};
  b.debt = debt() + g * GALLEON; b.loans = (b.loans || 0) + 1; store.get().purse = manor.purse() + g * GALLEON; tick(); store.save();
  return {};
}
export function repay(k){
  const b = st(); k = Math.floor(Math.min(k, debt()));
  if (k <= 0 || k > manor.purse()) return {err: 'short'};
  manor.earn(-k); b.debt = debt() - k; tick(); store.save();
  return {cleared: !b.debt};
}
function openVault(){ const b = st(); if (!b.signed){ b.signed = srs.today(); tick(); store.save(); } }

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
  const stats = () => `<div><b>${esc(manor.money(manor.purse()))}</b>주머니</div>` + (hasVault() ? `<div><b>${vault() ? esc(manor.money(vault())) : '비었음'}</b>금고</div>` : '') + (debt() ? `<div><b>${esc(manor.money(debt()))}</b>빚</div>` : '');
  function drawHall(){
    photo('gringotts');
    $('#bkTtl').textContent = 'Gringotts';
    $('#bkWho').textContent = 'The Head Goblin';
    $('#bkStats').innerHTML = stats();
    const g = goblin(); $('#bkLine').innerHTML = g ? say(g) : '<span class="k">대리석 홀 끝, 높은 책상의 수석 고블린이 장부에서 눈을 든다.</span>';
    $('#bkGo').innerHTML = (!hasVault() ? go('금고를 연다 <em>계약서에 서명</em>', 'data-bk="open"')
      : go('금고 <em>보러 내려간다</em>', 'data-bk="vault"') + go('맡긴다 <em>주머니 → 금고</em>', 'data-bk="deposit"', 'me-second') + (vault() ? go('꺼낸다 <em>금고 → 주머니</em>', 'data-bk="withdraw"', 'me-second') : '')) +
      (hasVault() ? go(`빌린다 <em>${debt() ? `${borrowMax()}갈레온까지` : '10갈레온까지'}</em>`, 'data-bk="borrow"', 'me-second') : '') +
      (debt() ? go('갚는다', 'data-bk="repay"', 'me-second') : '') +
      (debt() ? '<p class="bk-note">빚이 남아 있는 동안 버는 돈의 절반은 은행으로 간다.</p>' : '');
  }
  function drawVault(){
    photo('gringotts-vault');
    $('#bkTtl').textContent = 'Your Vault';
    $('#bkWho').textContent = 'The Vault';
    $('#bkStats').innerHTML = `<div><b>${vault() ? esc(manor.money(vault())) : '비었음'}</b>맡긴 돈</div>`;
    $('#bkLine').innerHTML = `<span class="k">${vault() ? '수레가 멈추고 둥근 쇠문이 열린다. 맡긴 돈이 그대로 있다.' : '수레가 멈추고 둥근 쇠문이 열린다. 금고는 비어 있다.'}</span>`;
    $('#bkGo').innerHTML = go('홀로 올라간다', 'data-bk="hall"');
  }
  function draw(){
    sec.dataset.view = view;
    if (view === 'vault') drawVault(); else drawHall();
    placeHeap();
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
    run = {kind: 'contract', c, k: 0, then, opts: c.clauses.map(cl => shuffled([cl.answer, ...cl.options])), tried: new Set()};
    clause();
  }
  const filled = (cl, ok) => esc(cl.en).replace('___', ok ? `<b class="bk-filled">${esc(cl.answer)}</b>` : '<span class="bk-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
  function clause(said = null, done = false){
    const {c, k} = run, cl = c.clauses[k];
    const before = c.clauses.slice(0, k).map(x => `<li class="bk-done">${filled(x, true)}</li>`).join('');
    const ask = done ? '' : high()
      ? `<div class="bk-write"><input type="text" id="bkIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(cl.answer[0])}…" lang="en"><button type="button" class="sh-drill" data-bkcheck="1">확인</button></div>`
      : `<div class="dr-opts">${run.opts[k].map((o, n) => `<button type="button" data-bkpick="${esc(o)}"${run.tried.has(o) ? ' disabled class="wrong"' : ''}><i>${n + 1}</i>${esc(o)}</button>`).join('')}</div>`;
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
    run.tried.add(word); clause(any(TEXT.say.wrongClause));
  }
  function sign(){
    const then = run.then; run = null; closeSheet();
    then();
    draw(); toast(say(any(TEXT.say.signed)), 3800, true);
  }

  /* ---------- events */
  $('#bkGo').addEventListener('click', e => {
    const b = e.target.closest('[data-bk]'); if (!b || !TEXT) return;
    const a = b.dataset.bk;
    if (a === 'open') contract('open', openVault);
    else if (a === 'vault') app.go('#/bank/vault');
    else if (a === 'hall') app.go('#/bank');
    else if (a === 'borrow') borrowSheet();
    else amountSheet(a);
  });
  $('#sheetBody').addEventListener('click', e => {
    if (sec.hidden || !run) return;
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
  const back = () => app.go(view === 'vault' ? '#/bank' : '#/town/diagon');
  $('#bkBack').addEventListener('click', back);
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else back(); } });
  async function show({id}){
    if (!isOpen()){ app.go('#/me', true); return; }
    view = id === 'vault' && hasVault() ? 'vault' : 'hall'; run = null;
    draw();
    await load(); if (sec.hidden) return;
    draw();
    if (view === 'hall' && !st().seen){ st().seen = srs.today(); store.save(); }
  }
  return {show, resize: placeHeap, refresh: () => { if (!sec.hidden) draw(); }};
}
