/* The expression notebook (#/notes/<deck>): every expression of a deck, grouped by kind. Expressions from lines not
   learnt yet are shown faded and locked. Stars mark favourites; a search box filters by English or Korean.
   An expression opens as a slip with its note, the line it came from and its ten example sentences, and can be
   practised there (choose the right expression for the gap). Practice here does not touch the review schedule.
   It opens on the professor whose door you were standing at; the row of names at the top switches to any other. */
import {DECKS, LOCKED, byId} from './decks.js';
import * as store from './store.js';
import {$, esc, toast, openSheet, closeSheet, isSheetOpen} from './ui.js';

/* the data's kinds are fine-grained (about ninety); the notebook groups them into a handful */
const GROUPS = ['격식 어휘·어투', '완곡어법·반어', '의문문·되묻기', '문장 구조', '관용구', '호칭', '영국식 어휘', '기타'];
function group(kind){
  if (/호칭/.test(kind)) return '호칭';
  if (/AmE|BrE|철자/.test(kind)) return '영국식 어휘';
  if (/부가의문|의문/.test(kind)) return '의문문·되묻기';
  if (/완곡|반어|절제|비유|수사/.test(kind)) return '완곡어법·반어';
  if (/가정|도치|법조동사|구문|관계|분사|명사화|생략|명령|어순|전위|강조 do|총칭|현재완료|감탄/.test(kind)) return '문장 구조';
  if (/관용|구동사|고정구/.test(kind)) return '관용구';
  if (/격식|어휘|어투|정중|교사/.test(kind)) return '격식 어휘·어투';
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
      entries.push({key, b, card: c, open: !!learnt[c.id], group: group(b.kind), items: (examples[key] && examples[key].items) || []});
    }));
  }
  function draw(){
    const term = q.value.trim().toLowerCase(), st = stars();
    const shown = entries.filter(e => (!onlyStars || st[e.key]) &&
      (!term || [e.b.expr, e.b.kind, e.b.note, e.card.line, e.card.ko].some(t => t && t.toLowerCase().includes(term))));
    const open = entries.filter(e => e.open).length;
    $('#notesCount').textContent = `${open} / ${entries.length}`;
    const starred = entries.filter(e => st[e.key] && e.open && e.items.length);
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

  /* ---------- one expression: note, source line, ten examples, practice */
  function openEntry(key){
    const e = entries.find(x => x.key === key); if (!e || !e.open) return;
    const ex = e.items.map(it => {
      const at = it.en.indexOf(it.blank);
      const en = at < 0 ? esc(it.en) : esc(it.en.slice(0, at)) + `<b>${esc(it.blank)}</b>` + esc(it.en.slice(at + it.blank.length));
      return `<li><span class="en" lang="en">${en}</span><span class="kr">${esc(it.ko)}</span></li>`;
    }).join('');
    openSheet(`<div class="sh-kind"><span>${esc(e.b.kind)}</span>${e.b.shared ? '<span class="sh-common">영미 공통</span>' : ''}</div>` +
      `<h2 class="sh-expr" id="shTitle" lang="en">${esc(e.b.expr)}</h2><p class="sh-note">${esc(e.b.note)}</p>` +
      `<div class="sh-src"><span class="lab">이 대사에서</span><span class="en" lang="en">${esc(e.card.line)}</span><span class="kr">${esc(e.card.ko)}</span></div>` +
      (e.items.length ? `<button type="button" class="sh-drill" data-drill="${e.key}">이 표현으로 연습 (${Math.min(10, e.items.length)}문제)</button>` : '') +
      `<ul class="sh-ex">${ex}</ul>`);
  }

  /* ---------- practice inside the slip: choose the expression for the gap */
  let run = null;
  function startDrill(pool){
    if (!pool.length){ toast('연습할 예문이 없습니다.'); return; }
    run = {items: shuffle(pool).slice(0, 10), k: 0, right: 0};
    ask();
  }
  function ask(){
    const it = run.items[run.k], at = it.en.indexOf(it.blank);
    const opts = shuffle([it.blank, ...it.options]);
    openSheet(`<div class="sh-kind"><span>예문 연습 ${run.k + 1} / ${run.items.length}</span><span>${run.right}개 맞음</span></div>` +
      `<p class="dr-line" lang="en">${esc(it.en.slice(0, at))}<span class="dr-blank">${' '.repeat(Math.max(6, it.blank.length))}</span>${esc(it.en.slice(at + it.blank.length))}</p>` +
      `<div class="dr-opts">${opts.map((o, i) => `<button type="button" data-pick="${esc(o)}"><i>${i + 1}</i>${esc(o)}</button>`).join('')}</div>` +
      `<p class="dr-ko" hidden>${esc(it.ko)}</p><p class="dr-expr" hidden lang="en">${esc(it.expr)}</p>` +
      `<button type="button" class="sh-drill dr-next" hidden>${run.k + 1 < run.items.length ? '다음 →' : '결과 보기'}</button>`);
  }
  function pick(opt){
    const it = run.items[run.k], body = $('#sheetBody');
    if (body.querySelector('.dr-opts button:disabled')) return;
    const ok = opt === it.blank;
    if (ok) run.right++;
    body.querySelectorAll('.dr-opts button').forEach(b => { b.disabled = true; if (b.dataset.pick === it.blank) b.classList.add('right'); else if (b.dataset.pick === opt) b.classList.add('wrong'); });
    const blank = body.querySelector('.dr-blank'); blank.textContent = it.blank; blank.classList.add(ok ? 'right' : 'wrong');
    body.querySelector('.dr-ko').hidden = false; body.querySelector('.dr-expr').hidden = false;
    body.querySelector('.dr-next').hidden = false;
  }
  function nextQ(){
    run.k++;
    if (run.k < run.items.length){ ask(); return; }
    openSheet(`<h2 class="sh-expr" id="shTitle">${run.right} / ${run.items.length}</h2><p class="sh-note">${run.right === run.items.length ? 'Flawless. Do not let it go to your head.' : run.right >= run.items.length * .7 ? 'Passable.' : 'Again. Slowly, this time.'}</p>` +
      `<button type="button" class="sh-drill" data-again="1">같은 범위로 다시</button>`);
  }
  const pool = keys => entries.filter(e => keys.includes(e.key)).flatMap(e => e.items.map(it => ({...it, expr: e.b.expr})));
  let lastKeys = [];

  /* ---------- events */
  list.addEventListener('click', e => {
    const s = e.target.closest('[data-star]');
    if (s){ const st = stars(), k = s.dataset.star; if (st[k]) delete st[k]; else st[k] = true; store.save(); draw(); return; }
    const it = e.target.closest('[data-key]'); if (it) openEntry(it.dataset.key);
  });
  $('#sheetBody').addEventListener('click', e => {
    if (sec.hidden) return;
    const d = e.target.closest('[data-drill]'); if (d){ lastKeys = [d.dataset.drill]; startDrill(pool(lastKeys)); return; }
    const p = e.target.closest('[data-pick]'); if (p){ pick(p.dataset.pick); return; }
    if (e.target.closest('.dr-next')){ nextQ(); return; }
    if (e.target.closest('[data-again]')) startDrill(pool(lastKeys));
  });
  drill.addEventListener('click', () => { const st = stars(); lastKeys = entries.filter(e => st[e.key] && e.open).map(e => e.key); startDrill(pool(lastKeys)); });
  q.addEventListener('input', draw);
  starBtn.addEventListener('click', () => { onlyStars = !onlyStars; starBtn.setAttribute('aria-pressed', onlyStars); starBtn.classList.toggle('on', onlyStars); draw(); });
  $('#notesBack').addEventListener('click', () => app.go('#/'));
  $('#notesScript').addEventListener('click', () => app.go('#/script/' + deck.id));
  $('#notesPrint').addEventListener('click', printSheet);

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
    const qs = pick.flatMap(e => e.items.slice(2, 4)).map((it, n) => {
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
    if (d.file){ if (d.id !== deck.id) app.go('#/notes/' + d.id); return; }
    const l = (LOCKED[d.id] || [{en: 'Not yet.', ko: '아직이다.'}])[0];
    toast(`<span class="q" lang="en">“${esc(l.en)}”</span><span class="k">${esc(l.ko)} — ${esc(d.ko)}</span>`, 3600, true);
  });
  document.addEventListener('keydown', e => {
    if (sec.hidden) return;
    if (e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else app.go('#/'); }
    else if (isSheetOpen() && ['1', '2', '3', '4'].includes(e.key) && !e.target.closest('input')){ const b = $('#sheetBody').querySelectorAll('.dr-opts button')[+e.key - 1]; if (b) pick(b.dataset.pick); }
  });

  async function show({id}){
    deck = byId(id) && byId(id).file ? byId(id) : byId('snape');
    $('#notesWho').innerHTML = DECKS.map(d => `<button type="button" data-who="${d.id}" class="${d.id === deck.id ? 'on' : ''}${d.file ? '' : ' shut'}" aria-pressed="${d.id === deck.id}">${esc(d.ko.replace(/ 교수$/, ''))}${d.file ? '' : '<span class="sr"> (잠김)</span>'}</button>`).join('');
    const ph = $('#notesPhoto');
    ph.style.backgroundImage = `url("${new URL(`assets/rooms/${deck.id}-portrait.webp`, location.href).href}")`;
    let cards, examples;
    try { [cards, examples] = await Promise.all([app.loadDeck(deck.id), app.loadExamples(deck.id)]); }
    catch (e){ toast('대본을 불러오지 못했습니다.'); app.go('#/', true); return; }
    build(cards, examples);
    draw();
    $('#notesScroll').scrollTop = 0;
  }
  return {show};
}
