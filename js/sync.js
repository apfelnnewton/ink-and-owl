/* The caretaker's own devices keep one progress between them (2026-10-12, user decision): when it happens, and what the
   ledger says about it. The workings are in sync-core.js. Only a device enrolled as the caretaker's (census.js) takes part;
   every other device keeps its progress to itself, as before.
   It matches: a moment after the app opens · whenever the app comes to the front or goes to the back · a few seconds after
   arriving on a screen · every four minutes while open. A match that has nothing to do costs one read.
   When another device's progress has been folded in, the page reloads at a calm moment (the corridor or your room, nothing open)
   so that every screen is drawn from it — never in the middle of a lesson.
   ?practice: off. On a development address: off unless ?census is there. */
import * as store from './store.js';
import * as post from './post.js';
import {device} from './census.js';
import {makeSync, mendRegister} from './sync-core.js';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /\.(localhost|test)$/.test(location.hostname);
export const on = () => !!(store.get().census || {}).master && !post.practiceMode() && (!LOCAL || new URLSearchParams(location.search).has('census'));
const core = makeSync({store, server: () => post.server(), device});
let app = null, stale = false, again = false, listeners = [];
const swap = () => { if (stale && app && app.calm()){ stale = false; location.reload(); } };

/* before a device's first match, its progress as it stood is set aside on the device itself (never sent anywhere): if the
   folding ever went wrong, it could be put back by hand */
const KEEP = 'hogwarts-english:before-sync';
function setAside(){ try { if (!localStorage.getItem(KEEP)) localStorage.setItem(KEEP, JSON.stringify({kept: new Date().toISOString(), state: store.get()})); } catch (e){} }
/* The maker's register, put right once on each of the maker's devices (2026-10-13, at the maker's word: no day was missed). The register
   read 4–10 October, nothing on the 11th, then the 12th: the lesson of the 11th ran past midnight during a night of work on this app and
   was entered under the 12th, and seven days in a row became one. The day is put back as a day; the count follows from the register. */
const LOST = ['2026-10-11'];
function putBack(){ const c = core.state(); if (c.mend) return false; const did = mendRegister(store, LOST, new Date().toISOString().slice(0, 10)); c.mend = 1; store.save(); return did; }
/* 30 Sickles into the maker's purse (2026-10-20, at the maker's word: to buy Chocolate Frogs and send cards to the other
   players). Given once across all the maker's devices, after a match has brought in what the others hold: the mark is kept
   in the shop record, which travels between them, so a device that has already had the news does not give it again. */
const GIFT = {id: '2026-10-20-frogs', knuts: 30 * 29};
function giveOnce(){
  const s = store.get(), m = s.shop || (s.shop = {}), g = m.gift || (m.gift = {});
  if (g[GIFT.id]) return false;
  s.purse = (s.purse || 0) + GIFT.knuts; g[GIFT.id] = new Date().toISOString().slice(0, 10); store.save(); return true;
}
const LESSON = ['room', 'spell', 'ollivander', 'potion'];   // a lesson is not disturbed: the day's session must not change under it

export async function run(){
  if (!on() || navigator.onLine === false) return null;
  if (app && LESSON.includes(app.screen())) return null;
  if (core.busy()){ again = true; return null; }
  if (!core.state().k) setAside();
  if (putBack()) stale = true;   // the screens still show the old count
  const r = await core.run();
  if (r.changed) stale = true;
  if (r.ok && giveOnce()){ stale = true; again = true; }   // the next match stamps it and sends it to the other devices
  swap();
  listeners.forEach(fn => { try { fn(r); } catch (e){} });
  if (again){ again = false; setTimeout(run, 1500); }
  return r;
}
export const onRun = fn => { listeners.push(fn); };
/* before the day's checks (bond.daily): a match first, so that what was done on another device is known before anything
   is judged (2026-10-20: the phone, opened before it had heard that Snape's request was done on the laptop the day before,
   judged it failed and wrote the letters for it — store.js settleOnce). A few seconds at most; offline, the checks go ahead. */
export async function fresh(){
  if (!on() || navigator.onLine === false) return;
  const t0 = Date.now(); while (core.busy() && Date.now() - t0 < 6000) await new Promise(r => setTimeout(r, 150));
  if (core.state().at && Date.now() - core.state().at < 20000) return;   // matched a moment ago
  await Promise.race([run(), new Promise(r => setTimeout(r, 6000))]);
}

/* for the ledger: where this device stands */
export function status(){
  const c = core.state(), h = core.head();
  const t = c.at ? new Date(c.at) : null, when = t ? `${t.getMonth() + 1}월 ${t.getDate()}일 ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : '';
  const kb = n => n ? (n < 1024 ? '1KB 미만' : Math.round(n / 1024) + 'KB') : '';
  return {
    on: on(), when, err: c.err || '', size: kb((h && h.size) || c.size),
    parts: h ? h.n : 0, by: h ? (h.mine ? '이 기기' : h.dev || '다른 기기') : '',
    note: c.err === 'denied' ? '서버가 거절했습니다. 보안 규칙이 게시됐는지 확인해 주세요.' : c.err === 'unzip' ? '이 브라우저는 서버의 사본을 풀 수 없습니다(오래된 브라우저).' : c.err === 'net' ? '서버에 닿지 못했습니다. 다음에 다시 맞춥니다.' : ''
  };
}

/* "the server is the reference" (2026-10-20, user: the caretaker's devices are always online): a change is sent a few seconds after
   it is saved, and a new screen asks for the other devices' news almost at once — so the laptop and the phone work on what is in
   effect one copy, and the joining rules only matter when both are used at the very same moment. Saves made by a match itself
   (and by a lesson, which waits for its end) do not start another. */
export function init(a){
  app = a;
  setTimeout(run, 2500);
  document.addEventListener('visibilitychange', () => { run(); if (!document.hidden) swap(); });
  let t = 0, p = 0;
  window.addEventListener('hashchange', () => { setTimeout(swap, 400); clearTimeout(t); t = setTimeout(run, 800); });
  store.whenSaved(() => { if (!on() || core.busy()) return; clearTimeout(p); p = setTimeout(run, 3000); });
  setInterval(() => { if (!document.hidden) run(); }, 90000);
}
