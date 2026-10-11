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
const FX = {...Object.fromEntries(Object.entries(CLIP).map(([k, v]) => [k, `assets/spells/${v}.mp4`])), 'prior-incantato': 'assets/prior/smoke.mp4', occlumency: 'assets/spells/occlumency.mp4'};
const hashOf = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
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
    return `<header class="sp-head"><i class="seal s-${sp.prof}"></i><div><small>${esc(d.ko)} · ${d.place === 'corridor' ? `주문 ${sp.n} / 3` : d.where}</small><h2 lang="en">${esc(sp.name)}</h2><p>${esc(sp.ko)}</p></div></header>`; };
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
      `<div class="sp-lines"><h3>${sp.prof === 'bellatrix' ? '그녀가 한 말에서' : '교수 대사에서'}</h3>${lines ? `<ul>${lines}</ul>` : `<p class="sp-none">${md(sp.lineNote || '이 단어들이 나오는 대사는 아직 없습니다.')}</p>`}</div>` +
      (next === 'practise' ? btn('practise', 'Let us practise', `연습 ${sp.qs.length}문제`) : ''));
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
    put(head() + who() + (sp.id === 'occlumency'
      ? `<p class="sp-cast">지팡이도 주문도 없습니다. 그녀가 들여다보는 동안, 받아 적은 그녀의 말을 한 낱말씩 이어 가며 문을 닫습니다.</p>` + btn('resist', 'Ready', '벽을 세운다')
      : sp.resist
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
    if (sp.id === 'occlumency') return occlude(was);
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
  /* Bellatrix's lesson: Occlumency. No wand and no word. A door stands ajar in the dark with her looking in through it,
     and the learner holds her off with "something dull in front": one of her own lines they have learnt, a word at a
     time. Each right word swings the door a little further shut (the film is scrubbed back and forth), a slip or a
     pause lets it open again. Things she says drift across the light meanwhile. Shut: the bolt goes home and she
     speaks. Open: she reads out what she saw. Without the film (offline, motion turned down) four stills stand in. */
  function occlude(was){
    return new Promise(res => {
      const o = (bond.loaded('bellatrix') || {}).occlumency || {probe: [], held: [], broke: []};
      const STEPS = 10, START = 3, HOLD = 3.7, lv = store.get().settings.level, LIMIT = lv === 'low' ? 8000 : lv === 'high' ? 4200 : 5600;
      sec.classList.add('casting'); fxl.classList.add('dark');
      const L = document.createElement('div'); L.className = 'rs-layer occlumency';
      L.innerHTML = '<div class="oc-stage"><img class="oc-still" alt="" src="assets/spells/occlu-0.webp"><video class="oc-vid" muted playsinline preload="auto"></video><p class="oc-probe" lang="en"></p></div><div class="oc-box"></div>';
      fxl.appendChild(L);
      const v = L.querySelector('.oc-vid'), still = L.querySelector('.oc-still'), box = L.querySelector('.oc-box'), probe = L.querySelector('.oc-probe');
      let film = !reduced(), raf = 0, timer = 0, at = START, n = 0, alive = true;
      const noFilm = () => { film = false; L.classList.remove('film'); };
      if (film){ v.addEventListener('error', noFilm, {once: true}); v.addEventListener('loadeddata', () => { try { v.currentTime = HOLD * at / STEPS; } catch (e){} if (film) L.classList.add('film'); }, {once: true}); v.src = FX.occlumency; }
      const door = (ms = 620) => {
        const k = Math.max(0, Math.min(1, at / STEPS));
        still.src = `assets/spells/occlu-${k >= 1 ? 3 : k > .62 ? 2 : k > .28 ? 1 : 0}.webp`;
        if (!film || !v.duration) return;
        cancelAnimationFrame(raf); const from = v.currentTime, to = HOLD * k, t0 = performance.now();
        const step = now => { const q = ms ? Math.min(1, (now - t0) / ms) : 1, e = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2; try { v.currentTime = from + (to - from) * e; } catch (e2){} if (q < 1 && alive) raf = requestAnimationFrame(step); };
        raf = requestAnimationFrame(step);
      };
      /* her lines the learner knows, at an easy length (any of her lines if too few are learnt yet) */
      const wordsOf = c => c.line.replace(/--|—/g, ' ').split(/\s+/).filter(w => /[A-Za-z]/.test(w));
      const bare = w => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
      /* a wrong word must not give itself away by a capital it only wore at the start of its own sentence */
      const starts = (ws, i) => i === 0 || /[.!?]["')\]]*$/.test(ws[i - 1]);
      const cap = w => /^[A-Z]/.test(w), I = w => /^I('|$)/.test(w);
      const proper = new Set(); (app.data.bellatrix || []).forEach(c => { const ws = wordsOf(c); ws.forEach((w, i) => { const b = bare(w); if (cap(b) && !starts(ws, i)) proper.add(b); }); });
      /* wrong words are of the answer's own kind (2026-10-12, harder): a small word against small words of its set, any other
         word against words from her lines with the same ending and about the same length — grammar alone no longer answers it */
      const SETS = ['to for of at in on with from by into', 'the a an this that these those', 'my your his her our their its', 'is was are were be been am',
        'will would shall should can could must may might', 'I you he she we they it', 'me him us them', 'not never now here there then ever',
        'and but or so if when while because', 'have has had do does did', 'what where who why how which'].map(g => g.split(' '));
      const small = new Set(SETS.flat().map(w => w.toLowerCase())), ending = w => (w.toLowerCase().match(/(ing|ed|ly|s)$/) || [''])[0];
      const plainOf = ws => ws.map((w, i) => { const b = bare(w); return cap(b) && starts(ws, i) && !proper.has(b) && !I(b) ? b.toLowerCase() : b; });
      const fit = (app.data.bellatrix || []).filter(c => c.card !== false && wordsOf(c).length >= 5 && wordsOf(c).length <= 15), ds = store.deck('bellatrix').cards || {};
      let pool = fit.filter(c => ds[c.id]); if (pool.length < 4) pool = fit;
      /* only words she uses more than once: her one-off baby talk ("twoo", "bitty") would look like a misprint among the choices */
      const seen = {}; (app.data.bellatrix || []).forEach(c => plainOf(wordsOf(c)).forEach(w => { const k = w.toLowerCase(); seen[k] = (seen[k] || 0) + 1; }));
      const vocab = [...new Set(fit.flatMap(c => plainOf(wordsOf(c))).filter(w => w.length > 1 && !small.has(w.toLowerCase()) && seen[w.toLowerCase()] > 1))];
      const seed = sp.id + '|' + Date.now();
      pool = pool.map((c, i) => [hashOf(seed + i), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      let li = 0, wi = 2, ws = pool.length ? wordsOf(pool[0]) : [];
      const leave = async after => { alive = false; clearTimeout(timer); cancelAnimationFrame(raf); L.classList.add('clear'); await wait(reduced() ? 0 : 700); L.remove(); fxl.classList.remove('dark'); sec.classList.remove('casting'); res(); after(); };
      const line = l => `<p class="rs-en" lang="en">${f(l.en)}</p><p class="rs-ko">${f(l.ko)}</p>`;
      function whisper(){
        if (!o.probe.length) return;
        const l = o.probe[Math.min(o.probe.length - 1, Math.floor(at / STEPS * 14) + n % 6)];
        probe.textContent = bond.fill(l.en); probe.classList.remove('on'); void probe.offsetWidth; probe.classList.add('on');
      }
      function ask(){
        if (!alive) return;
        if (wi >= ws.length){ li = (li + 1) % pool.length; ws = wordsOf(pool[li]); wi = 2; }
        const ans = bare(ws[wi]);
        /* the three wear the same case: all capitals when the answer has one, and no names beside a small-letter answer */
        const up = cap(ans);
        const low = ans.toLowerCase(), set = SETS.find(g => g.some(w => w.toLowerCase() === low)), name = proper.has(ans);
        const near = w => w.toLowerCase() !== low && proper.has(w) === name;
        let others = set ? set.filter(w => w.toLowerCase() !== low) : vocab.filter(w => near(w) && ending(w) === ending(ans) && Math.abs(w.length - ans.length) <= 2);
        if (others.length < 3) others = [...new Set([...others, ...vocab.filter(near)])];
        if (others.length < 3) others = [...new Set([...others, ...vocab.filter(w => w.toLowerCase() !== low)])];
        const wrong = others.map((w, i) => [hashOf(seed + n + '|' + i), w]).sort((a, b) => a[0] - b[0]).slice(0, 3).map(x => up ? x[1][0].toUpperCase() + x[1].slice(1) : x[1]);
        const opts = [ans, ...wrong].map((w, i) => [hashOf(seed + 'o' + n + i), w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
        box.innerHTML = (lv === 'high' ? '' : `<p class="oc-ko">${esc(pool[li].ko)}</p>`) + `<p class="oc-line" lang="en">${esc(ws.slice(0, wi).join(' '))} <u></u></p><div class="oc-opts">${opts.map(w => `<button type="button" data-oc="${esc(w)}" lang="en">${esc(w)}</button>`).join('')}</div><i class="oc-time" style="animation-duration:${LIMIT}ms"></i>`;
        box.dataset.ans = ans;
        clearTimeout(timer); timer = setTimeout(() => answer(null), LIMIT);
      }
      function answer(w){
        if (!alive || !box.dataset.ans) return;
        clearTimeout(timer); const ans = box.dataset.ans; box.dataset.ans = ''; n++;
        const ok = w !== null && w.toLowerCase() === ans.toLowerCase();
        box.querySelectorAll('[data-oc]').forEach(b => { b.disabled = true; if (b.dataset.oc === ans) b.classList.add('right'); else if (b.dataset.oc === w) b.classList.add('wrong'); });
        const bar = box.querySelector('.oc-time'); if (bar) bar.style.animationPlayState = 'paused';
        if (ok){ at++; wi++; } else at -= 2;
        door();
        if (at >= STEPS){ setTimeout(shut, 500); return; }
        if (at < 0){ setTimeout(open, 500); return; }
        if (ok && n % 2 === 0) whisper();
        setTimeout(ask, ok ? 380 : 950);
      }
      async function shut(){
        if (!alive) return; box.innerHTML = ''; probe.classList.remove('on');
        if (film && v.duration){ cancelAnimationFrame(raf); try { await v.play(); await new Promise(r => { v.onended = r; setTimeout(r, 2600); }); } catch (e){} } else await wait(reduced() ? 200 : 700);
        if (!alive) return;
        const l = o.held.length ? o.held[hashOf(seed + 'h') % o.held.length] : {en: 'Shut.', ko: '닫혔다.'};
        box.innerHTML = line(l) + '<button type="button" class="rs-why" data-ocdone><span lang="en">The door holds</span><small>문이 버텼다</small></button>';
      }
      function open(){
        if (!alive) return; at = 0; door(480); probe.classList.remove('on');
        const l = o.broke.length ? o.broke[hashOf(seed + 'b' + n) % o.broke.length] : {en: 'Open.', ko: '열렸다.'};
        box.innerHTML = line(l) + '<button type="button" class="rs-why" data-ocagain><span lang="en">Build it again</span><small>다시 쌓는다</small></button>' +
          '<button type="button" class="rs-why quiet" data-ocstop><span lang="en">Enough for today</span><small>오늘은 그만</small></button>';
      }
      L.addEventListener('click', e => {
        const b = e.target.closest('[data-oc]'); if (b && !b.disabled){ answer(b.dataset.oc); return; }
        if (e.target.closest('[data-ocdone]')){ leave(() => { if (was === 'again') page(); else finish(); }); return; }
        if (e.target.closest('[data-ocagain]')){ at = START; n = 0; wi = 2; box.innerHTML = ''; door(700); setTimeout(ask, 800); return; }
        if (e.target.closest('[data-ocstop]')) leave(() => { if (was === 'again') page(); else castStep(); });
      });
      if (!pool.length){ leave(() => finish()); return; }
      door(0); setTimeout(ask, reduced() ? 200 : 1200);
    });
  }
  function finish(){
    const first = !spells.isLearnt(sp.id);
    spells.learn(sp.id);
    step = 'done';
    put(head() + `<p class="sp-done">${first ? '주문서에 적었습니다.' : '주문서에 이미 있는 주문입니다.'}</p>` +
      (SR && !sp.resist ? `<button type="button" class="ol-mic sp-mic" data-act="shout"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg><span>주문 외쳐 보기 (선택)</span></button><p class="ol-heard" id="spHeard" hidden></p>` : '') +
      btn('book', 'To the spellbook', '주문서 보기') + (sp.prof === 'bellatrix' ? btn('room', 'Back to the drawing room', '응접실로', 'quiet') : btn('room', 'Back to my room', '내 방으로', 'quiet')));
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
    const back = due && ((bond.loaded(sp.prof) || {}).occlumency || {}).review, call = back && sp.id === 'occlumency' ? back[hashOf(sp.id + (l ? l.due : '')) % back.length] : null;
    body.insertAdjacentHTML('beforeend', (call ? say(call) : '') + (due ? `<p class="sp-due">복습할 때가 되었습니다</p>` : l ? `<p class="sp-next">다음 복습 · ${l.due.slice(5).replace('-', '월 ')}일</p>` : '') +
      btn('review', 'Review', due ? '복습하기 · 첫 글자 3문제' : '미리 복습하기', due ? '' : 'quiet') +
      btn('again', sp.id === 'occlumency' ? 'Shut the door again' : sp.resist ? 'Resist it again' : 'Cast it again', sp.id === 'occlumency' ? '다시 벽 세우기' : sp.resist ? '다시 버텨 보기' : '다시 시전하기', 'quiet') +
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
      book: () => app.go('#/me/spells'), room: () => app.go(sp.prof === 'bellatrix' ? '#/manor/drawing' : '#/me')})[b.dataset.act]?.();
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
    sec.classList.remove('casting'); fxl.innerHTML = ''; fxl.classList.remove('dark');
    sec.style.setProperty('--p', `url("${new URL(`assets/rooms/${sp.prof}-portrait.webp`, location.href).href}")`);
    sec.style.setProperty('--w', `url("${new URL(`assets/rooms/${sp.prof}-wide.webp`, location.href).href}")`);
    $('#spTtl').textContent = sp.name;
    if (!wand.get()){ app.go('#/me/wand', true); toast('지팡이가 있어야 주문을 배울 수 있습니다.'); return; }
    if (sub === 'review' && spells.isLearnt(sp.id)){ reviewStart(); return; }
    if (spells.isLearnt(sp.id)) page();
    else { mode = 'lesson'; intro(); }
  }
  return {show, hide: () => { speech.stop(); if (rec){ try { rec.abort(); } catch (e){} rec = null; } fxl.innerHTML = ''; fxl.classList.remove('dark'); $$tr(sec); }};
}
const $$tr = sec => sec.querySelectorAll('.tr-layer').forEach(l => l.remove());
