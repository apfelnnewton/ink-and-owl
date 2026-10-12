/* The caretaker's ledger (2026-10-12, user decision): which devices have come into the castle.
   Every device that is past the door (door.js) writes one small record of itself, at most once a day and only when the
   network is there: users/{uid} = {name, first, last, study, at, v, dev, days, streak, learnt, level, doors, has, group, seal}.
   Nothing that was answered or written goes up — no answers, no letters, no words of the door. Offline, or with the rules
   not yet published, it fails quietly and tries again another day; the lessons never wait for it.
   Only a device enrolled as the caretaker's can read the ledger: it writes masters/{uid} with a word that the security
   rules alone know (firestore.rules — typed by the maker, never kept in this code or in the public repository).
   The way in is hidden: five taps on the version line at the foot of the settings.
   state.census = {uid, d: last day reported, v: version reported, master: this device may read the ledger}
   ?practice shows made-up rows and reports nothing. On a development address nothing is reported unless ?census is there. */
import * as store from './store.js';
import * as srs from './srs.js';
import * as post from './post.js';
import * as door from './door.js';
import {PROFS} from './decks.js';
import {$, esc, toast, fitPaper, openSheet, closeSheet} from './ui.js';

const st = () => { const s = store.get(); return s.census || (s.census = {}); };
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /\.(localhost|test)$/.test(location.hostname);
const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;   // the real day (srs.today can be moved by ?date)
const ago = (a, b = day()) => Math.round((new Date(b) - new Date(a)) / 864e5);

/* the copy of the app this device runs: the name of the service worker's cache (sw.js VERSION) */
async function version(){ try { return (await caches.keys()).filter(k => /^he-[0-9a-z-]+$/.test(k)).sort().pop() || ''; } catch (e){ return ''; } }
function device(){
  const u = navigator.userAgent, touch = navigator.maxTouchPoints > 1;
  const kind = /iPhone|iPod/.test(u) ? 'iPhone' : /iPad/.test(u) || (/Macintosh/.test(u) && touch) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Macintosh/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'other';
  let home = false; try { home = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e){}
  return kind + (home ? ' app' : '');
}
/* what the ledger is told: how far, never what */
export function summary(){
  const s = store.get(), g = s.settings, k = s.streak || {}, today = day(), has = [];
  const on = (name, yes) => { if (yes) has.push(name); };
  on('wand', s.wand && s.wand.wood); on('spells', Object.keys((s.spells || {}).learnt || {}).length); on('map', (s.map || {}).got);
  on('prophet', ((s.prophet || {}).got || []).length); on('need', (s.need || {}).open); on('fire', (s.fire || {}).open);
  on('manor', (s.manor || {}).open); on('shops', (s.shop || {}).open); on('bella', ((s.manor || {}).bella || {}).open);
  const open = (s.doors || {}).open || [];
  return {
    name: [g.firstName, g.surname].map(x => String(x || '').trim()).filter(Boolean).join(' ').slice(0, 50),
    study: /^\d{4}-\d\d-\d\d$/.test(k.last || '') ? k.last : '',
    dev: device(), level: srs.level(),
    days: Math.min(99999, Object.keys(s.log || {}).length),
    streak: k.last && ago(k.last, today) <= 1 ? Math.min(99999, +k.n || 0) : 0,
    learnt: Math.min(99999, Object.values(s.decks || {}).reduce((n, d) => n + Object.keys((d && d.cards) || {}).length, 0)),
    doors: PROFS.map(p => p.id).filter(id => open.includes(id)), has,
    group: post.inGroup() && post.codeOk(post.code() || '') ? post.code() : '', seal: post.inGroup() ? String(post.mySeal() || '').slice(0, 12) : ''
  };
}
let busy = false;
export async function checkIn(){
  if (busy || !door.isOpen() || post.practiceMode() || navigator.onLine === false) return;
  if (LOCAL && !new URLSearchParams(location.search).has('census')) return;
  busy = true;
  try {
    const c = st(), v = await version(), today = day();
    if (c.d === today && c.v === v) return;
    const {F, db, uid} = await post.server(), ref = F.doc(db, 'users', uid), data = {...summary(), v, last: today, at: F.serverTimestamp()};
    /* `first` is written once and kept: a device this copy of the progress has not reported from before asks the ledger whether it is known */
    let fresh = c.uid !== uid;
    if (fresh) fresh = !(await F.getDoc(ref)).exists();
    try { await F.setDoc(ref, fresh ? {...data, first: today} : data, {merge: true}); }
    catch (e){ if (fresh) throw e; await F.setDoc(ref, {...data, first: today}, {merge: true}); }   // its line was struck from the ledger: it signs in anew
    c.uid = uid; c.d = today; c.v = v; store.save();
  } catch (e){ /* no network, the library out of reach, the rules not published yet: another day */ }
  finally { busy = false; }
}

/* ---------- the caretaker's side */
export const isMaster = () => !!st().master;
async function enroll(word){
  const {F, db, uid} = await post.server();
  await F.setDoc(F.doc(db, 'masters', uid), {k: String(word).trim().toLowerCase(), t: F.serverTimestamp()});
  st().master = true; store.save();
}
const FAKE = () => { const t = day(), d = n => day(new Date(Date.now() - n * 864e5)); return {uid: 'me', v: 'he-2026-10-12q', list: [
  {uid: 'me', name: 'Robin Vale', first: d(40), last: t, study: t, v: 'he-2026-10-12q', dev: 'Windows', days: 22, streak: 4, learnt: 131, level: 'mid', doors: ['lupin', 'snape', 'dumbledore'], has: ['wand', 'spells', 'map', 'prophet', 'fire', 'manor', 'shops', 'bella'], group: 'ABCDEF', seal: 'lion'},
  {uid: 'a', name: 'Clara', first: d(31), last: d(1), study: d(1), v: 'he-2026-10-12q', dev: 'iPhone app', days: 19, streak: 6, learnt: 84, level: 'low', doors: ['mcgonagall', 'lupin'], has: ['wand', 'map', 'fire'], group: 'ABCDEF', seal: 'eagle'},
  {uid: 'b', name: 'Theo Marsh', first: d(25), last: d(6), study: d(9), v: 'he-2026-10-12k', dev: 'iPad', days: 7, streak: 0, learnt: 33, level: 'mid', doors: ['slughorn'], has: ['wand'], group: '', seal: ''},
  {uid: 'c', name: '', first: d(2), last: d(2), study: '', v: 'he-2026-10-12p', dev: 'Android', days: 0, streak: 0, learnt: 0, level: 'mid', doors: [], has: [], group: '', seal: ''},
  {uid: 'd', name: 'Iris', first: d(3), last: t, study: t, v: 'he-2026-10-12q', dev: 'iPhone', days: 3, streak: 3, learnt: 14, level: 'high', doors: ['snape'], has: ['wand'], group: 'ABCDEF', seal: 'badger'}]}; };
async function rows(){
  if (post.practiceMode()) return FAKE();
  const {F, db, uid} = await post.server(), snap = await F.getDocs(F.collection(db, 'users'));
  return {uid, v: await version(), list: snap.docs.map(d => ({uid: d.id, ...d.data()}))};
}
async function strike(id){ if (post.practiceMode()) return; const {F, db} = await post.server(); await F.deleteDoc(F.doc(db, 'users', id)); }

const HAS = {wand: '지팡이', spells: '주문', map: '지도', prophet: '신문', need: '필요의 방', fire: '벽난로', manor: '저택', shops: '가게', bella: '응접실'};
const LV = {low: '하', mid: '중', high: '상'};
const when = d => { if (!/^\d{4}-\d\d-\d\d$/.test(d || '')) return '—'; const n = ago(d); return n <= 0 ? '오늘' : n === 1 ? '어제' : n < 31 ? `${n}일 전` : `${+d.slice(5, 7)}월 ${+d.slice(8)}일`; };
const date = d => /^\d{4}-\d\d-\d\d$/.test(d || '') ? `${+d.slice(5, 7)}월 ${+d.slice(8)}일` : '—';

export function initLedger(app){
  const sec = $('#ledger'), body = $('#ledBody');
  fitPaper($('#ledBook'));
  let data = null, taps = 0, tapAt = 0;

  const row = (r, me, latest) => {
    const doors = (r.doors || []).map(id => { const p = PROFS.find(x => x.id === id); return p ? p.ko.replace(/ 교수$/, '') : ''; }).filter(Boolean);
    const has = (r.has || []).map(k => HAS[k]).filter(Boolean), old = r.v && latest && r.v !== latest;
    return `<li class="led-row"><div class="led-top"><b${r.name ? ' lang="en"' : ''}>${r.name ? esc(r.name) : '이름 없음'}</b>${r.uid === me ? '<i>이 기기</i>' : ''}<span>${esc(when(r.last))}</span></div>` +
      `<p class="led-meta">${esc(r.dev || '—')} · <span class="${old ? 'old' : ''}">${esc(r.v || '판 모름')}</span> · 처음 온 날 ${esc(date(r.first))}${r.group ? ` · 그룹 ${esc(r.group)}${r.seal ? ' ' + esc((post.sealOf(r.seal) || {}).ko || r.seal) : ''}` : ''}</p>` +
      `<p class="led-num">공부한 날 <b>${+r.days || 0}</b> · 연속 <b>${+r.streak || 0}</b> · 배운 대사 <b>${+r.learnt || 0}</b> · 난이도 ${LV[r.level] || '—'} · 마지막 공부 ${esc(when(r.study))}</p>` +
      `<p class="led-has">${doors.length ? `문 ${doors.length} <em>${esc(doors.join(' · '))}</em>` : '문을 아직 열지 않음'}${has.length ? ` · ${esc(has.join(' · '))}` : ''}</p>` +
      (r.uid === me ? '' : `<button type="button" class="led-strike" data-strike="${esc(r.uid)}">이 줄 지우기</button>`) + '</li>';
  };
  function draw(){
    if (!data){ body.innerHTML = '<p class="led-note">장부를 펼치는 중…</p>'; return; }
    if (data.error){ body.innerHTML = `<p class="led-note">${esc(data.error)}</p><button type="button" class="led-again" data-again>다시 펼치기</button>`; return; }
    const list = data.list.slice().sort((a, b) => (b.last || '').localeCompare(a.last || '') || (a.name || '').localeCompare(b.name || ''));
    const latest = list.map(r => r.v || '').concat(data.v || '').sort().pop(), isNew = r => /^\d{4}/.test(r.first || '') && ago(r.first) <= 7;
    const fresh = list.filter(isNew), rest = list.filter(r => !isNew(r)), behind = list.filter(r => r.v && r.v !== latest).length;
    const part = (title, sub, rs) => rs.length ? `<h3 class="led-h">${title}<small>${sub}</small></h3><ol class="led-list">${rs.map(r => row(r, data.uid, latest)).join('')}</ol>` : '';
    body.innerHTML = `<header class="led-head"><h2 lang="en">The Caretaker's Ledger</h2><p>성에 들어온 기기 <b>${list.length}</b>대 · 오늘 연 기기 <b>${list.filter(r => r.last === day()).length}</b>대${behind ? ` · 옛 판 <b>${behind}</b>대` : ''}</p>` +
      `<p class="led-sub">한 줄이 한 기기입니다. 같은 사람이 폰과 태블릿을 쓰면 두 줄로 보입니다. 최신 판 ${esc(latest || '—')}</p></header>` +
      part('새 얼굴', '처음 온 지 이레가 안 된 기기', fresh) + part('드나드는 기기', '마지막으로 연 날 순서', rest) +
      (list.length ? '' : '<p class="led-note">아직 아무도 적히지 않았습니다. 새 판을 받은 기기가 앱을 열면 한 줄씩 생깁니다.</p>');
  }
  async function load(){
    data = null; draw();
    try { data = await rows(); }
    catch (e){
      const denied = e && /permission|insufficient/i.test(String(e.code || '') + String(e.message || ''));
      if (denied){ st().master = false; store.save(); }
      data = {error: denied ? '이 기기는 장부를 볼 수 없습니다. 보안 규칙이 게시됐는지, 이 기기가 등록됐는지 확인해 주세요.' : '장부에 닿지 못했습니다. 인터넷 연결을 확인해 주세요.'};
    }
    if (!sec.hidden) draw();
  }
  body.addEventListener('click', async e => {
    if (e.target.closest('[data-again]')){ load(); return; }
    const b = e.target.closest('[data-strike]'); if (!b || !data || !data.list) return;
    const r = data.list.find(x => x.uid === b.dataset.strike); if (!r) return;
    if (!confirm(`${r.name || '이름 없는 기기'} (${r.dev || '기기'})의 줄을 장부에서 지웁니다. 그 기기가 앱을 다시 열면 새 줄이 생깁니다. 지울까요?`)) return;
    b.disabled = true;
    try { await strike(r.uid); data.list = data.list.filter(x => x.uid !== r.uid); draw(); }
    catch (err){ b.disabled = false; toast('지우지 못했습니다. 인터넷 연결을 확인해 주세요.'); }
  });
  $('#ledBack').addEventListener('click', () => app.go('#/settings'));
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape') app.go('#/settings'); });

  /* the way in, on the settings board: a line for the caretaker's device; for any other, five quick taps on the version line ask for the word */
  const line = () => { const el = $('#fLedger'); if (el) el.hidden = !isMaster() && !post.practiceMode(); };
  const askWord = () => openSheet(`<div class="sh-kind"><span>관리인 장부</span></div><h2 class="sh-expr" id="shTitle" lang="en">The Caretaker's Ledger</h2>` +
    `<p class="w-lead">이 기기를 관리 기기로 등록합니다. 관리용 암호를 적어 주세요.</p>` +
    `<input class="led-word" id="ledWord" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="관리용 암호">` +
    `<button type="button" class="sh-drill" data-led-enroll>등록</button>`);
  $('#fVer').addEventListener('click', () => {
    const now = Date.now(); taps = now - tapAt < 1200 ? taps + 1 : 1; tapAt = now;
    if (taps >= 5){ taps = 0; if (isMaster() || post.practiceMode()) app.go('#/ledger'); else askWord(); }
  });
  $('#fLedger').addEventListener('click', () => app.go('#/ledger'));
  $('#sheetBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-led-enroll]'); if (!b || b.disabled) return;
    const w = ($('#ledWord') || {}).value || ''; if (!w.trim()) return;
    b.disabled = true; b.textContent = '확인하는 중…';
    try { await enroll(w); closeSheet(); line(); app.go('#/ledger'); }
    catch (err){
      b.disabled = false; b.textContent = '등록';
      toast(/permission|insufficient/i.test(String(err && err.code || '') + String(err && err.message || '')) ? '암호가 맞지 않거나, 보안 규칙이 아직 게시되지 않았습니다.' : '서버에 닿지 못했습니다. 인터넷 연결을 확인해 주세요.', 3200);
    }
  });

  function show(){
    if (!isMaster() && !post.practiceMode()){ app.go('#/settings', true); return; }
    $('.cab-scroll', sec).scrollTop = 0;
    load();
  }
  return {show, line};
}
