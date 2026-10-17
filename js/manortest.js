/* The manor's two word tests (2026-10-16, docs/plan-owl.md 4; rules in exams.js), drawn on the exam screen (exam.js
   hands over for #/exam/lucius and #/exam/bellatrix).
   The Audit: a page of Lucius's house ledger, an entry for each word he wants back (its sentence, its gap, its Korean
   meaning underneath); handed back, he stamps it — the lines that do not balance are struck in red — and pays.
   Word for Word: Bellatrix reads out a meaning in plain words and wants HER word back, one at a time, against a thin
   line of time on the slip; three blots and she tears the page. */
import {byId, homeOf} from './decks.js';
import * as exams from './exams.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as store from './store.js';
import {earn, money, purse} from './manor.js';
import {esc, toast, reduced} from './ui.js';

const SICKLE = 29;
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateEn = d => { const [, m, dd] = d.split('-'); return `${+dd} ${MON[+m - 1]}`; };
const say = (l, cls = '') => l ? `<div class="mt-say ${cls}"><p lang="en">${esc(bond.fill(l.en))}</p><p class="ko">${esc(bond.fill(l.ko))}</p></div>` : '';
const pick = (set, seed) => set && set.length ? set[seed % set.length] : null;
const writeBox = (q, i) => `<label class="ex-write"><span class="first" lang="en">${esc(q.first)}</span><input type="text" data-q="${i}" lang="en" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" aria-label="${i + 1}번 답">${exams.wordCount(q)}</label>`;
const typed = (q, v) => { v = String(v || '').trim(); return v ? (v.toLowerCase().startsWith(q.first.toLowerCase()) ? v : q.first + v) : null; };

export async function showManor(ctx){
  const {app, id, body, scroll, setTitle, setCount} = ctx;
  const k = exams.MANOR[id], T = (exams.text() || {})[id] || {};
  setTitle(k === 'audit' ? 'The Audit' : 'Word for Word');
  const [words, cards] = await Promise.all([app.loadWords(id), app.loadDeck(id).catch(() => null)]);
  const back = `<button type="button" class="ex-btn quiet" data-go="${homeOf(id)}"><span lang="en">Back</span> ${id === 'lucius' ? '서재로' : '응접실로'}</button>`;
  const card = (en, ko) => { body.innerHTML = `<p class="ex-say" lang="en">${esc(en)}</p><p class="ex-say-ko">${esc(ko)}</p><div class="ex-foot">${back}</div>`; scroll.scrollTop = 0; };
  if (!exams.manorDue(id, words, cards)){
    card(k === 'audit' ? 'The ledger is not open today.' : 'Not today. I have nothing to hear back.',
      k === 'audit' ? '오늘은 장부를 펼치지 않는다. 물건 검수를 통과하거나 일한 날이 열흘 찰 때마다 감사가 있다.' : '오늘은 되읽을 것이 없다. 받아쓰기를 한 날이 닷새 찰 때마다 그녀가 되읽으라고 한다.');
    return;
  }
  const p = cards && srs.preview(id, cards);
  if (p && !(p.done || p.empty)){ card(k === 'audit' ? 'The day\'s work first.' : 'Take down today\'s first.', k === 'audit' ? '오늘 서재 일을 먼저 마친다.' : '오늘 받아쓰기를 먼저 마친다.'); return; }
  const all = Object.values(words).flat(), qs = exams.manorQuestions(id, words, all);
  if (k === 'audit') audit(ctx, T, qs, back); else readBack(ctx, T, qs, back);
}

/* ---------- The Audit */
function audit({body, scroll, setCount}, T, qs, back){
  const answers = qs.map(() => null), seed = Date.now();
  let warned = false;
  const draw = () => {
    body.innerHTML = `<div class="mt-h" lang="en">The Accounts of the House</div><div class="mt-s" lang="en">Audit · ${esc(dateEn(srs.today()))}</div>` +
      say(pick(T.open, seed)) +
      `<table class="mt-led"><thead><tr><th lang="en">No.</th><th lang="en">Entry</th></tr></thead><tbody>` +
      qs.map((q, i) => `<tr><td class="no" lang="en">${ROMAN[i]}</td><td class="ent"><div lang="en">${esc(q.sentence).replace(/____/g, '<span class="ex-gap"></span>')}</div>${q.hint ? `<div class="mt-gloss" lang="en">${esc(q.hint)}</div>` : ''}` +   /* no Korean meaning while the gap is open: the meaning alone would pick the word (user, 2026-10-16); it shows once marked */
        (q.write ? writeBox(q, i) : `<div class="ex-opts en">${q.opts.map((o, j) => `<button type="button" data-q="${i}" data-o="${j}" lang="en"><b>${'abcd'[j]}</b><span>${esc(o)}</span></button>`).join('')}</div>`) + '</td></tr>').join('') +
      `</tbody></table><div class="ex-foot"><button type="button" class="ex-btn" data-hand><span lang="en">Hand back the ledger</span> 장부를 돌려준다</button>${back}</div>`;
    scroll.scrollTop = 0; count();
  };
  const count = () => setCount(`${answers.filter(Boolean).length} / ${qs.length}`);
  body.onclick = e => {
    const b = e.target.closest('.ex-opts button');
    if (b){ const i = +b.dataset.q; answers[i] = qs[i].opts[+b.dataset.o]; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); count(); return; }
    if (e.target.closest('[data-hand]')){
      const empty = answers.filter(a => !a).length;
      if (empty && !warned){ warned = true; toast(`${empty}줄이 비어 있다 · 그대로 돌려주려면 한 번 더 누른다`, 3200); return; }
      stamped();
    }
  };
  body.oninput = e => { const inp = e.target.closest('input[data-q]'); if (!inp) return; answers[+inp.dataset.q] = typed(qs[+inp.dataset.q], inp.value); count(); };
  const stamped = () => {
    const sit = exams.recordManor('lucius', qs, answers), wrong = sit.miss.length, pay = exams.auditPay(wrong), [st, stKo] = exams.auditStamp(wrong);
    if (pay){ earn(pay * SICKLE); store.save(); }
    const line = pick((T.pay || {})[pay === 5 ? 'full' : pay ? 'part' : 'none'], sit.t);
    const past = exams.manorPast('lucius').slice(-8).reverse();
    body.innerHTML = `<div class="mt-h" lang="en">The Accounts of the House</div><div class="mt-s" lang="en">Audited · ${esc(dateEn(sit.d))}</div>` +
      `<table class="mt-led marked"><thead><tr><th lang="en">No.</th><th lang="en">Entry</th><th></th></tr></thead><tbody>` +
      qs.map((q, i) => { const ok = exams.right(q, answers[i]);
        return `<tr class="${ok ? '' : 'bad'}"><td class="no" lang="en">${ROMAN[i]}</td><td class="ent"><div lang="en">${esc(q.sentence).replace(/____/g, `<span class="ex-pen${ok ? '' : ' struck'}">${esc(answers[i] || '—')}</span>`)}</div>` +
          (ok ? '' : `<span class="ex-fix" lang="en">${esc(q.answer)}</span>`) + `<span class="gl">${esc(q.ko)}</span></td><td class="ok">${ok ? '✓' : '✗'}</td></tr>`; }).join('') +
      `</tbody></table><div class="stamp${wrong ? ' red' : ''}" lang="en">${esc(st)}</div><p class="pay">${esc(stKo)} · ${pay ? `삯 ${pay}시클 · 주머니 ${esc(money(purse()))}` : '삯 없음'}</p>` +
      say(line) +
      `<h3 class="mt-past">지난 감사</h3><table class="mt-hist"><tbody>${past.map(s => `<tr><td>${esc(srs.dayLabel(s.d))}</td><td lang="en">${s.ok} / ${s.n}</td><td>${exams.auditPay(s.miss.length)}시클</td></tr>`).join('')}</tbody></table>` +
      `<div class="ex-foot">${back}</div>`;
    setCount(''); scroll.scrollTop = 0;
  };
  draw();
}

/* ---------- Word for Word */
function readBack(ctx, T, qs, back){
  const {body, scroll, setCount} = ctx;
  const answers = [], seed = Date.now(), level = srs.level(), secs = exams.WFW_TIME[level] || 15;
  let i = 0, blots = 0, timer = 0, raf = 0, end = 0, done = false;
  const stop = () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  const slip = () => {
    const q = qs[i];
    body.innerHTML = say(pick(T.ask, seed + i), 'her') +
      `<div class="wfw-slip"><div class="wfw-top"><span class="wfw-n" lang="en">${i + 1} / ${qs.length}</span><span class="wfw-blots" aria-label="얼룩 ${blots}개">${[0, 1, 2].map(k => `<i class="${k < blots ? 'on' : ''}"></i>`).join('')}</span></div>` +
      `<div class="wfw-time"><i></i></div><p class="wfw-plain" lang="en">${esc(q.plain)}<span class="pos">${esc(q.pos)}</span></p>`   /* the plain English only: with the Korean the meaning alone gave her word away (user, 2026-10-16) */ + `` +
      (q.write ? writeBox(q, i) + '<button type="button" class="ex-btn" data-ok>확인</button>' : `<div class="ex-opts en">${q.opts.map((o, j) => `<button type="button" data-o="${j}" lang="en"><b>${'abcd'[j]}</b><span>${esc(o)}</span></button>`).join('')}</div>`) +
      '</div>';
    setCount(''); scroll.scrollTop = 0;
    const bar = body.querySelector('.wfw-time i'); end = performance.now() + secs * 1000;
    const tick = () => { const left = Math.max(0, end - performance.now()); bar.style.width = (left / (secs * 1000) * 100) + '%'; if (left > 0) raf = requestAnimationFrame(tick); };
    tick(); timer = setTimeout(() => answer(null), secs * 1000);
    const inp = body.querySelector('input'); if (inp && !reduced()) setTimeout(() => inp.focus({preventScroll: true}), 60);
  };
  const answer = given => {
    if (done) return; stop();
    const q = qs[i]; answers.push(given); const ok = exams.right(q, given);
    if (!ok){
      blots++;
      if (blots >= 3){ finish(true); return; }
      const dot = body.querySelectorAll('.wfw-blots i')[blots - 1]; if (dot) dot.classList.add('on');   // the blot lands now, not on the next slip
      body.querySelector('.wfw-slip').classList.add('missed');
      /* the clock stops and her word stays until the guest goes on (user chose 가, 2026-10-16: it was gone in two seconds) */
      body.insertAdjacentHTML('beforeend', `<div class="wfw-miss">${say(pick(T.miss, seed + blots), 'red')}<p class="wfw-was" lang="en">${esc(q.answer)}</p><button type="button" class="ex-btn" data-next><span lang="en">Next</span> 다음</button></div>`);
      const nb = body.querySelector('[data-next]'); if (nb){ nb.scrollIntoView({block: 'nearest'}); nb.focus({preventScroll: true}); }
    } else next();
  };
  const next = () => { i++; if (i >= qs.length) finish(false); else slip(); };
  const finish = torn => {
    done = true; stop();
    const sit = exams.recordManor('bellatrix', qs, answers, torn ? {torn: true} : {});
    let coins = 0;
    if (!torn && !sit.miss.length){ coins = 1 + sit.t % 3; earn(coins * SICKLE); store.save(); }
    const kept = exams.manorPast('bellatrix').filter(s => !s.torn).length;
    const line = torn ? pick(T.end, sit.t) : sit.miss.length ? pick(T.through, sit.t) : pick(T.clean, sit.t);
    body.innerHTML = `<div class="wfw-slip done${torn ? ' torn' : ''}"><p class="wfw-res" lang="en">${torn ? 'Torn.' : `${sit.ok} of ${sit.n}`}</p>` +
      `<ol class="wfw-list">${qs.slice(0, answers.length).map((q, k) => { const ok = exams.right(q, answers[k]); return `<li class="${ok ? '' : 'bad'}"><span lang="en">${esc(q.plain)}</span><b lang="en">${esc(q.answer)}</b>${ok ? '' : `<s lang="en">${esc(answers[k] || '—')}</s>`}</li>`; }).join('')}</ol></div>` +
      say(line, torn ? 'red' : 'her') +
      `<p class="pay">${torn ? '종이는 찢겼다' : `서랍에 넣었다 · 서랍의 종이 ${kept}장`}${coins ? ` · 바닥에 시클 ${coins}닢 · 주머니 ${esc(money(purse()))}` : ''}</p>` +
      `<div class="ex-foot"><button type="button" class="ex-btn quiet" data-leave="${torn ? 'tear' : 'fold'}"><span lang="en">Back</span> 응접실로</button></div>`;
    scroll.scrollTop = 0;
  };
  body.onclick = e => {
    const b = e.target.closest('.ex-opts button'); if (b && !done && !body.querySelector('.missed')){ b.classList.add('on'); answer(qs[i].opts[+b.dataset.o]); return; }
    const lv = e.target.closest('[data-leave]'); if (lv){ if (!lv.disabled){ lv.disabled = true; outOfHand(lv.dataset.leave).then(() => ctx.app.go(homeOf('bellatrix'))); } return; }
    if (e.target.closest('[data-next]')){ next(); return; }
    if (e.target.closest('[data-ok]') && !body.querySelector('.missed')){ const inp = body.querySelector('input'); answer(typed(qs[i], inp && inp.value)); }
  };
  body.oninput = null;
  body.onkeydown = e => { if (e.key === 'Enter' && e.target.closest('input[data-q]') && !body.querySelector('.missed')){ e.preventDefault(); answer(typed(qs[i], e.target.value)); } };
  ctx.cancel = () => { done = true; stop(); };
  slip();
}
/* The page leaves the hand (user, 2026-10-16): a torn page is torn in two down a ragged line, the halves falling apart;
   a page that held is folded in half and goes down into the drawer. Copies of the paper are moved, the paper itself is
   hidden meanwhile; with motion reduced, nothing moves. */
function outOfHand(how){
  const paper = document.getElementById('exPaper'), sec = document.getElementById('exam');
  if (!paper || reduced() || !paper.animate) return Promise.resolve();
  const r = paper.getBoundingClientRect(), box = document.createElement('div');
  box.className = 'ex-out'; Object.assign(box.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'});
  const copy = clip => { const c = paper.cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id')); Object.assign(c.style, {clipPath: clip, WebkitClipPath: clip}); box.appendChild(c); return c; };
  let anims;
  if (how === 'tear'){
    /* one ragged line from top to bottom, a little off the middle, shared by both halves */
    const pts = []; for (let k = 0; k <= 14; k++){ const y = k / 14 * 100, x = 50 + (k % 2 ? 1 : -1) * (2 + (k * 37 % 5)) + (k === 0 || k === 14 ? 0 : 0); pts.push([x.toFixed(1), y.toFixed(1)]); }
    const left = 'polygon(0% 0%, ' + pts.map(([x, y]) => x + '% ' + y + '%').join(', ') + ', 0% 100%)';
    const right = 'polygon(100% 0%, ' + pts.map(([x, y]) => x + '% ' + y + '%').join(', ') + ', 100% 100%)';
    const a = copy(left), b = copy(right);
    anims = [a.animate([{transform: 'none', opacity: 1}, {transform: 'translate(-14px, 4px) rotate(-3deg)', opacity: 1, offset: .3}, {transform: 'translate(-70px, 90vh) rotate(-18deg)', opacity: 0}], {duration: 1100, easing: 'cubic-bezier(.45,0,.75,.4)', fill: 'forwards'}),
      b.animate([{transform: 'none', opacity: 1}, {transform: 'translate(14px, -2px) rotate(3deg)', opacity: 1, offset: .3}, {transform: 'translate(80px, 90vh) rotate(21deg)', opacity: 0}], {duration: 1150, easing: 'cubic-bezier(.45,0,.75,.4)', fill: 'forwards'})];
  } else {
    /* a long page is first drawn in to fit the screen; then its top half folds down over the bottom half (the back of the
       paper shows, blank: the writing is hidden once the half passes upright); then the folded page drops away below */
    const top = copy('inset(0 0 50% 0)'); copy('inset(50% 0 0 0)');
    top.style.transformOrigin = '50% 50%'; top.style.zIndex = 2;
    const k = Math.min(1, innerHeight * .78 / r.height, innerWidth * .92 / r.width), dx = (innerWidth - r.width * k) / 2 - r.left, dy = (innerHeight - r.height * k) / 2 - r.top;
    box.style.transformOrigin = '0 0';
    const fit = `translate(${dx}px, ${dy}px) scale(${k})`, T = 1700;
    const writing = top.querySelector('.ex-body');
    anims = [box.animate([{transform: 'none', opacity: 1}, {transform: fit, opacity: 1, offset: .2}, {transform: fit, opacity: 1, offset: .62}, {transform: fit + ' translateY(55vh) scale(.5)', opacity: 0}], {duration: T, easing: 'ease-in-out', fill: 'forwards'}),
      top.animate([{transform: 'perspective(1400px) rotateX(0deg)', filter: 'brightness(1)'}, {transform: 'perspective(1400px) rotateX(0deg)', filter: 'brightness(1)', offset: .2}, {transform: 'perspective(1400px) rotateX(-180deg)', filter: 'brightness(.82)', offset: .55}, {transform: 'perspective(1400px) rotateX(-180deg)', filter: 'brightness(.82)'}], {duration: T, easing: 'ease-in-out', fill: 'forwards'})];
    if (writing) anims.push(writing.animate([{opacity: 1}, {opacity: 1, offset: .37}, {opacity: 0, offset: .375}, {opacity: 0}], {duration: T, fill: 'forwards'}));
  }
  sec.appendChild(box); paper.style.visibility = 'hidden';
  return Promise.all(anims.map(x => x.finished.catch(() => {}))).then(() => { box.remove(); paper.style.visibility = ''; });
}
void byId;
