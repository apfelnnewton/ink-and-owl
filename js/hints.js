/* Dumbledore's notes (2026-10-04 user decision): the first time a guest meets each part of the castle, a small slip
   of parchment rises from the bottom with one line from the host — English, then Korean (하게체), signed A.D. Each is
   shown once (state.hints[id]). The welcome letter (bond.js W00) gives the whole picture; these come just in time.
   A note waits while an owl is flying or a slip of paper is open; letter and request notes also wait out a lesson. */
import * as store from './store.js';
import {esc, isSheetOpen} from './ui.js';

const NOTES = {
  lesson: {en: 'New lines come first, with their meanings. Old ones return to be remembered, and the better you remember them, the longer they stay away.',
    ko: '새 대사는 뜻과 함께 먼저 익히게. 지난 대사는 다시 떠올려 답하는 걸세. 잘 기억할수록 다음에는 더 늦게 돌아온다네.'},
  letter: {en: 'Your first letter! The more you study, the more often they will come. I shall keep them on your desk.',
    ko: '첫 편지로군! 공부할수록 더 자주 올 걸세. 자네 방 책상 위에 모아 두겠네.', calm: true},
  tea: {en: 'A word before you sit down: your answers matter. Every professor has replies they like better than others.',
    ko: '앉기 전에 한마디 하겠네. 자네의 대답이 중요하다네. 교수마다 반기는 대답이 따로 있거든. 마음에 드는 답이면 사이가 가까워지고, 언짢은 답이면 조금 멀어진다네.'},
  request: {en: 'A professor has asked a favour. Practise the lines they named before the time runs out, and they will not forget it.',
    ko: '교수가 부탁을 했군. 그 교수가 고른 대사를 기한 안에 연습하면, 잊지 않고 고마워할 걸세.', calm: true},
  prior: {en: 'Your wand remembers. Before each lesson it will show you the echoes of what you said last time, with a word or two gone missing. Fill them in, or wave them away. Either way, the lesson will wait for you.',
    ko: '자네 지팡이는 기억하고 있다네. 수업 전마다 지난번에 자네가 한 말의 메아리를 보여 줄 걸세. 한두 단어가 빠진 채로 말이지. 채워 넣어도 좋고, 손을 저어 흩어 버려도 좋네. 어느 쪽이든 수업은 자네를 기다릴 걸세.'},
  key: {en: 'A key! Any locked door in the corridor will take it. Choose wisely, or at least cheerfully.',
    ko: '열쇠가 생겼군! 복도의 잠긴 문 어디에나 맞는다네. 현명하게, 아니면 적어도 즐겁게 고르게.', calm: true}
};

const seen = () => { const s = store.get(); return s.hints || (s.hints = {}); };
export const hintSeen = id => !!seen()[id];

let queue = [], showing = false;
/* show note `id` once; `then` runs when it is closed (at once if it was seen before). Returns true if it will show. */
export function hint(id, then){
  if (!NOTES[id] || seen()[id] || queue.some(q => q.id === id)){ if (then) then(); return false; }
  queue.push({id, then});
  pump();
  return true;
}

function pump(){
  if (showing || !queue.length) return;
  const q = queue[0], n = NOTES[q.id];
  const busy = document.querySelector('.owl-layer') || isSheetOpen() || (n.calm && /^#\/room\//.test(location.hash));
  if (busy){ setTimeout(pump, 1500); return; }
  queue.shift();
  showing = true;
  seen()[q.id] = new Date().toISOString().slice(0, 10);
  store.save();
  const el = document.createElement('div');
  el.className = 'ad-note';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '덤블도어의 쪽지');
  el.innerHTML = `<div class="ad-slip"><div class="paperbox parch"></div>` +
    `<p class="en" lang="en">${esc(n.en)}</p><p class="ko">${esc(n.ko)}</p><p class="sig" lang="en">— A.D.</p>` +
    `<button type="button" class="sh-drill">알겠습니다</button></div>`;
  document.body.appendChild(el);
  const btn = el.querySelector('button');
  requestAnimationFrame(() => el.classList.add('up'));
  setTimeout(() => btn.focus({preventScroll: true}), 350);
  btn.addEventListener('click', () => {
    el.classList.remove('up');
    setTimeout(() => { el.remove(); showing = false; if (q.then) q.then(); pump(); }, 300);
  });
}
