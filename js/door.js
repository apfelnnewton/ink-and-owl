/* The castle door (2026-10-07 user decision): a newcomer must show their invitation once before coming in — a word
   the person who invited them passes on (the screen never hints that it is a spell). It is a nameplate on the door, not a lock: the app is public, so anyone set
   on it could step round. The real lock is on the friends' post: making a new group needs the same word, and the
   Firebase rules (not published with the app) check it. Guests who were already here before the door was put up
   (a name chosen, or any progress) walk straight in; if they ever make a group, they are asked for the word then.
   settings.door = true once through · settings.doorWord = the word, kept for making a group. Only a salted hash of
   the word is in this file. */
import * as store from './store.js';
import {$, esc, openSheet, closeSheet, toast, fitPaper, reduced} from './ui.js';

const HASH = 'd2a7d1d4e2b8f204952efa2ba3f5a19e76fd5597c375bc1112a666004a388cd2';
const norm = w => String(w || '').toLowerCase().replace(/[^a-z]/g, '');
async function sha(s){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function right(w){ try { return (await sha('ink-and-owl:' + norm(w))) === HASH; } catch (e){ return false; } }

const S = () => store.get().settings;
export const word = () => S().doorWord || '';
export function isOpen(){
  const s = store.get();
  if (s.settings.door) return true;
  /* here before the door: let them in and remember it */
  if (s.settings.named || Object.values(s.decks || {}).some(d => Object.keys(d.cards || {}).length)){ s.settings.door = true; store.save(); return true; }
  return false;
}
function keep(w){ const s = S(); s.door = true; s.doorWord = norm(w); store.save(); }

/* the first visit: a locked door in front of everything, until the word is said */
export function gate(done){
  if (isOpen()){ done(); return; }
  const layer = document.createElement('div');
  layer.className = 'door-gate';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'doorTtl');
  layer.innerHTML = `<div class="door-card"><div class="paperbox"></div><div class="door-in">` +
    `<div class="sh-kind"><span>성 입구</span></div>` +
    `<h2 class="sh-expr" id="doorTtl" lang="en">The door is locked.</h2>` +
    `<p class="w-lead">이 성에는 초대받은 손님만 들어올 수 있습니다. 초대장을 제시하세요.</p>` +
    `<form class="w-form" id="doorForm" autocomplete="off"><label>초대장 <input id="doorIn" lang="en" autocapitalize="off" spellcheck="false" maxlength="40"></label>` +
    `<p class="door-msg" id="doorMsg" aria-live="polite"></p>` +
    `<button type="submit" class="sh-drill"><span lang="en">Show the invitation</span> · 초대장 제시하기</button></form></div></div>`;
  document.body.appendChild(layer);
  fitPaper(layer.querySelector('.door-card'));
  const inp = layer.querySelector('#doorIn'), msg = layer.querySelector('#doorMsg'), card = layer.querySelector('.door-card');
  let tries = 0;
  layer.querySelector('#doorForm').addEventListener('submit', async e => {
    e.preventDefault();
    const w = inp.value.trim(); if (!w) return;
    if (await right(w)){
      keep(w);
      layer.classList.add('open');
      toast(`<span class="q" lang="en">Welcome to the castle.</span><span class="k">문지기가 초대장을 확인하고 문을 엽니다.</span>`, 2600, true);
      setTimeout(() => { layer.remove(); done(); }, reduced() ? 0 : 700);
      return;
    }
    tries++;
    msg.textContent = tries < 3 ? '문지기가 고개를 젓습니다. 초대장이 맞지 않습니다.' : '문지기가 고개를 젓습니다. 초대한 사람에게 초대장을 다시 물어보세요.';
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    inp.select();
  });
  setTimeout(() => inp.focus({preventScroll: true}), 300);
}

/* making a group without the word (a guest from before the door): ask once, on a slip */
export function ask(done){
  if (word()){ done(); return; }
  openSheet(`<div class="sh-kind"><span>새 그룹 만들기</span></div>` +
    `<h2 class="sh-expr" id="shTitle" lang="en">The password, please.</h2>` +
    `<p class="w-lead">새 그룹은 암호를 아는 사람만 만들 수 있습니다. 한 번만 쓰면 이 기기가 기억합니다.</p>` +
    `<form class="w-form" id="doorAsk" autocomplete="off"><label>암호 <input id="doorAskIn" lang="en" autocapitalize="off" spellcheck="false" maxlength="40"></label>` +
    `<p class="door-msg" id="doorAskMsg" aria-live="polite"></p><button type="submit" class="sh-drill">그룹 만들기</button></form>`);
  $('#doorAsk').addEventListener('submit', async e => {
    e.preventDefault();
    const w = $('#doorAskIn').value.trim(); if (!w) return;
    if (!(await right(w))){ $('#doorAskMsg').textContent = '암호가 맞지 않습니다.'; return; }
    keep(w); closeSheet(); done();
  });
  setTimeout(() => { const i = $('#doorAskIn'); if (i) i.focus({preventScroll: true}); }, 350);
}
