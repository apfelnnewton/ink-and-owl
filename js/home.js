/* Home: the corridor. One continuous wall made of eight painted sections (assets/corridor/<id>.webp: your own room, then the seven professors) laid edge to
   edge and cross-faded where they overlap, with plain wall fading into the dark beyond both ends. The camera slides
   along the wall under the finger and settles on the nearest door; that door's loop (<id>.mp4) plays if it exists.
   A title card underneath names the professor and today's work. */
import {shade} from './art.js';
import {keyring} from './art-plus.js';
import {DECKS, LOCKED, FIRST} from './decks.js';
import * as doors from './doors.js';
import {dismissOwl} from './owl.js';
import * as bond from './bond.js';
import * as post from './post.js';
import {hint, hintSeen} from './hints.js';
import * as srs from './srs.js';
import {$, esc, toast, reduced} from './ui.js';

const OVERLAP = .09;                       // each section shares its outer 9% of wall with the next
const ART = id => `assets/corridor/${id}`;
const EYEBROW = {me: 'Your Room · The Tower', snape: 'Potions · The Dungeons', mcgonagall: 'Transfiguration', lupin: 'Defence · 1993', moody: 'Defence · 1994',
  umbridge: 'Defence · 1995', dumbledore: 'The Headmaster', slughorn: 'Potions · 1996'};
/* the first door is your own: the guest room at the top of the tower, where the letters and the professors' gifts are kept */
const ME = {id: 'me', me: true, who: 'The Guest Room', ko: '내 방', where: '탑 꼭대기 손님 방 · 편지 · 차 일지 · 선물', glow: '#9FB7E0'};
const DOORS = [ME, ...DECKS];
const START = 1;                           // the corridor opens on the first professor's door

export function initHome(app){
  const home = $('#home'), stage = $('#cstage'), wall = $('#cwall'), card = $('#ccard'), ticks = $('#cticks'), veil = $('#veil');
  let w = 0, step = 0, top = 0, pos = START, target = START, cur = -1, drag = null, vel = 0, raf = 0, busy = false, moved = false, knock = 0;
  /* a closed door answers in its professor's voice: not yet, in their own way */
  const lockedLine = (id, k) => { const l = LOCKED[id] || [{en: 'Not yet.', ko: '아직이다.'}]; return l[k % l.length]; };

  $('#keysSvg').innerHTML = keyring();
  doors.primeKeys();
  /* the twentieth line learnt: a key, wherever you are */
  doors.onKey(n => {
    if (!hintSeen('key')){ hint('key'); return; }   // the first key: Dumbledore's note instead of the plain notice
    toast(`<span class="q" lang="en">A key for you.</span><span class="k">열쇠를 얻었다 · 복도의 잠긴 문 하나를 열 수 있다${n > 1 ? ` (열쇠 ${n}개)` : ''}</span>`, 3400, true);
  });
  ticks.innerHTML = DOORS.map(d => d.me ? '<i class="me"></i>' : '<i></i>').join('');

  /* sections: the doors, plus a mirrored plain wall before the first and a plain wall after the last */
  const secs = DOORS.map(d => {
    const s = document.createElement('div');
    s.className = 'csec';
    s.style.backgroundImage = `url(${ART(d.id)}.webp)`;
    s.innerHTML = `<video muted loop playsinline preload="none" aria-hidden="true"></video>` +
      (d.me ? '' : `<i class="door-inv" hidden aria-hidden="true"><img src="assets/owl/envelope.webp" alt=""><i class="seal s-${d.id}"></i></i>`);
    wall.appendChild(s);
    return s;
  });
  const ends = [-1, DOORS.length].map(k => {
    const s = document.createElement('div');
    s.className = 'csec end' + (k < 0 ? ' flip' : '');
    s.dataset.k = k;
    s.style.backgroundImage = `url(${ART('end')}.webp)`;
    wall.prepend(s);
    return s;
  });

  /* ---------- state of each deck for today */
  function status(d){
    if (d.me) return {open: true, me: true};
    if (!d.file || !doors.isOpen(d.id)) return {open: false};
    const cards = app.data[d.id];
    if (!cards) return {open: true, loading: true};
    return {open: true, p: srs.preview(d.id, cards), g: srs.progress(d.id, cards)};
  }

  /* ---------- size: on a phone each section is a little narrower than the screen so the wall and the next
     doors show at the edges; on wide screens the wall fills the height and several doors are in view */
  function size(){
    const vw = stage.clientWidth, vh = stage.clientHeight, phone = vw < 700;
    const h = phone ? Math.min(vh, vw * 1.72) : vh;
    top = phone ? Math.max(0, (vh - h) * .18) : 0;
    w = h * 9 / 16; step = w * (1 - OVERLAP);
    const f = (OVERLAP * 100).toFixed(1), feather = `linear-gradient(90deg, transparent 0%, #000 ${f}%, #000 ${100 - f}%, transparent 100%)`;
    secs.forEach((s, i) => {
      Object.assign(s.style, {left: i * step + 'px', top: top + 'px', width: w + 'px', height: h + 'px', webkitMaskImage: feather, maskImage: feather});
    });
    const fade = `linear-gradient(90deg, transparent 0%, #000 ${f}%, #000 30%, transparent 100%)`;
    ends.forEach(s => Object.assign(s.style, {left: (+s.dataset.k) * step + 'px', top: top + 'px', width: w + 'px', height: h + 'px', webkitMaskImage: fade, maskImage: fade}));
    place();
  }
  function place(){
    wall.style.transform = `translate3d(${(stage.clientWidth / 2 - w / 2 - pos * step).toFixed(1)}px,0,0)`;
    const n = Math.max(0, Math.min(DOORS.length - 1, Math.round(pos)));
    if (n !== cur){ cur = n; describe(true); }
  }

  /* ---------- the title card */
  function describe(swap){
    const d = DOORS[cur], st = status(d), go = $('#cgo');
    const fill = () => {
      $('#cey').textContent = EYEBROW[d.id] || '';
      $('#cwho').textContent = d.who;
      $('#cwhere').textContent = d.where;
      let stats = '', line = '', label = '교실로 들어가기', locked = !st.open, report = false;
      if (st.me){
        /* your own door: what the owls have left and how full the drawers are */
        const n = bond.unread() + post.unread(), g =DECKS.reduce((s, x) => s + bond.keepsakes(x.id).length, 0), t = DECKS.find(x => bond.teaReady(x.id));
        stats = `<div><b>${n}</b>새 편지</div><div><b>${g}</b>선물 / ${DECKS.length * 30}</div>`;
        line = [n && '부엉이가 책상 위에 편지를 두고 갔다', t && `<span class="bond tea">${esc(t.ko)}의 차 초대장이 연구실 문틈에 꽂혀 있다</span>`].filter(Boolean).join('<br>');
        label = '방으로 들어가기';
      }
      else if (!st.open && d.file && doors.needsFirst()){
        /* first visit: every door is closed and you choose the one to begin with; the professor says a word */
        const q = FIRST[d.id] || lockedLine(d.id, 0);
        line = `<span class="pick">어느 교실부터 들어가시겠습니까?</span><span class="q" lang="en">“${esc(q.en)}”</span><span class="k">${esc(q.ko)}</span>`;
        label = '이 교실로 시작'; locked = false;
      }
      /* a locked door says nothing until you try it (rattle() shows the professor's line, 2026-10-04 user decision) */
      else if (!st.open && d.file && doors.keysLeft()){
        line = `<span class="bond key">열쇠 ${doors.keysLeft()}개 · 이 문을 열 수 있다</span>`;
        label = '열쇠로 문 열기'; locked = false;
      }
      else if (!st.open){
        line = d.file ? `<span class="bond key">다음 열쇠까지 새 대사 ${doors.toNextKey()}개</span>` : '';
        label = '문이 잠겨 있다';
      }
      else if (st.loading) line = '대본을 펼치는 중…';
      else {
        const {p, g} = st;
        if (p.done || p.empty){
          line = p.done ? `오늘 수업 끝 · 내일 복습 ${g.dueTomorrow}장` : g.complete ? '모든 대사를 숙달했다' : '오늘은 복습할 대사가 없다';
          label = g.seen ? '더 도전 · 배운 대사 10문제' : '오늘 성적표 보기';
          report = !!g.seen;
        }
        stats = `<div><b>${p.review}</b>복습</div><div><b>${p.fresh}</b>새 대사</div><div><b>${g.mastered}</b>숙달 / ${g.total}</div>`;
        if (p.done || p.empty) stats = `<div><b>${g.mastered}</b>숙달 / ${g.total}</div><div><b>${g.seen}</b>배운 대사</div>`;
      }
      $('#cstats').innerHTML = stats;
      if (st.open && !st.loading && !st.me){
        const t = bond.teaReady(d.id), rq = bond.requestText(d.id);
        const extra = [rq && `<span class="bond">${esc(rq)}</span>`, t && `<button type="button" class="bond tea inv-go" data-teago="${d.id}">문틈에 초대장이 꽂혀 있다 · <span lang="en">${esc(t.title.en)}</span> →</button>`].filter(Boolean).join('');
        if (extra) line = line + extra;   // the bond lines are blocks of their own
      }
      mailCount(); invites();
      $('#cline').innerHTML = line;
      $('#cline').hidden = !line;
      $('#clink').hidden = !report;
      go.querySelector('span').textContent = label;
      go.classList.toggle('locked', locked);
      [...ticks.children].forEach((t, k) => t.classList.toggle('on', k === cur));
    };
    if (swap && !reduced()){ card.classList.add('swap'); setTimeout(() => { fill(); card.classList.remove('swap'); }, 160); }
    else fill();
  }

  /* ---------- the loop of the door in front of us */
  function playLoop(){
    secs.forEach((s, i) => {
      const v = s.querySelector('video');
      if (i === cur && !reduced()){
        if (!v.src) v.src = `${ART(DOORS[i].id)}.mp4`;
        v.play().catch(() => {});
      } else { s.classList.remove('playing'); if (v.src) v.pause(); }
    });
  }
  /* the clip fades in over the still only once frames are actually coming; if it is not ready yet, try again when it is */
  secs.forEach((s, i) => {
    const v = s.querySelector('video');
    v.addEventListener('playing', () => { if (i === cur) s.classList.add('playing'); });
    v.addEventListener('canplay', () => { if (i === cur && v.paused && !drag && !reduced()) v.play().catch(() => {}); });
    v.addEventListener('error', () => s.classList.remove('playing'));
  });

  /* ---------- moving along the wall */
  function glide(){
    cancelAnimationFrame(raf);
    if (reduced()){ pos = target; place(); playLoop(); return; }
    const tick = () => {
      pos += (target - pos) * .12;
      if (Math.abs(target - pos) < .0008){ pos = target; place(); playLoop(); return; }
      place(); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  const goTo = i => { target = Math.max(0, Math.min(DOORS.length - 1, i)); glide(); };
  stage.addEventListener('pointerdown', e => {
    if (busy) return;
    cancelAnimationFrame(raf);
    drag = {x: e.clientX, p: pos, t: performance.now(), lx: e.clientX}; vel = 0; moved = false;
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!moved && Math.abs(e.clientX - drag.x) < 6) return;
    if (!moved){ moved = true; stage.setPointerCapture(e.pointerId); secs.forEach(s => s.classList.remove('playing')); }
    const now = performance.now(), n = DOORS.length - 1;
    let p = drag.p - (e.clientX - drag.x) / step;
    if (p < 0) p *= .3; if (p > n) p = n + (p - n) * .3;
    vel = (e.clientX - drag.lx) / Math.max(1, now - drag.t); drag.lx = e.clientX; drag.t = now;
    pos = p; place();
  });
  const release = e => {
    if (!drag) return;
    const wasMove = moved; drag = null;
    if (wasMove){ goTo(Math.round(pos - vel * .4)); return; }
    /* a tap on a door: go to it, or enter it if it is already in front of us */
    const x = e.clientX - stage.getBoundingClientRect().left, i = Math.round(pos + (x - stage.clientWidth / 2) / step);
    if (i === cur) enter(cur); else if (i >= 0 && i < DOORS.length) goTo(i);
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', () => { if (drag){ drag = null; goTo(Math.round(pos)); } });
  stage.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ e.preventDefault(); goTo(target + (e.key === 'ArrowRight' ? 1 : -1)); }
    else if (e.key === 'Enter'){ e.preventDefault(); enter(cur); }
  });
  $('#cgo').addEventListener('click', () => enter(cur));
  $('#clink').addEventListener('click', () => app.go(`#/report/${DOORS[cur].id}`));
  $('#notesBtn').addEventListener('click', () => app.go('#/notes/' + (DOORS[cur].file ? DOORS[cur].id : 'snape')));
  $('#recBtn').addEventListener('click', () => app.go('#/records'));
  /* unread post: the little diamond for your own door turns gold; a tea invitation or a request shows on the professor's title card */
  function mailCount(){ ticks.children[0].classList.toggle('new', !!(bond.unread() || post.unread())); }
  /* a pending tea invitation shows as an envelope in that professor's door */
  function invites(){ DOORS.forEach((d, i) => { const e = secs[i].querySelector('.door-inv'); if (e) e.hidden = !(d.file && bond.teaReady(d.id)); }); }
  $('#cline').addEventListener('click', e => { const b = e.target.closest('[data-teago]'); if (b) app.go(`#/letters/${b.dataset.teago}/tea`); });
  bond.onPost(() => { mailCount(); if (DOORS[cur] && DOORS[cur].me) describe(false); });

  /* ---------- entering: the door's opening clip if there is one, otherwise we walk into its light */
  function rattle(){
    if (!reduced()) wall.animate([{marginLeft: '0px'}, {marginLeft: '-6px'}, {marginLeft: '5px'}, {marginLeft: '-3px'}, {marginLeft: '0px'}], {duration: 380});
    const q = lockedLine(DOORS[cur].id, knock++);
    toast(`<span class="q" lang="en">“${esc(q.en)}”</span><span class="k">${esc(q.ko)} — ${esc(DOORS[cur].ko)}</span>`, 3600, true);
  }
  async function enter(i){
    const d = DOORS[i];
    let to = '#/me';
    if (!d.me){
      if (!d.file){ rattle(); return; }
      /* a closed door: on the first visit it becomes your first classroom; later a key opens it; otherwise it stays shut */
      if (!doors.isOpen(d.id)){
        if (busy) return;
        if (doors.needsFirst()) doors.chooseFirst(d.id);
        else if (doors.keysLeft()){ doors.useKey(d.id); toast(`<span class="q" lang="en">The key turns.</span><span class="k">${esc(d.ko)}의 교실 문이 열렸다</span>`, 2600, true); }
        else { rattle(); return; }
        describe(false);
      }
      const st = status(d);
      if (busy || st.loading) return;
      const finished = st.p.done || st.p.empty;
      to = finished ? (st.g.seen ? `#/room/${d.id}/extra` : `#/report/${d.id}`) : `#/room/${d.id}`;
    }
    if (busy) return;
    dismissOwl();
    if (reduced()){ app.go(to); return; }
    busy = true; app.entering = true;
    home.classList.add('entering');
    const clip = $('#copen');
    const played = (to.startsWith('#/room') || d.me) && await new Promise(res => {
      clip.onended = () => res(true);
      clip.onerror = () => res(false);
      clip.src = `${ART(d.id)}-open.mp4`;
      clip.play().then(() => clip.classList.add('on')).catch(() => res(false));
    });
    if (!played){
      /* no clip: push in toward the door while its light floods the screen */
      veil.style.setProperty('--veil', d.glow);
      veil.style.setProperty('--veil-core', shade(d.glow, .75));
      veil.className = 'veil on';
      stage.classList.add('push');
      await new Promise(r => setTimeout(r, 1100));
    }
    app.go(to);
    requestAnimationFrame(() => { veil.className = 'veil off'; });
    home.classList.remove('entering');
    stage.classList.remove('push');
    clip.classList.remove('on'); clip.pause(); clip.removeAttribute('src');
    busy = false; app.entering = false;
  }

  $('#keysBtn').addEventListener('click', () => {
    const k = $('#keysBtn');
    if (reduced()){ app.go('#/settings'); return; }
    k.classList.remove('swing'); void k.offsetWidth; k.classList.add('swing');
    setTimeout(() => app.go('#/settings'), 380);
  });

  function show(){
    const n = srs.streak();
    $('#hDay').innerHTML = `${srs.dayLabel(srs.today())}<br>${n ? n + '일째 출석' : '오늘 첫 수업 전'}`;
    if (app.leftRoom){ const i = DOORS.findIndex(d => d.id === app.leftRoom); if (i >= 0) pos = target = i; }
    app.leftRoom = null;
    bond.daily().then(() => {
      mailCount(); describe(false);
      /* once a day an owl brings a tea invitation (js/owl.js; app.js also checks while the app stays open) */
      app.owlCheck();
    }).catch(() => {});
    size();
    describe(false);
    playLoop();
    stage.focus({preventScroll: true});
  }
  function hide(){ secs.forEach(s => { s.classList.remove('playing'); const v = s.querySelector('video'); if (v.src) v.pause(); }); }

  return {show, hide, resize: size, refresh: () => { if (cur >= 0) describe(false); }};
}
