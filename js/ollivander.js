/* Ollivander's shop (#/ollivander, 2026-10-05 user decision): not a door in the corridor (the shop is in Diagon Alley,
   not the castle) but a visit reached from his note, which an owl brings the day after the first lesson, or from the
   wand box in my room. Five questions (the tea-time pattern: Ollivander speaks, three answers to choose from), a maple
   wand that breaks the vase, then the learner's own wand: sparks in the colour of its core, "Lumos" said aloud or
   tapped, and the result card. Leaving half-way starts again next time; the wand is kept only at the card.
   #/ollivander/again: making a new wand (from the wand box). Once a spell is learnt, the new wand is the learner's only
   after a test on the spells learnt (spells.wandTest: first-letter questions, every one right); otherwise Ollivander keeps
   it until the next day, when the test can be taken again without the questions. Words and rules: wand.js. */
import * as wand from './wand.js';
import * as bond from './bond.js';
import * as speech from './speech.js';
import * as post from './post.js';
import * as spells from './spells.js';
import * as srs from './srs.js';
import {$, esc, toast, openSheet, fitPaper, reduced, wait} from './ui.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const f = s => esc(bond.fill(s));
/* [[words|key]] → a button that opens the meaning */
const MARK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const marked = s => f(s).replace(MARK, (m, w, k) => `<button type="button" class="ol-x" data-gl="${esc(k || w)}">${w}</button>`);

/* the result card's words (also shown in the wand box, myroom.js) */
export function cardWords(w){
  const [a, b, c] = wand.sayings(w), aside = wand.SAYS[w.wood].aside;
  return `<div class="ol-card-h"><p class="t" lang="en">${esc(wand.titleEn(w))}</p><p class="k">${esc(wand.titleKo(w))}</p></div>` +
    [a, b, c].map((s, i) => `<div class="ol-say"><p class="en" lang="en">${marked(s.en)}</p><p class="ko">${f(s.ko)}</p></div>` +
      (i === 0 && aside ? `<div class="ol-say aside"><p class="en" lang="en">${f(aside.en)}</p><p class="ko">${f(aside.ko)}</p></div>` : '')).join('') +
    `<p class="ol-tap">굵은 표현을 누르면 뜻이 열립니다.</p>`;
}
export function gloss(k){
  const g = wand.GLOSS[k]; if (!g) return;
  openSheet(`<div class="sh-kind"><span>올리밴더의 표현</span></div><h2 class="sh-expr" id="shTitle" lang="en">${esc(g.en)}</h2><p class="sh-note">${esc(g.ko)}</p>`);
}
export const boxed = wood => `<figure class="ol-boxed"><img class="box" src="assets/wand/box.webp" alt=""><img class="w" src="${wand.img(wood)}" alt=""></figure>`;

export function initOllivander(app){
  const sec = $('#ollivander'), card = $('#olCard'), body = $('#olBody'), stage = $('#olStage');
  let ans = [], made = null, again = false, rec = null, step = '';

  const say = (line, cls = '') => `<div class="ol-say ${cls}"><p class="en" lang="en">${f(line.en)}</p><p class="ko">${f(line.ko)}</p></div>`;
  const who = () => `<div class="ol-who"><span lang="en">Mr Ollivander</span>${speech.gbVoices().length ? '<button type="button" class="ol-hear" data-hear aria-label="영국 영어로 듣기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/></svg></button>' : ''}</div>`;
  const boxes = n => `<div class="ol-boxes" aria-label="질문 ${n} / 5">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
  const btn = (act, en, ko, cls = '') => `<button type="button" class="ol-go ${cls}" data-act="${act}"><span lang="en">${en}</span><small>${ko}</small></button>`;
  let heard = '';   // the Ollivander line read aloud by the little speaker
  function put(html, line){
    heard = line ? bond.fill(line.en) : '';
    body.innerHTML = html;
    body.classList.remove('in'); void body.offsetWidth; body.classList.add('in');
    $('#olScroll').scrollTop = $('#olScroll').scrollHeight;
  }
  const wandFig = (wood, extra = '') => `<figure class="ol-wand ${extra}"><img src="${wand.img(wood)}" alt=""><i class="ol-tip"></i></figure>`;
  /* the trial wands (2026-10-05 user decision): the whole background moves in to the counter (assets/rooms/
     ollivander-counter-portrait|wide.webp, counter top between 44–56% / 53–65% of the picture's height). The vase stands
     on that counter, placed in the picture's own coordinates; the wand is in the learner's hand, coming in from the
     bottom right of the screen and pointing at the vase. On wide screens the parchment moves to the left so the counter shows. Both are laid out again whenever the screen changes size. */
  const near = $('#olNear');
  const PIC = {portrait: {ar: 9 / 16, vase: {x: .42, base: .495, w: .36}, hand: .64}, wide: {ar: 16 / 9, vase: {x: .64, base: .585, w: .13}, hand: .76}};
  function scene(wood, vase){
    sec.classList.add('near');
    near.innerHTML = (vase ? `<img class="ol-vase" id="olVase" src="assets/wand/${vase}.webp" alt="">` : '') + wandFig(wood);
    stage.innerHTML = '';
    place();
  }
  function leaveScene(){ sec.classList.remove('near'); near.innerHTML = ''; }
  function place(){
    if (!sec.classList.contains('near')) return;
    const vw = innerWidth, vh = innerHeight, P = matchMedia('(min-aspect-ratio: 1/1)').matches ? PIC.wide : PIC.portrait;
    /* the background picture as drawn (cover, centred) */
    const k = Math.max(vw / (vh * P.ar), 1), pw = vh * P.ar * k, ph = vh * k, px = (vw - pw) / 2, py = (vh - ph) / 2;
    const v = $('#olVase', near), vx = px + pw * P.vase.x, vy = py + ph * P.vase.base, vwid = pw * P.vase.w;
    if (v) Object.assign(v.style, {width: vwid + 'px', left: vx - vwid / 2 + 'px', top: vy - vwid * .85 + 'px'});
    /* the hand: just off the right edge, a little below the counter; the tip stops short of the vase */
    const hx = vw - Math.min(14, vw * .03), hy = py + ph * P.hand;
    const tx = vx + vwid * .25, ty = vy - vwid * .1, dx = hx - tx, dy = hy - ty;
    const L = Math.min(Math.hypot(dx, dy) * .82, vw * .78, 520), a = Math.atan2(dy, dx) * 180 / Math.PI;
    const W = L / .9, H = W * 600 / 1400, f = $('.ol-wand', near);
    Object.assign(f.style, {width: W + 'px', left: hx - W * .08 + 'px', top: hy - H / 2 + 'px'});
    f.style.setProperty('--base', `scaleX(-1) rotate(${-a}deg)`);
    f.style.setProperty('--b1', `scaleX(-1) rotate(${-a + 14}deg)`);
    f.style.setProperty('--b2', `scaleX(-1) rotate(${-a - 16}deg)`);
  }

  /* ---------- steps */
  function note(){
    step = 'note'; stage.innerHTML = ''; leaveScene();
    put(`<div class="ol-note"><p class="ol-kind"><i class="seal o-wand"></i>부엉이가 가져온 쪽지</p><p class="en" lang="en">${f(wand.NOTE.en)}</p><p class="sign" lang="en">— ${wand.NOTE.sign}</p><p class="ko">${f(wand.NOTE.ko)}</p></div>` +
      btn('hello', 'Step inside', '가게로 들어가기'));
  }
  function warn(){
    step = 'warn'; scene(wand.get().wood, '');
    put(who() + say(wand.LINES.again) + btn('hello', 'Quite sure.', '네, 새로 맞춰 주세요') + btn('leave', 'Perhaps not.', '그만두기', 'quiet'), wand.LINES.again);
  }
  function hello(){
    step = 'hello'; ans = []; stage.innerHTML = ''; leaveScene();
    put(who() + say(wand.LINES.hello) + btn('q', 'Ask away.', '물어보세요'), wand.LINES.hello);
  }
  function question(){
    const k = ans.length, q = wand.QUESTIONS[k];
    step = 'q';
    put(boxes(k) + who() + say(q) + `<div class="tea-opts ol-opts">${q.options.map((o, i) => `<button type="button" data-opt="${i}"><span lang="en">${esc(o.en)}</span><small>${esc(o.ko)}</small></button>`).join('')}</div>`, q);
  }
  function answer(i){
    const k = ans.length, q = wand.QUESTIONS[k], o = q.options[i];
    ans.push(i);
    put(boxes(k + 1) + who() + say(q) + `<div class="tea-me"><p class="en" lang="en">${esc(o.en)}</p></div>` + say(o.re, 'reply') +
      btn(ans.length < 5 ? 'q' : 'try1', ans.length < 5 ? 'Go on.' : 'Let us see.', ans.length < 5 ? '계속' : '지팡이를 보자'), o.re);
  }
  function try1(){
    step = 'try1';
    scene('maple', 'vase');
    put(who() + say(wand.LINES.try1) + btn('wave1', 'Give it a wave.', '휘두르기'), wand.LINES.try1);
  }
  async function wave1(){
    if (step !== 'try1') return; step = 'waving';
    const w = $('.ol-wand', near);
    if (!reduced()){ w.classList.add('wave'); await wait(420); }
    $('#olVase').src = 'assets/wand/vase-broken.webp';
    if (!reduced()){ sec.classList.remove('shake'); void sec.offsetWidth; sec.classList.add('shake'); }
    await wait(reduced() ? 0 : 450);
    put(who() + say(wand.LINES.no1) + btn('try2', 'Another, then.', '다른 지팡이'), wand.LINES.no1);
  }
  function try2(){
    step = 'try2';
    made = wand.make(ans);
    scene(made.wood, 'vase-broken');
    put(who() + say(wand.LINES.try2) + btn('wave2', 'Give it a wave.', '휘두르기'), wand.LINES.try2);
  }
  async function wave2(){
    if (step !== 'try2') return; step = 'waving';
    const w = $('.ol-wand', near), tip = $('.ol-tip', near), c = wand.CORES[made.core].spark;
    if (!reduced()){
      w.classList.add('wave'); await wait(380);
      tip.style.setProperty('--c', c);
      tip.innerHTML = Array.from({length: 22}, () => {
        const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 70;
        return `<i style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d - 20).toFixed(0)}px;--t:${(.7 + Math.random() * .6).toFixed(2)}s"></i>`;
      }).join('');
      tip.classList.add('burst');
      await wait(900);
    }
    step = 'lumos';
    put(who() + say(wand.LINES.curious) + `<div class="ol-lumos">` +
      (SR ? `<button type="button" class="ol-mic" data-act="speak"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg><span>말로 하기</span></button>` : '') +
      `<button type="button" class="ol-go" data-act="lumos"><span lang="en">Lumos</span><small>누르기</small></button></div><p class="ol-heard" id="olHeard" hidden></p>`, wand.LINES.curious);
  }
  function listen(){
    if (step !== 'lumos' || !SR) return;
    if (rec){ rec.stop(); return; }
    let text = '';
    const h = $('#olHeard'), m = $('.ol-mic', body);
    h.hidden = false; h.textContent = '듣고 있습니다… “Lumos”';
    m.classList.add('on');
    rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = e => { text = [...e.results].map(x => x[0].transcript).join(' ').trim(); };
    rec.onerror = e => { if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) toast('마이크를 쓸 수 없습니다. Lumos 버튼을 누르세요.'); };
    rec.onend = () => {
      rec = null; m.classList.remove('on');
      if (text){ h.textContent = `“${text}”`; lumos(); }
      else h.textContent = '들리지 않았습니다. 다시 말하거나 Lumos 버튼을 누르세요.';
    };
    try { rec.start(); } catch (e){ rec = null; m.classList.remove('on'); }
  }
  async function lumos(){
    if (step !== 'lumos') return; step = 'lit';
    const tip = $('.ol-tip', near);
    tip.innerHTML = ''; tip.classList.remove('burst'); tip.classList.add('lit');
    sec.classList.add('lit');
    await wait(reduced() ? 0 : 900);
    put(who() + say(wand.LINES.chose) + (again && spells.learntList().length ? btn('test', 'Very well.', '시험 보기') : btn('card', 'May I see it?', '내 지팡이 보기')), wand.LINES.chose);
  }
  /* ---------- the new-wand test */
  let tq = [], ti = 0, tok = 0;
  async function test(){
    await spells.load();
    tq = spells.wandTest(srs.today() + made.wood); ti = 0; tok = 0;
    if (!tq.length){ showCard(); return; }
    step = 'test';
    put(who() + say(wand.LINES.test) + btn('tq', 'Very well.', `시작 · ${tq.length}문제`), wand.LINES.test);
  }
  function testQ(){
    step = 'tq';
    const q = tq[ti], m = q.s.match(/([A-Za-z])(_+)/), sp = spells.get(q.spell);
    put(boxesN(ti, tq.length) + `<p class="sp-kind">${esc(sp ? sp.name : '')} · 첫 글자 보고 쓰기</p><p class="sp-qko">${esc(q.ko)}</p>` +
      `<p class="sp-qs" lang="en">${esc(q.s.slice(0, m.index))}<span class="sp-blank">${esc(m[1])}${'_'.repeat(m[2].length)}</span>${esc(q.s.slice(m.index + m[0].length))}</p>` +
      `<form class="sp-write" data-tw><input id="olIn" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="빈칸에 들어갈 단어" placeholder="${esc(m[1])}…"><button type="submit" class="ol-go"><span lang="en">Check</span><small>확인</small></button></form>`);
    setTimeout(() => { const i = $('#olIn'); if (i) i.focus({preventScroll: true}); }, 60);
  }
  const boxesN = (k, n) => `<div class="ol-boxes" aria-label="문제 ${k + 1} / ${n}">${Array.from({length: n}, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</div>`;
  function testAnswer(v){
    const q = tq[ti], ok = spells.same(v, q.a), inp = $('#olIn');
    if (ok) tok++;
    inp.classList.add(ok ? 'right' : 'wrong'); inp.disabled = true; body.querySelector('.sp-write button').disabled = true;
    body.insertAdjacentHTML('beforeend', `<div class="sp-fb ${ok ? 'ok' : 'no'}">${ok ? '<b>맞았습니다</b>' : `<b>정답</b><span lang="en">${esc(q.a)}</span>`}${btn('tnext', 'Next', '다음')}</div>`);
  }
  function testNext(){
    ti++;
    if (ti < tq.length){ testQ(); return; }
    if (tok === tq.length){ wand.dropPending(); showCard(); return; }
    wand.setPending(made);
    step = 'kept';
    put(who() + say(wand.LINES.keepIt) + `<p class="sp-next">${tok} / ${tq.length} · 내일 다른 문제로 다시 볼 수 있습니다</p>` + btn('leave', 'Until tomorrow.', '지팡이 상자로'), wand.LINES.keepIt);
  }
  /* back the next day for a wand that is waiting */
  function waiting(){
    const p = wand.pending();
    made = {...p};
    scene(made.wood, '');
    if (p.d >= srs.today()){ step = 'wait'; put(who() + say(wand.LINES.tomorrow) + btn('leave', 'Tomorrow, then.', '지팡이 상자로'), wand.LINES.tomorrow); return; }
    step = 'wait';
    put(who() + say(wand.LINES.waiting) + btn('test', 'Let us see.', '시험 보기') + btn('fresh', 'A different wand', '문답부터 다시', 'quiet'), wand.LINES.waiting);
  }

  function showCard(){
    step = 'card';
    const w = wand.keep(made);   // kept from here on, even if the learner walks away
    post.shareWand();
    sec.classList.remove('lit'); leaveScene();
    stage.innerHTML = boxed(w.wood);
    put(cardWords(w) + btn('home', 'Into the box, then.', '상자에 넣어 내 방으로'), {en: wand.sayings(w).map(s => s.en.replace(MARK, '$1')).join(' ')});
    app.refresh();
  }

  /* ---------- events */
  body.addEventListener('click', e => {
    const x = e.target.closest('[data-gl]'); if (x){ gloss(x.dataset.gl); return; }
    if (e.target.closest('[data-hear]')){ if (heard) speech.speak(heard, '', null, .9); return; }
    const o = e.target.closest('[data-opt]'); if (o && step === 'q'){ answer(+o.dataset.opt); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    ({hello, q: question, try1, wave1, try2, wave2, speak: listen, lumos, card: showCard,
      home: () => app.go('#/me/wand'), leave: () => app.go('#/me/wand'), test, tq: testQ, tnext: testNext,
      fresh: () => { wand.dropPending(); hello(); }})[b.dataset.act]?.();
  });
  body.addEventListener('submit', e => { if (!e.target.closest('[data-tw]') || step !== 'tq') return; e.preventDefault(); const i = $('#olIn'); if (i && i.value.trim() && !i.disabled) testAnswer(i.value); });
  $('#olBack').addEventListener('click', () => { speech.stop(); app.go(wand.get() || wand.noteArrived() ? '#/me/wand' : '#/me'); });

  function show({id}){
    fitPaper(card);
    if (rec){ try { rec.abort(); } catch (e){} rec = null; }
    sec.classList.remove('lit', 'shake'); leaveScene();
    again = id === 'again' && !!wand.get();
    if (again && wand.pending()) waiting();
    else if (again) warn();
    else if (wand.get()){ app.go('#/me/wand', true); return; }
    else note();
  }
  return {show, resize: place, hide: () => { speech.stop(); if (rec){ try { rec.abort(); } catch (e){} rec = null; } }};
}
