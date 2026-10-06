/* A spell lesson in the professor's office (#/spell/<id>), reached from their letter or the spellbook (2026-10-06
   user decision, docs/plan-spells.md). About three minutes: the professor introduces the spell and its Latin root; the
   family of formal English words that grew from it, with the professor's own lines where those words occur (lines not
   yet learnt stay locked); five questions (the missed ones come round once more at the end); then the spell is cast by
   tracing its wand movement (trace.js) and its effect plays (a black-ground clip keyed to transparency, keyvid.js).
   Moody's two Unforgivable Curses are not cast: those lessons end in resisting them instead.
   A spell already learnt opens as its page in the spellbook: read again, cast again, or review it
   (#/spell/<id>/review — three first-letter questions, spells.js keeps the schedule). */
import * as spells from './spells.js';
import * as bond from './bond.js';
import * as store from './store.js';
import * as speech from './speech.js';
import * as wand from './wand.js';
import {byId} from './decks.js';
import {keyed} from './keyvid.js';   // only for Moody's resisting scenes now
import {cast} from './trace.js';
import {$, esc, toast, fitPaper, reduced, wait} from './ui.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const f = s => esc(bond.fill(s));
const md = s => esc(s).replace(/\*([^*]+)\*/g, '<i>$1</i>');
/* the effect clip of each spell (assets/spells/; Prior Incantato is the smoke the learner already knows) */
const CLIP = {expelliarmus: 'expelliarmus', protego: 'protego', 'finite-incantatem': 'finite', reparo: 'reparo', locomotor: 'locomotor', duro: 'duro',
  riddikulus: 'riddikulus', 'lumos-maxima': 'lumos', 'expecto-patronum': 'patronum', stupefy: 'stupefy', imperio: 'imperio', crucio: 'crucio',
  aguamenti: 'aguamenti', 'arresto-momentum': 'arresto', confundo: 'confundo', 'specialis-revelio': 'revelio', descendo: 'descendo',
  silencio: 'silencio', impedimenta: 'impedimenta', 'petrificus-totalus': 'petrificus'};
const FX = {...Object.fromEntries(Object.entries(CLIP).map(([k, v]) => [k, `assets/spells/${v}.mp4`])), 'prior-incantato': 'assets/prior/smoke.mp4'};
/* the answers in a fixed shuffled order per question, so the right one is not always first */
const order = (key, n) => { let h = 2166136261; for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--){ h = Math.imul(h ^ i, 16777619); const j = (h >>> 0) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const FILM = n => `${n}편`;
/* Moody's resisting lessons: what the curse whispers (Imperio), the easy answer it wants (glowing, inviting) and the
   answer that resists it — different each time, and not always in the same place, so it has to be read */
const WHISPER = [
  {en: 'Put your wand down.', ko: '지팡이를 내려놓아라.', give: {en: "Yes. I'll put it down.", ko: '네, 내려놓을게요.'}, hold: {en: "No. It's my wand.", ko: '싫어. 내 지팡이야.'}, first: 'give'},
  {en: 'Climb onto the desk.', ko: '책상 위로 올라가라.', give: {en: 'Of course. Onto the desk.', ko: '그래, 책상 위로.'}, hold: {en: 'Why should I?', ko: '내가 왜?'}, first: 'hold'},
  {en: 'Tell no one about tonight.', ko: '오늘 밤 일은 아무에게도 말하지 마라.', give: {en: "I won't tell a soul.", ko: '아무한테도 말 안 할게.'}, hold: {en: "I'll decide that for myself.", ko: '그건 내가 정해.'}, first: 'give'}
];

export function initSpell(app){
  const sec = $('#spell'), body = $('#spBody'), card = $('#spCard'), fxl = $('#spFx');
  let sp = null, mode = 'lesson', step = '', qs = [], qi = 0, missed = [], retry = false, heard = '', rec = null, right = 0;

  const who = () => { const d = byId(sp.prof); return `<div class="ol-who"><span lang="en">${esc(d.who)}</span>${speech.gbVoices().length ? '<button type="button" class="ol-hear" data-hear aria-label="영국 영어로 듣기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/></svg></button>' : ''}</div>`; };
  const say = (line, cls = '') => `<div class="ol-say ${cls}"><p class="en" lang="en">${f(line.en)}</p><p class="ko">${f(line.ko)}</p></div>`;
  const btn = (act, en, ko, cls = '') => `<button type="button" class="ol-go ${cls}" data-act="${act}"><span lang="en">${en}</span><small>${ko}</small></button>`;
  const head = () => { const d = byId(sp.prof);
    return `<header class="sp-head"><i class="seal s-${sp.prof}"></i><div><small>${esc(d.ko)} · 주문 ${sp.n} / 3</small><h2 lang="en">${esc(sp.name)}</h2><p>${esc(sp.ko)}</p></div></header>`; };
  function put(html, line){
    heard = line || '';
    body.innerHTML = html;
    body.classList.remove('in'); void body.offsetWidth; body.classList.add('in');
    $('#spScroll').scrollTop = 0;
  }
  const boxes = () => { const n = qs.length; return `<div class="ol-boxes" aria-label="문제 ${Math.min(qi + 1, n)} / ${n}">${qs.map((_, i) => `<i class="${i < qi ? 'on' : ''}"></i>`).join('')}</div>`; };

  /* ---------- the parts of a lesson */
  function intro(){
    step = 'intro';
    put(head() + who() + say(sp.intro) +
      `<div class="sp-root"><b>뿌리</b><p>${md(sp.root)}</p>${(sp.notes || []).map(n => `<p class="sp-note">${md(n)}</p>`).join('')}</div>` +
      btn('words', 'The words it gave us', '뿌리에서 나온 단어'), sp.intro.en);
  }
  function lineHtml(id){
    const deck = id.replace(/-.*/, ''), d = byId(deck), c = (app.data[deck] || []).find(x => x.id === id);
    if (!c) return '';
    const learnt = !!(store.deck(deck).cards || {})[id];
    const tags = (c.source === 'fan_script' ? '<em>팬 대본</em>' : '') + (c.impostor ? '<em>무디 얼굴을 한 크라우치 2세</em>' : '');
    return learnt
      ? `<li><button type="button" class="sp-line" data-say="${esc(c.line)}"><span lang="en">${esc(c.line)}</span><small>${esc(c.ko)}</small><b>${esc(d.ko.replace(/ 교수$/, ''))} · ${FILM(c.film)}${tags}</b></button></li>`
      : `<li class="lock"><span>아직 배우지 않은 대사</span><b>${esc(d.ko.replace(/ 교수$/, ''))} · ${FILM(c.film)}${tags}</b></li>`;
  }
  function words(next = 'practise'){
    step = 'words';
    const lines = sp.lines.map(lineHtml).filter(Boolean).join('');
    put(head() + `<ul class="sp-words">${sp.words.map(w => `<li><p class="w"><b lang="en">${esc(w.w)}</b>${w.pos ? ` <i>${esc(w.pos)}</i>` : ''}<span>${md(w.ko)}</span></p>` +
        `<button type="button" class="sp-ex" data-say="${esc(w.en)}"><span lang="en">${esc(w.en)}</span><small>${esc(w.eko)}</small></button></li>`).join('')}</ul>` +
      `<div class="sp-lines"><h3>교수 대사에서</h3>${lines ? `<ul>${lines}</ul>` : `<p class="sp-none">${md(sp.lineNote || '이 단어들이 나오는 대사는 아직 없습니다.')}</p>`}</div>` +
      (next === 'practise' ? btn('practise', 'Let us practise', '연습 5문제') : ''));
  }
  /* ---------- questions (lesson: the spell's five; review: three first-letter ones) */
  function startQs(list){ qs = list.slice(); qi = 0; missed = []; retry = false; right = 0; ask(); }
  function ask(){
    step = 'q';
    const q = qs[qi], kind = {form: '알맞은 꼴', mean: '뜻 고르기', write: '첫 글자 보고 쓰기'}[q.t];
    let html = boxes() + `<p class="sp-kind">${kind}${retry ? ' · 한 번 더' : ''}</p>`;
    if (q.t === 'write'){
      const m = q.s.match(/([A-Za-z])(_+)/);
      html += `<p class="sp-qko">${esc(q.ko)}</p><p class="sp-qs" lang="en">${esc(q.s.slice(0, m.index))}<span class="sp-blank">${esc(m[1])}${'_'.repeat(m[2].length)}</span>${esc(q.s.slice(m.index + m[0].length))}</p>` +
        `<form class="sp-write" data-write><input id="spIn" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="빈칸에 들어갈 단어" placeholder="${esc(m[1])}…"><button type="submit" class="ol-go"><span lang="en">Check</span><small>확인</small></button></form>`;
    } else {
      const [q1, q2 = ''] = q.s.split('____');
      html += `<p class="sp-qs" lang="en">${md(q1)}${q.s.includes('____') ? '<u class="gap"></u>' : ''}${md(q2)}</p>` +
        `<div class="tea-opts sp-opts">${order((sp ? sp.id : '') + q.s, q.opts.length).map(i => `<button type="button" data-opt="${i}"${q.t === 'form' ? ' lang="en"' : ''}><span>${esc(q.opts[i])}</span></button>`).join('')}</div>`;
    }
    put(html);
    const inp = $('#spIn'); if (inp) setTimeout(() => inp.focus({preventScroll: true}), 60);
  }
  function judge(ok, shown){
    const q = qs[qi];
    if (ok) right++; else if (!retry) missed.push(q);
    body.querySelectorAll('[data-opt], #spIn, .sp-write button').forEach(b => { b.disabled = true; });
    const fb = document.createElement('div');
    fb.className = 'sp-fb ' + (ok ? 'ok' : 'no');
    fb.innerHTML = (ok ? '<b>맞았습니다</b>' : `<b>정답</b><span lang="en">${esc(shown)}</span>`) +
      (!ok && mode === 'lesson' && !retry ? '<small>수업 끝에 한 번 더 나옵니다</small>' : '') + btn('next', 'Next', '다음');
    body.appendChild(fb);
    fb.scrollIntoView({block: 'nearest', behavior: reduced() ? 'auto' : 'smooth'});
  }
  function next(){
    qi++;
    if (qi < qs.length){ ask(); return; }
    if (mode === 'lesson' && missed.length && !retry){ qs = missed; missed = []; qi = 0; retry = true; ask(); return; }
    if (mode === 'review') return reviewDone();
    castStep();
  }
  /* ---------- casting */
  function castStep(){
    step = 'cast';
    put(head() + who() + (sp.resist
      ? `<p class="sp-cast">이 저주는 거는 법을 배우지 않습니다. 걸렸을 때 버티는 법을 익힙니다.</p>` + btn('resist', 'Ready', '버텨 보기')
      : `<p class="sp-cast">지팡이를 들고, 화면의 금빛 점선을 처음부터 끝까지 따라 그리세요.</p>` + btn('cast', 'Raise your wand', '지팡이 들기')));
  }
  async function doCast(){
    if (step !== 'cast' && step !== 'again') return; const was = step; step = 'casting';
    sec.classList.add('casting');
    await cast(sec, {path: sp.path, label: `<span lang="en">${esc(sp.name)}</span>`});
    await effect();
    sec.classList.remove('casting');
    if (was === 'again'){ page(); return; }
    finish();
  }
  /* the spell's clip, keyed onto a canvas in the middle of the screen; a spray of sparks where there is no clip yet */
  /* the spell's clip on a black stage (2026-10-06 user decision: keyed onto the room, objects looked see-through): the
     room fades to black, the clip plays as it is, full quality, then the room comes back. Sparks where a clip will not play. */
  function effect(){
    return new Promise(res => {
      const src = FX[sp.id], tall = /prior/.test(src || '');
      fxl.classList.add('dark');
      let done = false;
      const end = el => { if (done) return; done = true; el.classList.add('out'); fxl.classList.remove('dark');
        setTimeout(() => { el.remove(); res(); }, reduced() ? 0 : 600); };
      speech.speak(sp.name, store.get().settings.voice, null, .9);
      if (!src || reduced()){
        const c = document.createElement('canvas'); c.className = 'sp-fx'; fxl.appendChild(c);
        sparks(c); setTimeout(() => end(c), reduced() ? 300 : 1600); return;
      }
      const v = document.createElement('video'); v.className = 'sp-fx' + (tall ? ' tall' : '');
      v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = src;
      fxl.appendChild(v);
      const sparkInstead = () => { if (done) return; v.remove(); const c = document.createElement('canvas'); c.className = 'sp-fx'; fxl.appendChild(c); sparks(c); setTimeout(() => end(c), 1600); };
      v.addEventListener('ended', () => end(v), {once: true});
      v.addEventListener('error', sparkInstead, {once: true});
      setTimeout(() => v.play().catch(sparkInstead), reduced() ? 0 : 350);   // after the room has gone dark
      setTimeout(() => end(v), tall ? 11500 : 9000);
    });
  }
  function sparks(c){
    if (reduced()) return;
    const w = wand.get(), col = w ? wand.CORES[w.core].spark : '#F2B24C', x = c.getContext('2d'); c.width = c.height = 480;
    const P = Array.from({length: 70}, () => { const a = Math.random() * 6.28, v = 60 + Math.random() * 220; return {x: 240, y: 240, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: .6 + Math.random() * .9}; });
    let last = performance.now(), age = 0;
    const tick = now => { const dt = (now - last) / 1000; last = now; age += dt; x.clearRect(0, 0, 480, 480); x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 10;
      P.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; const k = 1 - age / p.l; if (k > 0){ x.globalAlpha = k; x.beginPath(); x.arc(p.x, p.y, 2.2, 0, 7); x.fill(); } });
      if (age < 1.6 && c.isConnected) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  /* Moody: the Imperius whispers three commands; each is broken by refusing it (the inviting answer starts it over) */
  function resist(){
    if (step !== 'cast' && step !== 'again') return; const was = step; step = 'resisting';
    return new Promise(res => {
      sec.classList.add('casting');
      const L = document.createElement('div'); L.className = 'rs-layer ' + sp.id;
      /* the curse itself: a keyed clip looping behind (mist for Imperio, crackling red for Crucio), over a tinted film */
      L.innerHTML = `<div class="${sp.id === 'imperio' ? 'rs-fog' : 'rs-red'}"></div><canvas class="rs-vid"></canvas><div class="rs-box"></div>`;
      fxl.appendChild(L);
      const vid = keyed(L.querySelector('.rs-vid'), {src: FX[sp.id], loop: true, reduced: reduced()});
      const box = L.querySelector('.rs-box');
      const close = async () => { L.classList.add('clear'); await wait(reduced() ? 0 : 1100); vid.stop(); L.remove(); sec.classList.remove('casting'); res(); if (was === 'again') page(); else finish(); };
      if (sp.id === 'imperio'){
        let k = 0;
        const give = w => `<button type="button" class="rs-do" data-r="do"><span lang="en">${esc(w.give.en)}</span><small>${esc(w.give.ko)}</small></button>`;
        const hold = w => `<button type="button" class="rs-why" data-r="why"><span lang="en">${esc(w.hold.en)}</span><small>${esc(w.hold.ko)}</small></button>`;
        const draw = () => {
          L.style.setProperty('--fog', String(1 - k / 3 * .6));
          const w = WHISPER[k];
          box.innerHTML = `<p class="rs-en" lang="en">${esc(w.en)}</p><p class="rs-ko">${esc(w.ko)}</p>` +
            (w.first === 'give' ? give(w) + hold(w) : hold(w) + give(w));
        };
        draw();
        L.addEventListener('click', e => {
          const b = e.target.closest('[data-r]'); if (!b) return;
          if (b.dataset.r === 'do'){ k = 0; toast('<span class="q" lang="en">Again.</span><span class="k">다시.</span>', 1800, true); draw(); return; }
          k++; if (k >= 3) close(); else draw();
        });
      } else {
        /* Crucio: hold your ground for three seconds while it presses in; it ends */
        box.innerHTML = `<p class="rs-ko">손을 떼지 말고 버티세요</p>` +
          `<button type="button" class="rs-hold" data-hold><i></i><span lang="en">Hold your ground</span><small>버티기</small></button>`;
        const b = L.querySelector('[data-hold]'); let t = null;
        const down = e => { e.preventDefault(); b.classList.add('on'); L.classList.add('press'); t = setTimeout(async () => {
          b.disabled = true; box.innerHTML = `<p class="rs-en" lang="en">It ends. Remember that.</p><p class="rs-ko">끝난다. 그걸 기억해.</p>`;
          await wait(reduced() ? 300 : 1800); close(); }, reduced() ? 300 : 3000); };
        const up = () => { if (b.disabled) return; clearTimeout(t); b.classList.remove('on'); L.classList.remove('press'); };
        b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
      }
    });
  }
  function finish(){
    const first = !spells.isLearnt(sp.id);
    spells.learn(sp.id);
    step = 'done';
    put(head() + `<p class="sp-done">${first ? '주문서에 적었습니다.' : '주문서에 이미 있는 주문입니다.'}</p>` +
      (SR && !sp.resist ? `<button type="button" class="ol-mic sp-mic" data-act="shout"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg><span>주문 외쳐 보기 (선택)</span></button><p class="ol-heard" id="spHeard" hidden></p>` : '') +
      btn('book', 'To the spellbook', '주문서 보기') + btn('room', 'Back to my room', '내 방으로', 'quiet'));
    app.refresh();
  }
  function shout(){
    if (!SR) return; if (rec){ rec.stop(); return; }
    const h = $('#spHeard'), m = $('.sp-mic', body); let text = '';
    h.hidden = false; h.textContent = `듣고 있습니다… “${sp.name}”`; m.classList.add('on');
    rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = false;
    rec.onresult = e => { text = [...e.results].map(x => x[0].transcript).join(' ').trim(); };
    rec.onerror = () => {};
    rec.onend = () => { rec = null; m.classList.remove('on'); h.textContent = text ? `“${text}”` : '들리지 않았습니다.'; };
    try { rec.start(); } catch (e){ rec = null; m.classList.remove('on'); }
  }
  /* ---------- a learnt spell: its page in the spellbook */
  function page(){
    mode = 'book'; step = 'page';
    const due = spells.reviewDue(sp.id), l = (store.get().spells || {}).learnt[sp.id];
    words('');
    body.querySelector('.sp-head').insertAdjacentHTML('afterend', who() + say(sp.intro) + `<div class="sp-root"><b>뿌리</b><p>${md(sp.root)}</p>${(sp.notes || []).map(n => `<p class="sp-note">${md(n)}</p>`).join('')}</div>`);
    body.insertAdjacentHTML('beforeend', (due ? `<p class="sp-due">복습할 때가 되었습니다</p>` : l ? `<p class="sp-next">다음 복습 · ${l.due.slice(5).replace('-', '월 ')}일</p>` : '') +
      btn('review', 'Review', due ? '복습하기 · 첫 글자 3문제' : '미리 복습하기', due ? '' : 'quiet') +
      btn('again', sp.resist ? 'Resist it again' : 'Cast it again', sp.resist ? '다시 버텨 보기' : '다시 시전하기', 'quiet') +
      btn('relearn', 'Take the lesson again', '수업 다시 듣기', 'quiet'));
    heard = sp.intro.en;
  }
  function reviewStart(){ mode = 'review'; startQs(spells.reviewQs(sp)); }
  function reviewDone(){
    const ok = right === qs.length;
    spells.reviewed(sp.id, ok);
    const l = store.get().spells.learnt[sp.id];
    put(head() + `<p class="sp-done">${right} / ${qs.length}${ok ? ' · 잘 기억하고 있습니다' : ' · 사흘 뒤 다시 봅니다'}</p><p class="sp-next">다음 복습 · ${l.due.slice(5).replace('-', '월 ')}일</p>` +
      btn('book', 'To the spellbook', '주문서 보기') + btn('page', 'This page', '이 주문 쪽으로', 'quiet'));
    app.refresh();
  }

  /* ---------- events */
  body.addEventListener('click', e => {
    if (e.target.closest('[data-hear]')){ if (heard) speech.speak(bond.fill(heard), store.get().settings.voice, null, .9); return; }
    const s = e.target.closest('[data-say]'); if (s){ speech.speak(s.dataset.say, store.get().settings.voice, null, .9); return; }
    const o = e.target.closest('[data-opt]'); if (o && step === 'q' && !o.disabled){ const q = qs[qi], i = +o.dataset.opt; o.classList.add(i === q.a ? 'right' : 'wrong'); if (i !== q.a) body.querySelector(`[data-opt="${q.a}"]`).classList.add('right'); judge(i === q.a, q.opts[q.a]); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    ({words: () => words(), practise: () => { mode = 'lesson'; startQs(sp.qs); }, next, cast: doCast, resist,
      again: () => { step = 'again'; sp.resist ? resist() : doCast(); }, shout, review: reviewStart, page, relearn: () => { mode = 'lesson'; intro(); },
      book: () => app.go('#/me/spells'), room: () => app.go('#/me')})[b.dataset.act]?.();
  });
  body.addEventListener('submit', e => {
    if (!e.target.closest('[data-write]') || step !== 'q') return; e.preventDefault();
    const inp = $('#spIn'), q = qs[qi]; if (!inp.value.trim() || inp.disabled) return;
    const ok = spells.same(inp.value, q.a);
    inp.classList.add(ok ? 'right' : 'wrong');
    judge(ok, q.a);
  });
  $('#spBack').addEventListener('click', () => { speech.stop(); history.length > 1 ? history.back() : app.go('#/me/spells'); });

  async function show({id, sub}){
    await spells.load();
    sp = spells.get(id);
    if (!sp){ app.go('#/me/spells', true); return; }
    await bond.load(sp.prof);
    if (!app.data[sp.prof]) await app.loadDeck(sp.prof).catch(() => {});
    fitPaper(card);
    sec.classList.remove('casting'); fxl.innerHTML = '';
    sec.style.setProperty('--p', `url("${new URL(`assets/rooms/${sp.prof}-portrait.webp`, location.href).href}")`);
    sec.style.setProperty('--w', `url("${new URL(`assets/rooms/${sp.prof}-wide.webp`, location.href).href}")`);
    $('#spTtl').textContent = sp.name;
    if (!wand.get()){ app.go('#/me/wand', true); toast('지팡이가 있어야 주문을 배울 수 있습니다.'); return; }
    if (sub === 'review' && spells.isLearnt(sp.id)){ reviewStart(); return; }
    if (spells.isLearnt(sp.id)) page();
    else { mode = 'lesson'; intro(); }
  }
  return {show, hide: () => { speech.stop(); if (rec){ try { rec.abort(); } catch (e){} rec = null; } fxl.innerHTML = ''; $$tr(sec); }};
}
const $$tr = sec => sec.querySelectorAll('.tr-layer').forEach(l => l.remove());
