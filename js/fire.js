/* The fireplace in the guest room (#/fire): Sirius Black's head in the coals, and the Floo. He is not a professor and
   has no door: his lines are learnt by the fire (#/room/sirius, the same ladder as a classroom), he keeps a bond like
   theirs (bond.js), and instead of tea there are talks by the fire (bond/sirius.json `teas`, twenty of them). The fire
   itself is an ordinary coal fire; green flames belong to Floo travel only (2026-10-11 user decision).
   He comes when the guest has the map and Lupin has come to know them (Lupin writes: "an old friend of mine"); for a
   guest who has not opened Lupin's door, Dumbledore writes a week after the map. No Howlers from him: after 3, 7, 14
   and 30 evenings without a fire he sends a short worried note (WN-<days>-<last day>).
   state.fire = {open: date, by: 'lupin'|'dumbledore', met: date}    ?fire in the address lights it at once (testing) */
import {byId} from './decks.js';
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as doors from './doors.js';
import * as shops from './shops.js';
import * as map from './map.js';
import * as speech from './speech.js';
import {hint} from './hints.js';
import {order} from './letters.js';
import {$, esc, toast, openSheet, closeSheet, isSheetOpen, reduced} from './ui.js';

const ID = 'sirius';
const st = () => { const s = store.get(); return s.fire || (s.fire = {}); };
export const isOpen = () => !!st().open;
export const met = () => !!st().met;
const between = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

/* ---------- when he comes, and the notes he sends when the grate stays cold */
export function daily(){
  const s = st(), t = srs.today(), all = store.get();
  if (!s.open){
    if (!all.settings.named) return;
    const force = new URLSearchParams(location.search).has('fire');
    const lupin = doors.isOpen('lupin') && bond.stage('lupin') >= 1, got = (all.map || {}).got;
    if (!force && !(map.have() && (lupin || (got && srs.addDays(got, 7) <= t)))) return;
    const by = lupin ? 'lupin' : 'dumbledore';
    if (!bond.postItem(by, 'SIRIUS')) return;
    s.open = t; s.by = by;
    store.save();
    return;
  }
  const b = bond.bondOf(ID), d = bond.loaded(ID);
  if (!b.lastDay || !d || !d.worry || all.settings.howler === false) return;
  const gap = between(b.lastDay, t), w = d.worry.filter(x => gap >= x.days).pop();
  if (w) bond.postItem(ID, `WN-${w.days}-${b.lastDay}`);
}
/* the words of the two kinds of post that are his alone (bond.itemOf) */
export function textOf(id, key, d){
  if (!d) return null;
  if (key === 'SIRIUS') return id === 'lupin' || id === 'dumbledore' ? {kind: '편지', ...d.intro[id]} : null;
  const m = key.match(/^WN-(\d+)-/), w = m && id === ID && (d.worry || []).find(x => x.days === +m[1]);
  return w ? {kind: '쪽지', en: w.en, ko: w.ko} : null;
}

/* ---------- Floo powder (2026-10-12 user decision: a rite, and real flames).
   The fire is empty by default — an ordinary coal fire. Sirius is in it only when he has come of his own accord (the
   first evening, or when he has something to say) or when the guest calls him. The jar of Floo powder on the hearth
   starts the rite: a pinch goes in, the fire turns emerald (floo-turn.mp4), burns green while the places one may go
   stand in the flames (floo-loop.mp4), and on naming one — aloud, clearly, or by pressing it — swallows the view
   (floo-rush.mp4). If he is in the fire when the jar is taken up, he says a word and draws back first.
   Without the films (offline, or motion turned down) the two paintings fade one into the other instead.
   A new place to go is one more line in DEST. */
const DEST = [
  {id: 'manor', en: 'Malfoy Manor', ko: '말포이 저택', to: '#/manor', open: () => doors.available('lucius')},
  {id: 'diagon', en: 'Diagon Alley', ko: '다이애건 앨리', to: '#/town/diagon', open: () => shops.isOpen()},
  {id: 'hogsmeade', en: 'Hogsmeade', ko: '호그스미드', to: '#/town/hogsmeade', open: () => shops.isOpen()}
];
const places = () => DEST.filter(d => d.open());
/* what he says when the guest takes up the jar in front of him (the last: when he had come with something to tell) */
const LEAVE = [
  {en: "Off somewhere? Go on, then. Speak clearly, or you'll come out of the wrong chimney.", ko: '어디 가? 그래, 다녀와. 또렷하게 말해. 안 그러면 엉뚱한 굴뚝으로 나온다.'},
  {en: "Don't let me keep you. I'll get out of the way. It's your fire, after all.", ko: '붙잡지 않을게. 비켜 줄게. 어쨌든 네 벽난로니까.'}
];
const LEAVE_WAIT = {en: "Now? Fine. It'll keep. Come back in one piece and I'll tell you then.", ko: '지금? 좋아. 얘기는 어디 안 가. 멀쩡히 돌아오면 그때 해 줄게.'};
/* the fire did not catch the name */
const MISS = [
  {en: 'The fire coughs you back out. Clearly, now.', ko: '불이 도로 뱉어 냈다. 이번엔 또렷하게.'},
  {en: 'The flames hesitate. They did not catch the name.', ko: '불길이 머뭇거린다. 이름을 알아듣지 못했다.'},
  {en: 'Somewhere, a chimney that is not yours sneezes. Try again.', ko: '어딘가에서 엉뚱한 굴뚝이 재채기를 한다. 다시.'}
];
const RUSH_CUT = 4.85;   // seconds into floo-rush.mp4: the frame is all green fire by then
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const wait = ms => new Promise(r => setTimeout(r, ms));
const letters = s => s.toLowerCase().replace(/[^a-z]/g, '');
function near(a, b){
  if (!a) return false; if (a.includes(b)) return true;
  const m = a.length, n = b.length; let row = Array.from({length: n + 1}, (_, j) => j);
  for (let i = 1; i <= m; i++){ const nx = [i]; for (let j = 1; j <= n; j++) nx[j] = Math.min(row[j] + 1, nx[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); row = nx; }
  return row[n] <= Math.max(2, Math.floor(n * .25));
}
/* the last of the green fire over everything: it comes up, the place changes behind it, it thins away */
function veil(app, to, full){
  const v = document.createElement('div');
  v.className = 'floo' + (full ? ' on now' : ''); v.setAttribute('aria-hidden', 'true');
  document.body.appendChild(v);
  if (!full) requestAnimationFrame(() => requestAnimationFrame(() => v.classList.add('on')));
  setTimeout(() => { app.go(to); requestAnimationFrame(() => { v.classList.remove('on', 'now'); v.classList.add('off'); }); }, full ? 60 : 520);
  setTimeout(() => v.remove(), 2200);
}
/* a way back (or anywhere) with no rite: the green comes and goes */
export function floo(app, to){ if (reduced()) app.go(to); else veil(app, to, false); }

/* ---------- the screen */
export function initFire(app){
  const sec = $('#fire'), idle = $('#fireIdle'), talk = $('#fireTalk'), jar = $('#fireJar'), bar = $('#flooBar'), dest = $('#fireDest');
  const vTurn = $('#flooTurn'), vLoop = $('#flooLoop'), vRush = $('#flooRush');
  let beat = 0, tea = null, turn = 0, score = 0, picks = [], watch = 0;
  let called = false, here = false, phase = '', rec = null, missN = 0;

  /* two loops of the same picture laid one on the other: he listens; while a line of his is being read, he talks */
  function film(on){
    [idle, talk].forEach(v => {
      if (on && !reduced()){ if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); }
      else v.pause();
    });
    clearInterval(watch);
    if (on) watch = setInterval(() => talk.classList.toggle('on', Date.now() < until || !!(window.speechSynthesis && speechSynthesis.speaking)), 240);
    else talk.classList.remove('on');
  }
  /* he talks for about as long as the words take — aloud in the phone's en-GB voice, or silently in quiet */
  let until = 0;
  const mouth = text => { until = Date.now() + Math.min(9000, 1200 + text.length * 48); };
  const hush = () => { until = 0; speech.stop(); };
  function sayAloud(text){
    const s = store.get().settings;
    mouth(text);
    if (!s.quiet) speech.speak(bond.fill(text), s.voice, null, .95);
  }
  /* is he in the fire? he has come himself on the first evening and when a talk is his to offer; otherwise only if called */
  const come = () => isOpen() && (!met() || !!bond.teaReady(ID));
  function setHere(on){ here = on; sec.classList.toggle('here', on); film(on); }

  const lessonTo = () => {
    const cards = app.data[ID]; if (!cards) return null;
    const p = srs.preview(ID, cards), g = srs.progress(ID, cards);
    return {p, g, done: p.done || p.empty};
  };
  const go = (label, attr, cls = '') => `<button type="button" class="cgo ${cls}" ${attr}><span>${label}</span><i aria-hidden="true">→</i></button>`;
  const flooLine = () => places().length ? go('플루 가루 <em>단지를 집는다</em>', 'data-jar', 'me-second') : '';
  const put = (who, stats, line, btns) => {
    $('#fireWho').textContent = who; $('#fireStats').innerHTML = stats;
    $('#fireLine').innerHTML = line; $('#fireLine').hidden = !line; $('#fireGo').innerHTML = btns;
  };

  function draw(){
    $('#fireCard').hidden = phase === 'turn' || phase === 'loop' || phase === 'rush';
    bar.hidden = phase !== 'loop' && phase !== 'turn';
    dest.hidden = phase !== 'loop';
    jar.hidden = !!phase || here || !places().length;
    if (phase) return;
    if (!here){ drawQuiet(); return; }
    const d = bond.loaded(ID), who = byId(ID).who;
    if (!d){ put(who, '', '<span class="k">불길 속에서 누군가 말을 고르고 있다…</span>', ''); return; }
    /* the first evening: his first words, a few at a time */
    if (!met()){
      const b = d.first[beat], last = beat >= d.first.length - 1;
      put(who, '', `<span class="q" lang="en">${esc(bond.fill(b.en))}</span><span class="k">${esc(bond.fill(b.ko))}</span>`, go(last ? '의자를 끌어다 앉는다' : '듣는다', 'data-beat'));
      return;
    }
    const L = lessonTo(), t = bond.teaReady(ID);
    let stats = '', line = '', main = '', link = '';
    if (!L) line = '<span class="k">대본을 펼치는 중…</span>';
    else {
      const {p, g, done} = L;
      stats = done ? `<div><b>${g.mastered}</b>숙달 / ${g.total}</div><div><b>${g.seen}</b>배운 대사</div>`
        : `<div><b>${p.review}</b>복습</div><div><b>${p.fresh}</b>새 대사</div><div><b>${g.mastered}</b>숙달 / ${g.total}</div>`;
      if (done) line = `<span class="k">${p.done ? `오늘 대사 공부는 여기까지 · 내일 복습 ${g.dueTomorrow}장` : g.complete ? '그의 말을 모두 익혔다' : '오늘은 되짚을 대사가 없다'}</span>`;
      main = done ? (g.seen ? go('더 도전 · 배운 대사 10문제', `data-to="#/room/${ID}/extra"`) : '') : go('대사 공부 시작', `data-to="#/room/${ID}"`);
      if (done && Object.keys(((store.deck(ID).day || {}).results) || {}).length) link = `<button type="button" class="clink" data-to="#/report/${ID}">오늘 성적표 보기</button>`;
    }
    if (t){
      const iv = bond.inviteText(ID);
      /* he is calling: his words take the place of the day's figures, so the card stays below his face. A line above them says
         what this is, as a professor's invitation to tea does — and the lesson is named as a lesson, not as sitting by the
         fire, which is what he asks for when he wants to talk (user, 2026-10-12: the two buttons could not be told apart) */
      line = `<span class="pick">시리우스가 이야기를 청한다</span><span class="q" lang="en">${esc(bond.fill(iv.en))}</span><span class="k">${esc(bond.fill(iv.ko))}</span>`; stats = '';
      main = go(`이야기를 나눈다 · <span lang="en">${esc(t.title.en)}</span>`, 'data-talk') + main.replace('class="cgo "', 'class="cgo me-second"');
    }
    put(who, stats, line, main + flooLine() + link);
  }
  /* nobody in the fire: he can be called (once he has come to this fire at all); the jar stands on the hearth */
  function drawQuiet(){
    const L = isOpen() && lessonTo();
    const note = !L ? '' : L.done ? (L.p.done ? '오늘 대사 공부는 끝났다' : '오늘은 되짚을 대사가 없다') : `복습 ${L.p.review} · 새 대사 ${L.p.fresh}`;
    put('A Quiet Fire', '', '<span class="k">탑 꼭대기 손님 방의 벽난로. 석탄불이 조용히 타고 있다.</span>',
      isOpen() ? go(`시리우스를 부른다${note ? ` <em>${note}</em>` : ''}`, 'data-call') : '');
  }

  /* ---------- the rite */
  function playOnce(v, ms, cut){
    return new Promise(res => {
      if (reduced()){ res(false); return; }
      let done = false; const end = ok => { if (done) return; done = true; clearTimeout(t); v.removeEventListener('timeupdate', tick); res(ok); };
      const tick = () => { if (cut && v.currentTime >= cut) end(true); };
      const t = setTimeout(() => end(!v.paused), ms);
      if (!v.src) v.src = v.dataset.src;
      v.onended = () => end(true); v.onerror = () => end(false);
      v.addEventListener('timeupdate', tick);
      try { v.currentTime = 0; } catch (e){}
      v.play().then(() => v.classList.add('live')).catch(() => end(false));
    });
  }
  const still = () => [vTurn, vLoop, vRush].forEach(v => { v.pause(); v.classList.remove('live'); });
  function barSay(l, tease){
    bar.innerHTML = `<p class="q" lang="en">${esc(l.en)}</p><p class="k">${esc(l.ko)}</p>` + (phase === 'loop' ?
      `<div class="floo-do">${SR ? '<button type="button" class="floo-mic" data-mic><span lang="en">Say it</span> 말하기</button>' : ''}<button type="button" class="clink" data-stop>그만둔다</button></div>` : '');
    bar.classList.toggle('tease', !!tease);
  }
  async function takeJar(){
    if (phase || !places().length) return;
    hush();
    if (here){
      /* he is there: a word from him, and he draws back into the coals */
      phase = 'leaving';
      const l = met() && bond.teaReady(ID) ? LEAVE_WAIT : LEAVE[Math.floor(Math.random() * LEAVE.length)];
      put(byId(ID).who, '', `<span class="q" lang="en">${esc(l.en)}</span><span class="k">${esc(l.ko)}</span>`, '');
      jar.hidden = true;
      sayAloud(l.en);
      await wait(Math.min(6000, 1700 + l.en.length * 48));
      if (sec.hidden || phase !== 'leaving') return;
      hush(); called = false; setHere(false);
      $('#fireCard').hidden = true;
      await wait(1300);
      if (sec.hidden || phase !== 'leaving') return;
    }
    phase = 'turn'; sec.dataset.floo = 'turn'; missN = 0;
    draw(); bar.innerHTML = '';
    await playOnce(vTurn, 6500);
    if (sec.hidden || phase !== 'turn') return;
    if (!reduced()){ if (!vLoop.src) vLoop.src = vLoop.dataset.src; try { vLoop.currentTime = 0; } catch (e){} vLoop.play().then(() => { vLoop.classList.add('live'); setTimeout(() => vTurn.classList.remove('live'), 400); }).catch(() => {}); }
    phase = 'loop'; sec.dataset.floo = 'loop';
    dest.innerHTML = places().map(d => `<button type="button" data-dest="${d.id}"><b lang="en">${esc(d.en)}</b><small>${esc(d.ko)}</small></button>`).join('');
    draw();
    barSay({en: 'Speak your destination. Clearly.', ko: '갈 곳을 또렷하게 말한다. 불길 속 이름을 눌러도 된다.'});
  }
  function stopFloo(){
    if (rec){ try { rec.abort(); } catch (e){} rec = null; }
    phase = ''; delete sec.dataset.floo; still();
    draw();
  }
  async function depart(d){
    if (phase !== 'loop') return;
    if (rec){ try { rec.abort(); } catch (e){} rec = null; }
    phase = 'rush'; sec.dataset.floo = 'rush';
    draw();
    const ok = await playOnce(vRush, 5600, RUSH_CUT);
    if (sec.hidden || phase !== 'rush') return;
    called = false;
    if (ok) veil(app, d.to, true); else floo(app, d.to);
  }
  function miss(){
    sec.classList.remove('sputter'); void sec.offsetWidth; sec.classList.add('sputter');
    barSay(MISS[missN++ % MISS.length], true);
  }
  function listen(){
    if (!SR || phase !== 'loop') return; if (rec){ rec.stop(); return; }
    let text = ''; const m = bar.querySelector('[data-mic]'); if (m) m.classList.add('on');
    rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = false;
    rec.onresult = e => { text = [...e.results].map(r => r[0].transcript).join(' '); };
    let err = '';
    rec.onerror = e => { err = (e && e.error) || 'error'; };
    rec.onend = () => {
      rec = null; const b = bar.querySelector('[data-mic]'); if (b) b.classList.remove('on');
      if (phase !== 'loop') return;
      const said = letters(text), d = said && places().find(x => near(said, letters(x.en)));
      if (d){ depart(d); return; }
      /* a name the fire did not know gutters it; a microphone that heard nothing is only told so */
      if (said) miss();
      else toast(/not-allowed|service|audio-capture/.test(err) ? '마이크를 쓸 수 없습니다. 불길 속 이름을 눌러 주세요.' : '들리지 않았습니다. 다시 말하거나 불길 속 이름을 눌러 주세요.', 3000);
    };
    try { rec.start(); } catch (e){ rec = null; if (m) m.classList.remove('on'); }
  }

  /* ---------- a talk by the fire: the frame of a tea (letters.js) — he speaks, three answers, his reply; three times */
  const f = s => esc(bond.fill(s));
  function talkStart(){
    if (!bond.teaReady(ID)) return;
    hint('tea', () => {
      tea = bond.teaReady(ID); if (!tea || sec.hidden) return;
      turn = 0; score = 0; picks = [];
      talkTurn('');
    });
  }
  function talkTurn(before){
    const tn = tea.turns[turn];
    mouth(tn.prof.en);
    openSheet(`<div class="sh-kind"><span>불 속 대화 · ${turn + 1} / ${tea.turns.length}</span></div>` +
      `<h2 class="sh-expr" id="shTitle" lang="en">${esc(tea.title.en)}</h2>${turn === 0 ? `<p class="tea-scene">${esc(tea.scene.ko)}</p>` : ''}` + before +
      `<div class="tea-say"><p class="en" lang="en">${f(tn.prof.en)}</p><p class="ko">${f(tn.prof.ko)}</p></div>` +
      `<div class="tea-opts">${order(tea.id + '|' + turn, tn.options.length).map(i => { const o = tn.options[i]; return `<button type="button" data-ftalk="${i}"><span lang="en">${f(o.en)}</span><small>${f(o.ko)}</small></button>`; }).join('')}</div>`);
  }
  function talkPick(i){
    const tn = tea.turns[turn], o = tn.options[i]; if (!o) return;
    score += o.delta | 0; picks.push(i);
    const said = `<div class="tea-me"><p class="en" lang="en">${f(o.en)}</p></div><div class="tea-say"><p class="en" lang="en">${f(o.reply.en)}</p><p class="ko">${f(o.reply.ko)}</p></div>`;
    turn++;
    if (turn < tea.turns.length){ talkTurn(said); return; }
    bond.finishTea(ID, tea, score, picks);
    openSheet(`<div class="sh-kind"><span>불 속 대화</span></div><h2 class="sh-expr" id="shTitle" lang="en">${esc(tea.title.en)}</h2>${said}` +
      `<div class="tea-say close"><p class="en" lang="en">${f(tea.close.en)}</p><p class="ko">${f(tea.close.ko)}</p></div>` +
      `<p class="tea-noted">오늘 밤의 이야기는 내 방 <b>차 일지</b>의 시리우스 쪽에 적어 두었습니다.</p>` +
      `<button type="button" class="sh-drill" data-close>불가에서 일어난다</button>`);
    tea = null;
    called = true;   // he stays while the guest is still sitting there
    draw();
  }

  /* ---------- events */
  $('#fireGo').addEventListener('click', e => {
    if (e.target.closest('[data-beat]')){
      const d = bond.loaded(ID); hush();
      if (beat < d.first.length - 1){ beat++; draw(); sayAloud(d.first[beat].en); return; }
      /* seated: the first talk is his to offer at once (2026-10-11 user decision) */
      st().met = srs.today(); called = true;
      const b = bond.bondOf(ID); if (!b.inv && !Object.keys(b.teas).length) b.inv = {src: 'fire', t: srs.today()};
      store.save();
      draw(); return;
    }
    if (e.target.closest('[data-call]')){ called = true; setHere(true); draw(); return; }
    if (e.target.closest('[data-talk]')){ talkStart(); return; }
    if (e.target.closest('[data-jar]')){ takeJar(); return; }
    const to = e.target.closest('[data-to]'); if (to){ hush(); app.go(to.dataset.to); }
  });
  jar.addEventListener('click', takeJar);
  dest.addEventListener('click', e => { const b = e.target.closest('[data-dest]'), d = b && DEST.find(x => x.id === b.dataset.dest); if (d) depart(d); });
  bar.addEventListener('click', e => { if (e.target.closest('[data-mic]')) listen(); else if (e.target.closest('[data-stop]')) stopFloo(); });
  $('#sheetBody').addEventListener('click', e => { if (sec.hidden || !tea) return; const b = e.target.closest('[data-ftalk]'); if (b) talkPick(+b.dataset.ftalk); });
  /* back: out of the rite first; otherwise out of the room's corner (and he goes with the guest) */
  const back = () => { hush(); if (phase === 'loop' || phase === 'turn'){ stopFloo(); return; } if (phase) return; called = false; app.go('#/me'); };
  $('#fireBack').addEventListener('click', back);
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else back(); } });

  async function show(){
    if (!isOpen() && !places().length){ app.go('#/me', true); return; }
    beat = 0; tea = null; phase = ''; delete sec.dataset.floo; still();
    setHere(isOpen() && (called || come()));
    draw();
    await Promise.all([isOpen() ? bond.load(ID) : null, isOpen() ? app.loadDeck(ID).catch(() => null) : null]);
    if (sec.hidden || phase) return;
    setHere(isOpen() && (called || come()));
    draw();
    /* the green fire, fetched ahead so the rite starts at once */
    if (places().length && !reduced()) [vTurn, vLoop, vRush].forEach(v => { if (!v.src){ v.preload = 'auto'; v.src = v.dataset.src; } });
    if (here && !met() && bond.loaded(ID)) setTimeout(() => { if (!sec.hidden && here && !met() && beat === 0 && !phase) sayAloud(bond.loaded(ID).first[0].en); }, 900);
  }
  function hide(){
    hush(); film(false); still();
    if (rec){ try { rec.abort(); } catch (e){} rec = null; }
    phase = ''; delete sec.dataset.floo; sec.classList.remove('sputter');
  }
  return {show, hide, refresh: () => { if (!sec.hidden && !phase) draw(); }};
}
