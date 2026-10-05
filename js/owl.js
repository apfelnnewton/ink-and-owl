/* The owl with the tea invitation (2026-10-04 user decision): once a day an owl crosses the top of whatever screen is
   open and lets go of an envelope; the envelope tumbles down and lands in the middle, sealed with the professor's wax.
   Tap it and the seal breaks and the invitation card comes up: accept → straight to tea; later → it waits in the post
   until midnight (bond.js turns it into a cold-tea note after that).
   The same owl brings a friend's letter (post.js), sealed with the friend's own seal: open it → the letter, with a
   pen to answer; later → it waits in the post under "친구".
   The owl is a clip with a transparent background: WebM (VP9 alpha) where it works, an animated WebP on Safari. */
import {byId} from './decks.js';
import * as bond from './bond.js';
import * as post from './post.js';
import * as wand from './wand.js';
import {compose, paras} from './friends.js';
import {esc, reduced, toast} from './ui.js';

/* the clip (5 s, played 1.3× = 3.9 s): the owl hovers left of centre, lets go at ~1.8 s, and the envelope leaves the bottom
   of the frame at 4.25 s, 36% across. The whole clip is slid left→right so the owl crosses the screen. */
const RATE = 1.3, LEN = 5.04 / RATE, DROP = {at: 4.25 / RATE, x: .36}, OWL0 = .25, OWL1 = .62;
const SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
let busy = false, hush = null;

export const owlBusy = () => busy;
/* a door is opening: an owl still in the air or an envelope still unopened goes quietly to the post (no note) */
export const dismissOwl = () => { if (hush) hush(); };

/* the owl's flight and the falling envelope for a letter that is read elsewhere (no card on the spot): open() runs
   when the envelope is tapped. (deliver() below keeps its own copy because its card opens inside the layer.) */
function fly(app, {sealCls, label, en, waits, open}){
  busy = true;
  const layer = document.createElement('div');
  layer.className = 'owl-layer';
  layer.innerHTML =
    `<div class="owl-sky"></div>` +
    `<button type="button" class="owl-env" aria-label="${label} 열기"><img src="assets/owl/envelope.webp" alt=""><i class="seal ${sealCls}"></i></button>` +
    `<p class="owl-cap" aria-live="polite"><span lang="en">${en}</span><b>${label}</b><button type="button" class="owl-later">나중에 열기</button></p>`;
  document.body.appendChild(layer);
  const env = layer.querySelector('.owl-env'), sky = layer.querySelector('.owl-sky');
  const land = () => { layer.classList.add('landed'); env.focus({preventScroll: true}); };
  const fall = () => {
    const w = sky.getBoundingClientRect(), x = w.left + w.width * DROP.x;
    env.style.setProperty('--x0', `${x - innerWidth / 2}px`);
    env.style.setProperty('--y0', `${w.bottom - innerHeight / 2}px`);
    layer.classList.add('falling');
    env.addEventListener('animationend', land, {once: true});
  };
  if (reduced()){ layer.classList.add('still'); land(); }
  else {
    let clip;
    if (SAFARI){ clip = new Image(); clip.src = 'assets/owl/owl.webp?' + Date.now(); clip.alt = ''; }
    else { clip = document.createElement('video'); clip.muted = true; clip.playsInline = true; clip.src = 'assets/owl/owl.webm'; }
    clip.className = 'owl-clip';
    sky.appendChild(clip);
    let started = false;
    const go = () => {
      if (started) return; started = true;
      const W = sky.offsetWidth, left0 = innerWidth / 2 - W / 2;
      sky.style.setProperty('--fx0', `${-0.14 * W - OWL0 * W - left0}px`);
      sky.style.setProperty('--fx1', `${innerWidth + 0.16 * W - OWL1 * W - left0}px`);
      sky.style.setProperty('--len', `${LEN}s`);
      layer.classList.add('flying');
      setTimeout(fall, DROP.at * 1000);
      if (clip.play){ clip.playbackRate = RATE; clip.play().catch(() => {}); }
      setTimeout(() => sky.classList.add('gone'), LEN * 1000);
    };
    const skip = () => { if (started) return; started = true; layer.classList.add('still'); land(); };
    if (SAFARI){ clip.onload = go; clip.onerror = skip; } else { clip.oncanplay = go; clip.onerror = skip; }
    setTimeout(skip, 6000);
  }
  const close = () => { hush = null; removeEventListener('hashchange', away); layer.classList.add('closing'); setTimeout(() => { layer.remove(); busy = false; app.refreshMail && app.refreshMail(); }, 350); };
  hush = () => { if (!layer.classList.contains('open')) close(); };
  const away = () => { close(); toast(waits, 3000, true); };
  addEventListener('hashchange', away);
  layer.querySelector('.owl-later').addEventListener('click', () => { close(); toast(waits, 3000, true); });
  env.addEventListener('click', () => { if (layer.classList.contains('open')) return; layer.classList.add('open'); removeEventListener('hashchange', away); setTimeout(() => { close(); open(); }, reduced() ? 0 : 380); });
}

/* a professor's letter by owl: it is in the post from the moment the owl sets off; tapping the envelope reads it there */
function deliverNote(app, {deck, key}){
  const who = byId(deck);
  if (key === 'W00') bond.postWelcome();
  fly(app, {sealCls: `s-${deck}`, label: `${esc(who.ko)}의 편지`, en: 'An owl brings a letter.',
    waits: `${esc(who.ko)}의 편지는 내 방 <b>편지함</b>에 있습니다.`,
    open: () => app.go(`#/letters/${deck}/${key}`)});
}

/* Ollivander's note (wand.js): it is kept in the wand box in my room from the moment the owl sets off; opening the
   envelope goes straight to the shop */
export function deliverWandNote(app){
  if (busy) return;
  wand.markNote();
  fly(app, {sealCls: 'o-wand', label: '올리밴더의 쪽지', en: 'An owl brings a note.',
    waits: '올리밴더의 쪽지는 내 방 <b>지팡이</b> 칸에 있습니다.',
    open: () => app.go('#/ollivander')});
}

/* inv: a tea invitation ({id, invite, …} from bond.owlDue), {letter} — a friend's letter from post.undelivered — or
   {note: {deck, key}} — a professor's letter brought by hand (the welcome): opening it reads it in the post */
export function deliver(app, inv){
  if (busy || !inv) return;
  if (inv.note) return deliverNote(app, inv.note);
  busy = true;
  const letter = inv.letter || null;
  const from = letter ? post.memberOf(letter.from) : null, who = letter ? null : byId(inv.id);
  if (letter) post.markSeen(letter.id);
  const sealCls = letter ? `p-${esc(from.seal)}` : `s-${inv.id}`;
  const label = letter ? `${esc(from.name)}의 편지` : `${esc(who.ko)}의 차 초대장`;
  const waits = letter ? `${esc(from.name)}의 편지는 편지함 <b>친구</b> 칸에 있습니다.` : `초대장은 오늘 밤까지 ${esc(who.ko)} 연구실 <b>문틈</b>과 <b>차 일지</b>에 있습니다.`;
  const layer = document.createElement('div');
  layer.className = 'owl-layer';
  layer.innerHTML =
    `<div class="owl-sky"></div>` +
    `<button type="button" class="owl-env" aria-label="${label} 열기"><img src="assets/owl/envelope.webp" alt=""><i class="seal ${sealCls}"></i></button>` +
    `<p class="owl-cap" aria-live="polite"><span lang="en">${letter ? 'An owl brings a letter.' : 'An owl brings an invitation.'}</span><b>${label}</b><button type="button" class="owl-later">나중에 열기</button></p>`;
  document.body.appendChild(layer);
  const env = layer.querySelector('.owl-env'), sky = layer.querySelector('.owl-sky');

  const land = () => { layer.classList.add('landed'); env.focus({preventScroll: true}); };
  const fall = () => {
    const w = sky.getBoundingClientRect(), x = w.left + w.width * DROP.x;
    env.style.setProperty('--x0', `${x - innerWidth / 2}px`);
    env.style.setProperty('--y0', `${w.bottom - innerHeight / 2}px`);
    layer.classList.add('falling');
    env.addEventListener('animationend', land, {once: true});
  };

  if (reduced()){ layer.classList.add('still'); land(); }
  else {
    let clip;
    if (SAFARI){ clip = new Image(); clip.src = 'assets/owl/owl.webp?' + Date.now(); clip.alt = ''; }
    else { clip = document.createElement('video'); clip.muted = true; clip.playsInline = true; clip.src = 'assets/owl/owl.webm'; }
    clip.className = 'owl-clip';
    sky.appendChild(clip);
    let started = false;
    const go = () => {
      if (started) return; started = true;
      /* slide the clip so the owl enters from beyond the left edge and leaves beyond the right */
      const W = sky.offsetWidth, left0 = innerWidth / 2 - W / 2;
      sky.style.setProperty('--fx0', `${-0.14 * W - OWL0 * W - left0}px`);
      sky.style.setProperty('--fx1', `${innerWidth + 0.16 * W - OWL1 * W - left0}px`);
      sky.style.setProperty('--len', `${LEN}s`);
      layer.classList.add('flying');
      setTimeout(fall, DROP.at * 1000);
      if (clip.play){ clip.playbackRate = RATE; clip.play().catch(() => {}); }
      setTimeout(() => sky.classList.add('gone'), LEN * 1000);
    };
    const skip = () => { if (started) return; started = true; layer.classList.add('still'); land(); };
    if (SAFARI){ clip.onload = go; clip.onerror = skip; } else { clip.oncanplay = go; clip.onerror = skip; }
    setTimeout(skip, 6000);   // a clip that never loads must not hold the envelope back
  }

  hush = () => { if (!layer.classList.contains('open')) close(); };
  const close = () => { hush = null; removeEventListener('hashchange', away); layer.classList.add('closing'); setTimeout(() => { layer.remove(); busy = false; app.refreshMail && app.refreshMail(); }, 350); };
  /* walked off to a lesson (or anywhere) before opening it: the envelope goes to the post and waits there */
  const away = () => { if (!/^#\/letters\/[a-z]+\/tea/.test(location.hash)){ close(); toast(waits, 3000, true); } };
  addEventListener('hashchange', away);
  layer.querySelector('.owl-later').addEventListener('click', () => { close(); toast(waits, 3000, true); });

  env.addEventListener('click', () => {
    if (layer.classList.contains('open')) return;
    layer.classList.add('open');
    const card = document.createElement('div');
    card.className = 'owl-card' + (letter ? ' letter' : '');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', label);
    card.innerHTML = letter
      ? `<div class="owl-card-in"><i class="seal ${sealCls}"></i><p class="kind">부엉이 편지 · <span lang="en">${esc(from.name)}</span></p>` +
        `<div class="en ow-letter" lang="en">${paras(letter.text)}</div>` +
        `<div class="owl-btns"><button type="button" class="yes"><span lang="en">Write back</span><small>답장 쓰기</small></button>` +
        `<button type="button" class="no"><span lang="en">Fold it away</span><small>편지함 친구 칸에 둡니다</small></button></div></div>`
      : `<div class="owl-card-in"><i class="seal ${sealCls}"></i><p class="kind">차 초대장 · ${esc(who.ko)}</p>` +
        `<p class="en" lang="en">${esc(bond.fill(inv.invite.en))}</p><p class="ko">${esc(bond.fill(inv.invite.ko))}</p>` +
        `<div class="owl-btns"><button type="button" class="yes"><span lang="en">I'd be delighted.</span><small>기꺼이 가겠습니다</small></button>` +
        `<button type="button" class="no"><span lang="en">Another time, perhaps.</span><small>오늘 밤까지 문틈에 꽂아 둡니다</small></button></div></div>`;
    layer.appendChild(card);
    if (letter) post.markRead(letter.id);
    setTimeout(() => card.classList.add('up'), reduced() ? 0 : 420);
    card.querySelector('.yes').addEventListener('click', () => { close(); if (letter) compose(letter.from, app); else app.go(`#/letters/${inv.id}/tea`); });
    card.querySelector('.no').addEventListener('click', close);
    setTimeout(() => card.querySelector('.yes').focus({preventScroll: true}), 700);
  });
}
