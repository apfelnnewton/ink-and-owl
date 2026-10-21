/* The expression notebook (#/notes/<deck>): every expression of a deck, grouped by kind. Expressions from lines not
   learnt yet are shown faded and locked. Stars mark favourites; a search box filters by English or Korean.
   An expression opens as a slip with its note, the line it came from and its ten example sentences, and can be
   practised there (choose the right expression for the gap). Practice here does not touch the review schedule.
   It opens on the professor whose door you were standing at; the row of names at the top switches to any other. */
import {DECKS, LOCKED, byId, homeOf} from './decks.js';
import {available} from './doors.js';   // availableDecks: the fire and the manor join the row once they have opened
import * as store from './store.js';
import {askable, choices as pickChoices, exprLine, toggleNote} from './exchoice.js';
import * as grammar from './grammar.js';
import * as exams from './exams.js';
import * as pager from './pager.js';
import * as srs from './srs.js';
import {$, esc, toast, openSheet, closeSheet, isSheetOpen} from './ui.js';

/* the data's kinds are fine-grained (about ninety); the notebook groups them into a handful */
const GROUPS = ['격식 어휘·어투', '완곡어법·반어', '의문문·되묻기', '문장 구조', '관용구', '호칭', '영국식 어휘', '기타'];
function group(kind){
  if (/호칭/.test(kind)) return '호칭';
  if (/AmE|BrE|철자/.test(kind)) return '영국식 어휘';
  if (/부가의문|의문|되묻|반문|확인 질문/.test(kind)) return '의문문·되묻기';
  if (/완곡|반어|절제|비유|수사|비꼬|완화|위협|꾸지람|마지못/.test(kind)) return '완곡어법·반어';   // 비꼬기 · 완화 · 위협: the book lines' kinds (2026-10-14) — they were all landing in 기타
  if (/가정|도치|법조동사|구문|관계|분사|명사화|생략|명령|어순|전위|강조|총칭|현재완료|감탄|담화|삽입|분열|접속|수동|진행|연쇄|소유격|then|should|지시문|전치사|부사|조건|문법/.test(kind)) return '문장 구조';
  if (/관용|구동사|고정구|속담|고정 표현|정형|구어 표현|연어/.test(kind)) return '관용구';
  if (/격식|어휘|어투|정중|교사|고어|문학|문어|용어|다의어|구어|규율|시간 표현|부가 표현/.test(kind)) return '격식 어휘·어투';
  return '기타';
}
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export function initNotes(app){
  const sec = $('#notes'), list = $('#notesList'), q = $('#notesQ'), starBtn = $('#notesStar'), drill = $('#notesDrill');
  let deck = null, entries = [], onlyStars = false;

  const stars = () => store.get().stars;
  function build(cards, examples){
    const learnt = store.deck(deck.id).cards;
    entries = [];
    cards.forEach(c => c.bre.forEach((b, k) => {
      const key = `${c.id}#${k}`;
      const slot = examples[key] && examples[key].slot, items = ((examples[key] && examples[key].items) || []).map((it, i) => ({...it, tag: `${key}.${i}`, slot}));
      /* items: every example, to read on the expression's slip; asks: the ones asked in practice (a form of address is not — exchoice.js) */
      entries.push({key, b, card: c, open: !!learnt[c.id], group: group(b.kind), kind: b.kind, slot, items, asks: items.filter(it => askable(b.kind, it))});
    }));
  }
  function draw(){
    const term = q.value.trim().toLowerCase(), st = stars();
    const shown = entries.filter(e => (!onlyStars || st[e.key]) &&
      (!term || [e.b.expr, e.b.kind, e.b.note, e.card.line, e.card.ko].some(t => t && t.toLowerCase().includes(term))));
    const open = entries.filter(e => e.open).length;
    $('#notesCount').textContent = `${open} / ${entries.length}`;
    const starred = entries.filter(e => st[e.key] && e.open && e.asks.length);
    drill.hidden = !starred.length;
    drill.textContent = `★ 별표 표현 섞어서 연습 (${Math.min(10, starred.length * 10)}문제)`;
    if (!shown.length){ list.innerHTML = `<p class="n-empty">${onlyStars ? '별표한 표현이 아직 없습니다.' : '찾는 표현이 없습니다.'}</p>`; return; }
    list.innerHTML = GROUPS.map(gname => {
      const g = shown.filter(e => e.group === gname);
      if (!g.length) return '';
      return `<section class="n-group"><h2>${gname}<span>${g.filter(e => e.open).length} / ${g.length}</span></h2><ul>` +
        g.map(e => `<li class="${e.open ? '' : 'locked'}">
          <button type="button" class="n-item" data-key="${e.key}" ${e.open ? '' : 'disabled aria-disabled="true"'}>
            <span class="n-expr" lang="en">${esc(e.b.expr)}</span>
            <span class="n-kind">${esc(e.b.kind)}${e.b.shared ? ' · 영미 공통' : ''}${e.open ? '' : ' · 아직 안 배움'}</span>
          </button>
          ${e.open ? `<button type="button" class="n-star${st[e.key] ? ' on' : ''}" data-star="${e.key}" aria-pressed="${!!st[e.key]}" aria-label="별표">★</button>` : '<span class="n-lock" aria-hidden="true">🔒</span>'}
        </li>`).join('') + '</ul></section>';
    }).join('');
  }

  /* ---------- one expression: note, source line, ten examples (its own one-expression drill removed 2026-10-09: the answer was always the same expression) */
  function openEntry(key){
    const e = entries.find(x => x.key === key); if (!e || !e.open) return;
    const ex = e.items.map(it => {
      const at = it.en.indexOf(it.blank);
      const en = at < 0 ? esc(it.en) : esc(it.en.slice(0, at)) + `<b>${esc(it.blank)}</b>` + esc(it.en.slice(at + it.blank.length));
      return `<li><span class="en" lang="en">${en}</span><span class="kr">${esc(it.ko)}</span></li>`;
    }).join('');
    const wrote = (store.get().wrote || {})[e.key];   // times used in a letter to a friend (friends.js)
    openSheet(`<div class="sh-kind"><span>${esc(e.b.kind)}</span>${e.b.shared ? '<span class="sh-common">영미 공통</span>' : ''}${wrote ? `<span>편지에 ${wrote}번 씀</span>` : ''}</div>` +
      `<h2 class="sh-expr" id="shTitle" lang="en">${esc(e.b.expr)}</h2><p class="sh-note">${esc(e.b.note)}</p>` +
      `<div class="sh-src"><span class="lab">이 대사에서</span><span class="en" lang="en">${esc(e.card.line)}</span><span class="kr">${esc(e.card.ko)}</span></div>` +
      `<ul class="sh-ex">${ex}</ul>` + (exCtx ? `<button type="button" class="sh-drill ex-back" data-exg="${exCtx}">← 묶음으로</button>` : ''));
  }

  /* ---------- practice: choose the expression for the gap. Every answer is kept (state.exs[deck] — done: times asked,
     miss: the sentences last answered wrong, for "다시 볼 예문"); it never touches the review schedule.
     gid: the example book's group the round came from ('' for the starred mix) */
  const X = () => { const s = store.get(), all = s.exs || (s.exs = {}), x = all[deck.id] || (all[deck.id] = {}); x.miss = x.miss || {}; x.done = x.done || {}; return x; };
  let run = null;
  function startDrill(pool, gid = ''){
    if (!pool.length){ toast('연습할 예문이 없습니다.'); return; }
    /* the sentences asked least come first, so that "10문제 더" goes on through the ones not yet seen */
    const done = X().done, least = list => shuffle(list).sort((a, b) => (done[a.tag] || 0) - (done[b.tag] || 0));
    const keyOf = it => it.tag.replace(/\.\d+$/, ''), same = new Set(pool.map(keyOf));
    /* a day's group mixes in three sentences of expressions learnt on other days (2026-10-19 user, 다): the answer is then
       not always one of that day's expressions, and the older ones come round now and then */
    let others = [];
    if (gid && gid !== 'miss') others = least(entries.filter(e => e.open && !same.has(e.key)).flatMap(e => e.asks.map(it => ({...it, expr: e.b.expr})))).slice(0, 3);
    const items = [...least(pool).slice(0, 10 - others.length), ...others];
    run = {items: shuffle(items), k: 0, right: 0, wrong: [], gid, same};
    ask();
  }
  /* the four choices (2026-10-19 user, 가): the answer, one near miss of its form (written with the example), and two other
     expressions learnt — that day's first, then the professor's others — each in the form one of its own examples uses.
     Every choice is then an expression the learner knows: the sentence has to be read to choose — and since 2026-10-20 it fits the
     same place in the sentence, so that grammar alone does not choose (exchoice.js) */
  function choices(it){
    const key = it.tag ? it.tag.replace(/\.\d+$/, '') : '', open = entries.filter(e => e.open && e.key !== key && e.asks.length).map(e => ({...e, items: e.asks}));
    return pickChoices(it, [open.filter(e => run.same && run.same.has(e.key)), open.filter(e => !(run.same && run.same.has(e.key)))]);
  }
  function ask(){
    const it = run.items[run.k], at = it.en.indexOf(it.blank);
    const opts = it.opts || (it.opts = choices(it));
    openSheet(`<div class="sh-kind"><span>예문 연습 ${run.k + 1} / ${run.items.length}</span><span>${run.right}개 맞음</span></div>` +
      `<p class="dr-line" lang="en">${esc(it.en.slice(0, at))}<span class="dr-blank">${' '.repeat(Math.max(6, it.blank.length))}</span>${esc(it.en.slice(at + it.blank.length))}</p>` +
      `<div class="dr-opts">${opts.map((o, i) => `<button type="button" data-pick="${esc(o)}"><i>${i + 1}</i>${esc(o)}</button>`).join('')}</div>` +
      `<p class="dr-ko" hidden>${esc(it.ko)}</p>` + exprLine(it.expr, '', noteOf(it)) +
      `<button type="button" class="sh-drill dr-next" hidden>${run.k + 1 < run.items.length ? '다음 →' : '결과 보기'}</button>`);
  }
  const noteOf = it => { const key = it.tag ? it.tag.replace(/\.\d+$/, '') : '', e = entries.find(x => x.key === key); return e ? e.b.note : ''; };
  function pick(opt){
    const it = run.items[run.k], body = $('#sheetBody');
    if (body.querySelector('.dr-opts button:disabled')) return;
    const ok = opt === it.blank, x = X();
    if (ok) run.right++; else run.wrong.push(it);
    if (it.tag){ x.done[it.tag] = (x.done[it.tag] || 0) + 1; if (ok) delete x.miss[it.tag]; else x.miss[it.tag] = srs.today(); store.save(); }
    body.querySelectorAll('.dr-opts button').forEach(b => { b.disabled = true; if (b.dataset.pick === it.blank) b.classList.add('right'); else if (b.dataset.pick === opt) b.classList.add('wrong'); });
    const blank = body.querySelector('.dr-blank'); blank.textContent = it.blank; blank.classList.add(ok ? 'right' : 'wrong');
    body.querySelector('.dr-ko').hidden = false; body.querySelector('.dr-expr').hidden = false;
    body.querySelector('.dr-next').hidden = false;
  }
  function nextQ(){
    run.k++;
    if (run.k < run.items.length){ ask(); return; }
    /* the result, with the sentences answered wrong (answer in bold, and the meaning) */
    openSheet(`<h2 class="sh-expr" id="shTitle">${run.right} / ${run.items.length}</h2><p class="sh-note">${run.right === run.items.length ? 'Flawless. Do not let it go to your head.' : run.right >= run.items.length * .7 ? 'Passable.' : 'Again. Slowly, this time.'}</p>` +
      (run.wrong.length ? `<h3 class="ex-wh">틀린 문제 ${run.wrong.length}개 · "다시 볼 예문"에 모아 둠</h3><ul class="sh-ex">${run.wrong.map(it => `<li><span class="en" lang="en">${filled(it)}</span><span class="kr">${esc(it.ko)}</span></li>`).join('')}</ul>` : '') +
      (run.gid ? `<button type="button" class="sh-drill" data-exrun="${run.gid}">${run.gid === 'miss' ? '다시 볼 예문 · 다시' : '10문제 더'}</button><button type="button" class="sh-drill ex-back" data-exg="${run.gid}">← 묶음으로</button>`
        : `<button type="button" class="sh-drill" data-again="1">같은 범위로 다시</button>`));
  }
  const filled = it => { const at = it.en.indexOf(it.blank); return at < 0 ? esc(it.en) : esc(it.en.slice(0, at)) + `<b>${esc(it.blank)}</b>` + esc(it.en.slice(at + it.blank.length)); };
  const pool = keys => entries.filter(e => keys.includes(e.key)).flatMap(e => e.asks.map(it => ({...it, expr: e.b.expr})));
  let lastKeys = [];

  /* ---------- the example book (2026-10-19 user): the examples of the expressions learnt, grouped by the day their line was
     first learnt (srs.grade's `ld`; lines learnt before that was kept are "그 전에 배운 표현"), and "다시 볼 예문" — the
     sentences last answered wrong, which leave once answered right. Each group: its expressions (each opens its slip of
     ten examples) and a round of ten, then ten more */
  const learntOn = e => ((store.deck(deck.id).cards[e.card.id] || {}).ld) || '';
  function groups(){
    const open = entries.filter(e => e.open && e.asks.length), days = {};
    for (const e of open){ const d = learntOn(e) || 'old'; (days[d] = days[d] || []).push(e); }
    return days;
  }
  const missItems = () => { const m = X().miss; return entries.filter(e => e.open).flatMap(e => e.asks.filter(it => m[it.tag]).map(it => ({...it, expr: e.b.expr}))); };
  const groupName = gid => gid === 'miss' ? '다시 볼 예문' : gid === 'old' ? '그 전에 배운 표현' : `${srs.dayLabel(gid)}에 배운 표현`;
  const groupPool = gid => gid === 'miss' ? missItems() : (groups()[gid] || []).flatMap(e => e.asks.map(it => ({...it, expr: e.b.expr})));
  function book(){
    const days = groups(), keys = Object.keys(days).filter(d => d !== 'old').sort().reverse(), miss = missItems(), done = X().done;
    const row = (gid, list) => { const n = list.reduce((s, e) => s + e.asks.length, 0), seen = list.reduce((s, e) => s + e.asks.filter(it => done[it.tag]).length, 0);
      return `<li><button type="button" class="ex-g" data-exg="${gid}"><b>${esc(groupName(gid))}</b><span>표현 ${list.length}개 · 예문 ${n}개${seen ? ` · 푼 예문 ${seen}` : ''}</span></button></li>`; };
    if (!keys.length && !days.old){ toast('아직 배운 표현이 없습니다.'); return; }
    const pg = pager.byMonth('exb:' + deck.id, keys, d => d, '일');   // a month of days at a time (2026-10-21 user)
    openSheet(`<div class="sh-kind"><span>${esc(deck.ko)}</span></div><h2 class="sh-expr" id="shTitle">예문 연습장</h2>` +
      `<p class="sh-note">배운 날마다 그날의 표현과 예문이 모여 있다. 연습은 복습 일정에 영향을 주지 않는다.</p><ul class="ex-book">` +
      (miss.length ? `<li><button type="button" class="ex-g miss" data-exg="miss"><b>다시 볼 예문</b><span>틀린 예문 ${miss.length}개</span></button></li>` : '') +
      '</ul>' + pg.nav + '<ul class="ex-book">' + pg.items.map(d => row(d, days[d])).join('') + (days.old && pg.oldest ? row('old', days.old) : '') + '</ul>');
  }
  function openGroup(gid){
    if (gid === 'miss'){
      const items = missItems(); if (!items.length){ book(); return; }
      openSheet(`<div class="sh-kind"><span>${esc(deck.ko)}</span></div><h2 class="sh-expr" id="shTitle">다시 볼 예문 · ${items.length}개</h2>` +
        `<button type="button" class="sh-drill" data-exrun="miss">다시 볼 예문 연습 · ${Math.min(10, items.length)}문제</button>` +
        `<ul class="sh-ex">${items.map(it => `<li><span class="en" lang="en">${filled(it)}</span><span class="kr">${esc(it.ko)}</span></li>`).join('')}</ul>` +
        `<button type="button" class="sh-drill ex-back" data-exbook="1">← 예문 연습장</button>`);
      return;
    }
    const list = groups()[gid] || [];
    if (!list.length){ book(); return; }
    exCtx = gid;
    openSheet(`<div class="sh-kind"><span>${esc(deck.ko)}</span></div><h2 class="sh-expr" id="shTitle">${esc(groupName(gid))} · ${list.length}개</h2>` +
      `<button type="button" class="sh-drill" data-exrun="${gid}">이 표현들로 예문 연습 · 10문제</button>` +
      `<ul class="ex-list">${list.map(e => `<li><button type="button" class="ex-e" data-key="${e.key}"><b lang="en">${esc(e.b.expr)}</b><span>예문 ${e.items.length}개 ›</span></button></li>`).join('')}</ul>` +
      `<button type="button" class="sh-drill ex-back" data-exbook="1">← 예문 연습장</button>`);
  }
  let exCtx = '';   // the group an expression's slip was opened from: its slip gets a way back

  /* ---------- events */
  list.addEventListener('click', e => {
    const s = e.target.closest('[data-star]');
    if (s){ const st = stars(), k = s.dataset.star; if (st[k]) delete st[k]; else st[k] = true; store.save(); draw(); return; }
    const it = e.target.closest('[data-key]'); if (it){ exCtx = ''; openEntry(it.dataset.key); }
  });
  $('#sheetBody').addEventListener('click', e => {
    if (sec.hidden) return;
    const p = e.target.closest('[data-pick]'); if (p){ pick(p.dataset.pick); return; }
    const nb = e.target.closest('[data-drnote]'); if (nb){ toggleNote(nb); return; }
    if (e.target.closest('.dr-next')){ nextQ(); return; }
    if (e.target.closest('[data-again]')){ startDrill(pool(lastKeys)); return; }
    const r = e.target.closest('[data-exrun]'); if (r){ startDrill(groupPool(r.dataset.exrun), r.dataset.exrun); return; }
    const g = e.target.closest('[data-exg]'); if (g){ openGroup(g.dataset.exg); return; }
    if (e.target.closest('[data-pg^="exb:"]') && pager.turn(e.target)){ book(); return; }
    if (e.target.closest('[data-pg^="wb:"]') && pager.turn(e.target)){ wordBook(); return; }
    if (e.target.closest('[data-exbook]')){ exCtx = ''; book(); return; }
    const k = e.target.closest('.ex-e[data-key]'); if (k) openEntry(k.dataset.key);
  });
  drill.addEventListener('click', () => { exCtx = ''; const st = stars(); lastKeys = entries.filter(e => st[e.key] && e.open).map(e => e.key); startDrill(pool(lastKeys)); });
  $('#notesExBook').addEventListener('click', () => { exCtx = ''; book(); });
  q.addEventListener('input', draw);
  starBtn.addEventListener('click', () => { onlyStars = !onlyStars; starBtn.setAttribute('aria-pressed', onlyStars); starBtn.classList.toggle('on', onlyStars); draw(); });
  /* back: to the corridor — or to the fire or the manor room the notebook was opened from (#/notes/<deck>/here) */
  let ret = '#/', inside = false;
  $('#notesBack').addEventListener('click', () => app.go(ret));
  $('#notesScript').addEventListener('click', () => app.go('#/script/' + deck.id));
  $('#notesPrint').addEventListener('click', printSheet);
  $('#notesGram').addEventListener('click', () => grammar.catalogue(deck.id));
  /* the word book (2026-10-16, docs/plan-owl.md 5): every hard word of the lines learnt, A to Z; a red dot on a word missed
     the last time an O.W.L. paper asked it. A tap opens the word as on the card */
  let wordList = [];
  let missedWords = new Set();
  $('#notesWords').addEventListener('click', async () => {
    const words = await app.loadWords(deck.id), w = exams.standing(deck.id, words);
    missedWords = new Set(w.missed.map(e => e.key));
    wordList = [...w.all].sort((a, b) => a.w.localeCompare(b.w));
    if (!wordList.length){ toast('아직 배운 낱말이 없다'); return; }
    wordBook();
  });
  /* twenty at a time (2026-10-21 user); the index on each button stays the word's place in the whole list */
  function wordBook(){
    const missed = missedWords, pg = pager.byCount('wb:' + deck.id, wordList, 20, false, '개');
    openSheet(`<div class="sh-kind"><span>${esc(deck.ko)}</span></div><h2 class="sh-expr" id="shTitle">낱말장 · ${wordList.length}개</h2>` +
      (missed.size ? `<p class="sh-note">붉은 점: 지난 O.W.L.에서 틀린 낱말 ${missed.size}개</p>` : '') +
      pg.nav + `<ul class="wb-list">${pg.items.map((e, n) => { const i = pg.from + n; return `<li><button type="button" data-wb="${i}"${missed.has(e.key) ? ' class="miss"' : ''}><b lang="en">${esc(e.w)}</b><span>${esc(e.ko)}</span></button></li>`; }).join('')}</ul>`);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-wb]'); if (!b || sec.hidden) return;
    const w = wordList[+b.dataset.wb]; if (!w) return;
    openSheet(`<div class="sh-kind"><span>${esc(w.pos)}</span></div><h2 class="sh-expr" id="shTitle" lang="en">${esc(w.w)}</h2><p class="sh-note">${esc(w.ko)}</p>` +
      `<p class="sh-word"><span>쉬운 말</span> <span lang="en">${esc(w.plain)}</span></p>` +
      (w.fam && w.fam.length ? `<p class="sh-word"><span>같은 뿌리</span> <span lang="en">${esc(w.fam.join(' · '))}</span></p>` : '') +
      `<ul class="sh-ex"><li><span class="en" lang="en">${esc(w.ex.en)}</span><span class="kr">${esc(w.ex.ko)}</span></li></ul>`);
  });

  /* ---------- a worksheet for paper: the starred expressions (or, with none starred, every learnt one), each with its
     note, then two gap-fill sentences per expression with four choices, and an answer key at the end */
  function printSheet(){
    const st = stars();
    let pick = entries.filter(e => e.open && st[e.key]);
    const which = pick.length ? '별표한 표현' : '배운 표현';
    if (!pick.length) pick = entries.filter(e => e.open);
    if (!pick.length){ toast('아직 배운 표현이 없습니다.'); return; }
    pick = pick.slice(0, 40);
    const key = [];
    const qs = pick.flatMap(e => e.asks.slice(2, 4)).map((it, n) => {
      const at = it.en.indexOf(it.blank), opts = shuffle([it.blank, ...it.options]);
      key.push(`${n + 1}. ${String.fromCharCode(97 + opts.indexOf(it.blank))}) ${esc(it.blank)}`);
      return `<li><p class="pq">${esc(it.en.slice(0, at))}<span class="gap"></span>${esc(it.en.slice(at + it.blank.length))}</p>` +
        `<p class="po">${opts.map((o, i) => `<span>${String.fromCharCode(97 + i)}) ${esc(o)}</span>`).join('')}</p><p class="pk">${esc(it.ko)}</p></li>`;
    });
    $('#printArea').innerHTML = `<header><h1>${esc(deck.who)} · Expressions</h1><p>${esc(deck.where)} · ${which} ${pick.length}개 · ${new Date().toLocaleDateString('ko-KR')}</p></header>` +
      `<section class="pe"><h2>A. Expressions</h2><ol>${pick.map(e => `<li><b>${esc(e.b.expr)}</b> <small>${esc(e.b.kind)}${e.b.shared ? ' · 영미 공통' : ''}</small><p>${esc(e.b.note)}</p><p class="src">${esc(e.card.line)}</p></li>`).join('')}</ol></section>` +
      `<section class="pp"><h2>B. Fill in the gap</h2><ol>${qs.join('')}</ol></section>` +
      `<section class="pa"><h2>Answers</h2><p>${key.join(' &nbsp; ')}</p></section>`;
    window.print();
  }
  /* the professors, in corridor order: open rooms switch the notebook, closed ones answer in character */
  $('#notesWho').addEventListener('click', e => {
    const b = e.target.closest('[data-who]'); if (!b) return;
    const d = byId(b.dataset.who);
    if (d.file){ if (d.id !== deck.id){ inside = true; app.go('#/notes/' + d.id); } return; }
    const l = (LOCKED[d.id] || [{en: 'Not yet.', ko: '아직이다.'}])[0];
    toast(`<span class="q" lang="en">“${esc(l.en)}”</span><span class="k">${esc(l.ko)} — ${esc(d.ko)}</span>`, 3600, true);
  });
  document.addEventListener('keydown', e => {
    if (sec.hidden) return;
    if (e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else app.go(ret); }
    else if (isSheetOpen() && ['1', '2', '3', '4'].includes(e.key) && !e.target.closest('input')){ const b = $('#sheetBody').querySelectorAll('.dr-opts button')[+e.key - 1]; if (b) pick(b.dataset.pick); }
  });

  async function show({id, sub, more}){
    deck = byId(id) && byId(id).file ? byId(id) : byId('snape');
    /* changing the name at the top of the notebook keeps the way back; from the report (exr/<day>) the way back is the report */
    if (sub === 'here') ret = homeOf(deck.id); else if (sub === 'exr') ret = '#/report/' + deck.id; else if (!inside) ret = '#/';
    $('#notesBack').setAttribute('aria-label', ret.startsWith('#/report') ? '성적표로 돌아가기' : ret === '#/' ? '복도로 돌아가기' : '방으로 돌아가기');
    inside = false;
    $('#notesWho').innerHTML = DECKS.filter(d => d.place === 'corridor' || available(d.id)).map(d => `<button type="button" data-who="${d.id}" class="${d.id === deck.id ? 'on' : ''}${d.file ? '' : ' shut'}" aria-pressed="${d.id === deck.id}">${esc(d.ko.replace(/ 교수$/, ''))}${d.file ? '' : '<span class="sr"> (잠김)</span>'}</button>`).join('');
    const ph = $('#notesPhoto');
    ph.style.backgroundImage = `url("${new URL(`assets/rooms/${deck.id}-portrait.webp`, location.href).href}")`;
    let cards, examples;
    try { [cards, examples] = await Promise.all([app.loadDeck(deck.id), app.loadExamples(deck.id)]); }
    catch (e){ toast('대본을 불러오지 못했습니다.'); app.go('#/', true); return; }
    build(cards, examples);
    draw();
    $('#notesScroll').scrollTop = 0;
    exCtx = '';
    if (sub === 'exr' && more) openGroup(more); else if (sub === 'ex') book();
  }
  return {show};
}
