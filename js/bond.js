/* The professors' side of things, apart from the lessons: how well each professor knows the learner (points → five
   stages), and what follows from it — owl letters for milestones (L01–L50), everyday letters that arrive at random
   from any professor studied with (P001–P150), seasonal greetings (G01–G10), small requests (R01–R10), tea-time
   conversations that a professor springs on you in the corridor (T01–T100) and keepsakes (K01–K30). The words live
   in bond/<deck>.json; this file decides when each one arrives. Everything lands in the post
   (state.bond[deck].mail) and is read in letters.js. Nothing here touches the review schedule.
   state.bond[deck] = {pts, days, lastDay, run, perfect, flags:{}, mail:[{id, t, read}], sent:{id:date},
                       teas:{T01:score}, lastTea, req:{active, done, failed, lastDay}, keep:{K01:date},
                       posts, openRoll, studyRoll}
   state.bond[deck].inv = {src: 'owl'|'study', t} — a tea invitation in hand; .q = answers since the last one
   state.bondDay = {date, posts, owl} — today's everyday letters so far, and today's owl invitation {id, at} */
import {DECKS, byId} from './decks.js';
import * as srs from './srs.js';
import * as store from './store.js';
import * as group from './post.js';
import * as doors from './doors.js';
import * as wand from './wand.js';
import {esc, toast} from './ui.js';

export const STAGES = ['서먹함', '알아봄', '인정', '신뢰', '각별함'];
const AT = [0, 80, 250, 600, 1200];
const POST_OPEN = .22, POST_STUDY = .5, POST_CAP = 2, Q_PER_TEA = 30;
/* a fixed roll for (day, professor, purpose): the same answer however often the app is opened that day */
const roll = key => { let h = 2166136261; for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
const pad3 = n => String(n).padStart(3, '0');
const EASTER = {2026: '04-05', 2027: '03-28', 2028: '04-16', 2029: '04-01', 2030: '04-21', 2031: '04-13', 2032: '03-28'};
const GREET = {G01: '09-01', G02: '10-31', G03: '11-05', G04: '12-25', G05: '01-01', G06: '02-14', G07: 'easter', G08: '10-05', G09: '07-22', G10: 'birthday'};

const data = {};
let app = null;
export const loaded = id => data[id];
export async function load(id){
  if (data[id]) return data[id];
  try { const r = await fetch(`bond/${id}.json`); data[id] = r.ok ? await r.json() : null; } catch (e){ data[id] = null; }
  return data[id];
}

export function bondOf(id){
  const s = store.get();
  if (!s.bond) s.bond = {};
  if (!s.bond[id]) s.bond[id] = {pts: 0, days: 0, lastDay: '', run: 0, perfect: 0, flags: {}, mail: [], sent: {}, teas: {}, lastTea: 0, req: {active: null, done: 0, failed: 0, lastDay: 0}, keep: {}};
  return s.bond[id];
}
export const stage = id => { const p = bondOf(id).pts; let k = 0; AT.forEach((a, i) => { if (p >= a) k = i; }); return k; };
export const unread = id => (id ? [id] : DECKS.map(d => d.id)).reduce((n, d) => n + bondOf(d).mail.filter(m => !m.read).length, 0);

/* the learner's names, from settings: {name} formal, {first} first name */
export function fill(text){
  const st = store.get().settings, first = st.firstName || 'friend', sur = st.surname || '', title = st.title ?? '';
  return String(text).replace(/\{name\}/g, sur ? (title ? `${title} ${sur}` : sur) : first).replace(/\{first\}/g, first);
}

/* ---------- post */
const listeners = new Set();
export const onPost = f => listeners.add(f);
function post(id, item){
  const b = bondOf(id);
  if (b.sent[item]) return false;
  b.sent[item] = srs.today();
  b.mail.push({id: item, t: srs.today(), read: false});
  listeners.forEach(f => f(id, item));
  return true;
}
function stageUp(id, before){
  const after = stage(id);
  for (let k = before + 1; k <= after; k++){ post(id, 'L' + (30 + k)); post(id, 'K0' + k); if (k >= 2) group.announce('stage', id, k); }
}
const addPts = (id, n) => { const b = bondOf(id), before = stage(id); b.pts += n; stageUp(id, before); };
/* the bond can fall a little (a disliked answer at tea, a cold pot, a failed request) but never below the stage
   already reached (2026-10-04 user decision), and never for simply staying away */
const losePts = (id, n) => { const b = bondOf(id), floor = AT[stage(id)]; b.pts = Math.max(floor, b.pts - n); };
/* what each answer at tea is worth to the professor's bond: liked, neutral, disliked (bond/<deck>.json options[].taste) */
export const TASTE_PTS = {1: 8, 0: 3, '-1': -4};
export const tasteOf = o => o && typeof o.taste === 'number' ? o.taste : 0;

/* ---------- milestones that depend on the deck's cards */
function deckChecks(id){
  const cards = app && app.data[id]; if (!cards) return;
  const b = bondOf(id), g = srs.progress(id, cards), learnt = g.seen / g.total, mast = g.mastered / g.total;
  [[1, 'L01'], [2, 'L02'], [3, 'L03'], [7, 'L04'], [14, 'L05'], [21, 'L06'], [30, 'L07'], [45, 'L08'], [60, 'L09'], [90, 'L10'], [120, 'L11'], [180, 'L12'], [270, 'L13'], [365, 'L14']]
    .forEach(([n, l]) => { if (b.days >= n) post(id, l); });
  for (let k = 1; k <= 10; k++) if (learnt >= k / 10 - 1e-9) post(id, 'L' + (14 + k));
  if (learnt >= 1 - 1e-9) group.announce('learnt', id);   // the friends hear of it from this professor
  if (learnt >= .5) post(id, 'K09');
  if (g.mastered >= 1) post(id, 'L25');
  [[.1, 'L26'], [.25, 'L27'], [.5, 'L28'], [.75, 'L29'], [1, 'L30']].forEach(([f, l]) => { if (mast >= f - 1e-9) post(id, l); });
  if (g.complete) post(id, 'K10');
  /* every stage reached so far has its letter and its gift (posting is once only, so this is safe to repeat) */
  for (let k = 1; k <= stage(id); k++){ post(id, 'L' + (30 + k)); post(id, 'K0' + k); }
}

/* ---------- requests: one at a time, from the second stage on, every five study days */
function offerRequest(id){
  const d = data[id], b = bondOf(id), r = b.req;
  if (!d || r.active || stage(id) < 1 || (r.lastDay && b.days - r.lastDay < 5)) return;
  const k = r.done + r.failed; if (k >= d.requests.length) return;
  const q = d.requests[k], cards = app.data[id] || [], ds = store.deck(id).cards;
  let pick = [];
  if (q.kind === 'lines'){
    pick = cards.filter(c => ds[c.id]).sort((a, c2) => ((ds[a.id].st || 0) - (ds[c2.id].st || 0)) || ((ds[c2.id].m || 0) - (ds[a.id].m || 0))).slice(0, q.n).map(c => c.id);
    if (pick.length < q.n) return;
  }
  r.active = {id: q.id, kind: q.kind, n: q.n, start: srs.today(), until: srs.addDays(srs.today(), q.days), cards: pick, hit: [], days: []};
  r.lastDay = b.days;
  post(id, q.id + '-ask');
}
function settleRequest(id, ok){
  const b = bondOf(id), r = b.req, a = r.active; if (!a) return;
  r.active = null;
  if (ok){
    r.done++; post(id, a.id + '-done'); addPts(id, 20); post(id, 'L45');
    if (r.done >= 5) post(id, 'L46');
    const gift = {1: 'K05', 3: 'K06', 6: 'K07', 10: 'K08'}[r.done]; if (gift) post(id, gift);
  }
  else { r.failed++; post(id, a.id + '-fail'); post(id, 'L47'); losePts(id, 6); }
}
export const activeRequest = id => bondOf(id).req.active;
export function requestText(id){
  const a = activeRequest(id), d = data[id]; if (!a || !d) return '';
  const left = Math.max(0, Math.round((new Date(a.until) - new Date(srs.today())) / 864e5));
  const done = a.kind === 'lines' ? `${a.hit.length}/${a.n}` : a.kind === 'days' ? `${a.days.length}/${a.n}` : '';
  return `부탁 · ${({lines: '이 대사들 맞히기', days: '함께 공부한 날', extra: '더 도전 고득점', wrong: '틀린 대사 연습 완주'})[a.kind]}${done ? ' ' + done : ''} · ${left ? left + '일 남음' : '오늘까지'}`;
}

/* ---------- everyday letters: rolled once when the day opens, and once more on the first lesson with that professor */
function today(){ const s = store.get(), t = srs.today(); if (!s.bondDay || s.bondDay.date !== t) s.bondDay = {date: t, posts: 0, owl: null}; return s.bondDay; }
function everyday(id, why){
  const d = data[id], b = bondOf(id), t = srs.today(), day = today();
  if (!d || !d.posts || !b.days || day.posts >= POST_CAP) return;
  const k = why === 'study' ? 'studyRoll' : 'openRoll'; if (b[k] === t) return;
  b[k] = t;
  if (roll(`${t}|${id}|${why}`) >= (why === 'study' ? POST_STUDY : POST_OPEN)) return;
  const n = (b.posts || 0) + 1, key = 'P' + pad3(n); if (!d.posts[key]) return;
  b.posts = n; day.posts++;
  post(id, key);
  if (n % 15 === 0) post(id, 'K' + (20 + n / 15));
}

/* ---------- tea: from the second stage. An invitation comes two ways (2026-10-04 user decision):
   once a day an owl brings one at a hidden time between 9:00 and 21:00 (the first moment the app is open after it), and
   every Q_PER_TEA answers with a professor earn that professor's invitation at the end of the lesson. An owl invitation
   left unanswered goes cold at midnight and leaves a short note in the post (C-<date>). */
const inviteOf = (id, tea) => tea.invite || ((data[id] || {}).invites || {})[tea.id] || {en: 'Will you take a cup of tea with me?', ko: '차 한 잔 하겠나?'};
const nextTea = id => { const d = data[id], b = bondOf(id); if (!d || stage(id) < 1) return null; const k = Object.keys(b.teas).length; return k < d.teas.length ? d.teas[k] : null; };
export function teaReady(id){ return bondOf(id).inv ? nextTea(id) : null; }
export const inviteSrc = id => (bondOf(id).inv || {}).src || '';
export const inviteText = id => { const t = teaReady(id); return t ? inviteOf(id, t) : null; };
let owlTested = false;   // ?owl in the address: one owl per page load, whatever the day says
const owlAt = t => 9 * 60 + Math.floor(roll(`${t}|owl`) * 720);
/* is the owl due now? → {id, tea, invite} at most once a day, or null. ?owl or ?owl=<deck> in the address forces it (testing) */
export function owlDue(){
  const day = today(), now = new Date(), t = srs.today(), q = new URLSearchParams(location.search), test = q.has('owl');
  if (test ? owlTested : day.owl) return null;
  if (!test && now.getHours() * 60 + now.getMinutes() < owlAt(t)) return null;
  const ready = DECKS.map(x => x.id).filter(id => (test || !bondOf(id).inv) && nextTea(id));
  if (!ready.length) return null;
  const id = ready.includes(q.get('owl')) ? q.get('owl') : ready[Math.floor(roll(`${t}|who`) * ready.length)], tea = nextTea(id);
  day.owl = {id, at: now.toISOString()}; if (test) owlTested = true;
  bondOf(id).inv = {src: 'owl', t};
  store.save();
  return {id, tea, invite: inviteOf(id, tea)};
}
/* picks: the answer chosen at each turn, kept for the tea journal (state.bond[deck].teaLog[T01] = {d, c:[0,2,1]}) */
export function finishTea(id, tea, score, picks){
  const b = bondOf(id); b.teas[tea.id] = score; b.lastTea = b.days;
  if (Array.isArray(picks)) (b.teaLog || (b.teaLog = {}))[tea.id] = {d: srs.today(), c: picks};
  b.inv = null;
  /* each answer by the professor's taste; the old per-option score only if no answers were recorded */
  if (Array.isArray(picks) && picks.length){
    let up = 0, down = 0;
    picks.forEach((c, k) => { const v = TASTE_PTS[tasteOf(tea.turns[k] && tea.turns[k].options[c])]; if (v > 0) up += v; else down -= v; });
    if (up) addPts(id, up);
    if (down) losePts(id, down);
  } else addPts(id, score * 2);
  const n = Object.keys(b.teas).length;
  if (n >= 1) post(id, 'L48'); if (n >= 10) post(id, 'L49'); if (n >= 20) post(id, 'L50');
  if (n % 10 === 0 && n <= 100) post(id, 'K' + (10 + n / 10));
  store.save();
}

/* ---------- seasonal greetings: on the day or up to three days after, once a year, if we have studied together */
function greetings(){
  const t = srs.today(), y = t.slice(0, 4), md = t.slice(5), bday = store.get().settings.birthday || '';
  const near = mmdd => { if (!mmdd) return false; for (let k = 0; k <= 3; k++) if (srs.addDays(`${y}-${mmdd}`, k) === t) return true; return false; };
  if (bday && md === bday) group.announce('bday', '', y);   // on the day itself, the friends' professors pass it on
  for (const d of DECKS){
    const b = bondOf(d.id); if (!b.days || !data[d.id]) continue;
    for (const [g, when] of Object.entries(GREET)){
      const mmdd = when === 'easter' ? EASTER[y] : when === 'birthday' ? bday : when;
      if (near(mmdd)) post(d.id, `${g}-${y}`);
    }
  }
  void md;
}

/* ---------- every answer */
srs.hooks.push(ev => {
  const id = ev.deckId, b = bondOf(id), t = srs.today(), before = stage(id);
  if (b.lastDay !== t){
    const gap = b.lastDay ? Math.round((new Date(t) - new Date(b.lastDay)) / 864e5) : 0;
    b.run = gap === 1 ? b.run + 1 : 1;
    if (gap >= 7) post(id, 'L41'); if (gap >= 30) post(id, 'L42');
    b.days++; b.lastDay = t; b.pts += 5;
    if (b.run >= 5) post(id, 'L39'); if (b.run >= 10) post(id, 'L40');
    const h = new Date().getHours();
    if (h >= 23 || h < 4) post(id, 'L43'); if (h >= 5 && h < 7) post(id, 'L44');
    const a = b.req.active; if (a && a.kind === 'days' && !a.days.includes(t)) a.days.push(t);
  }
  b.pts += ({good: 2, hard: 1, again: .5, learn: 1})[ev.g] || 0;
  if (ev.dayDone && ev.dayPerfect){ b.perfect++; post(id, 'L35'); if (b.perfect >= 5) post(id, 'L36'); }
  if (ev.roundDone && ev.kind === 'extra' && ev.roundPerfect) post(id, 'L37');
  if (ev.roundDone && ev.kind === 'wrong' && ev.roundPerfect) post(id, 'L38');
  const a = b.req.active;
  if (a){
    if (a.kind === 'lines' && ev.g === 'good' && a.cards.includes(ev.cardId) && !a.hit.includes(ev.cardId)) a.hit.push(ev.cardId);
    if (a.kind === 'extra' && ev.roundDone && ev.kind === 'extra' && ev.roundGood >= a.n) a.hit.push('ok');
    if (a.kind === 'wrong' && ev.roundDone && ev.kind === 'wrong' && ev.roundPerfect) a.hit.push('ok');
    if ((a.kind === 'lines' && a.hit.length >= a.n) || (a.kind === 'days' && a.days.length >= a.n) || ((a.kind === 'extra' || a.kind === 'wrong') && a.hit.length)) settleRequest(id, true);
  }
  b.q = (b.q || 0) + 1;
  if (b.q >= Q_PER_TEA && !b.inv && nextTea(id)){ b.inv = {src: 'study', t}; b.q = 0; }
  stageUp(id, before);
  deckChecks(id);
  offerRequest(id);
  everyday(id, 'study');
});

/* ---------- on start-up and every return to the corridor: expired requests, greetings, milestones */
export async function daily(){
  await Promise.all(DECKS.map(d => load(d.id)));
  const t = srs.today();
  for (const d of DECKS){
    const b = bondOf(d.id), a = b.req.active;
    if (a && t > a.until) settleRequest(d.id, false);
    if (b.inv && b.inv.src === 'owl' && b.inv.t < t){ post(d.id, 'C-' + b.inv.t); b.inv = null; losePts(d.id, 3); }
    if (b.days) { deckChecks(d.id); offerRequest(d.id); everyday(d.id, 'open'); }
  }
  greetings();
  wandLetter();
  newsLetter();
  store.save();
}

/* ---------- news of a friend (2026-10-04 user decision): at most one a day, told by the professor concerned —
   or by Dumbledore, as host, when the guest has not met that professor yet; a birthday by the guest's first
   professor. The words are in bond/news.json; the letter is kept as N-<news id> with what it needs to be written. */
let NEWS = null;
const loadNews = () => NEWS ? Promise.resolve(NEWS) : fetch('bond/news.json').then(r => r.ok ? r.json() : null).then(j => (NEWS = j)).catch(() => null);
export async function newsLetter(){
  const day = today(); if (day.news) return false;
  const n = group.nextNews(); if (!n || !(await loadNews())) return false;
  let teller, set, other = false;
  if (n.type === 'bday') teller = doors.isOpen(doors.first()) ? doors.first() : 'dumbledore';
  else if (byId(n.deck) && doors.isOpen(n.deck)) teller = n.deck;
  else { teller = 'dumbledore'; other = n.deck && n.deck !== 'dumbledore'; }
  set = other ? NEWS.dumbledore.other[n.type] : (NEWS[teller] || {})[n.type];
  if (!set || !set.length){ group.markNewsTold(n.id); return false; }
  await load(teller);
  const key = 'N-' + n.id, b = bondOf(teller);
  b.news = b.news || {};
  b.news[key] = {type: n.type, friend: n.name, about: other ? n.deck : '', v: Math.floor(roll(n.id) * set.length)};
  post(teller, key);
  day.news = true;
  group.markNewsTold(n.id);
  store.save();
  return true;
}
function newsText(id, key){
  const x = (bondOf(id).news || {})[key]; if (!x || !NEWS) return null;
  const set = x.about ? NEWS.dumbledore.other[x.type] : (NEWS[id] || {})[x.type], t = set && set[x.v % set.length]; if (!t) return null;
  const p = byId(x.about) || {}, put = s => s.replace(/\{friend\}/g, x.friend || 'your friend').replace(/\{profEn\}/g, p.who || '').replace(/\{profKo\}/g, p.ko || '');
  return {kind: '소식', en: put(t.en), ko: put(t.ko)};
}

/* ---------- the wand (wand.js): the day after it is made, a letter about its wood (WD-<wood>) — from McGonagall,
   Lupin or Slughorn if it is their own wood and their door is open, otherwise from Dumbledore */
function wandLetter(){
  const w = wand.get(); if (!w || !w.d || w.d >= srs.today()) return;
  const {deck} = wand.letterFor(w.wood, doors.isOpen);
  post(deck, 'WD-' + w.wood);
}

/* ---------- the words for a piece of post */
export function itemOf(id, key){
  if (/^WD-[a-z]+$/.test(key)){
    const wood = key.slice(3), own = wand.OWNER[wood];
    const t = own === id ? wand.LETTERS.own[wood] : id === 'dumbledore' ? (own ? wand.LETTERS.relay[wood] : wand.LETTERS.wood[wood]) : null;
    return t && {kind: '편지', ...t};
  }
  if (key === 'W00') return id === 'dumbledore' ? {kind: '환영 편지', ...WELCOME} : null;
  if (/^N-/.test(key)) return newsText(id, key);
  const d = data[id]; if (!d) return null;
  const who = byId(id);
  let m;
  if (/^L\d\d$/.test(key)) return {kind: '편지', ...d.letters[key]};
  if (/^P\d{3}$/.test(key)) return d.posts && d.posts[key] && {kind: '편지', ...d.posts[key]};
  if ((m = key.match(/^(G\d\d)-(\d{4})$/))){ const g = d.greetings[m[1]]; return g && {kind: '카드', ...(stage(id) >= 2 ? g.warm : g.cool)}; }
  if ((m = key.match(/^(R\d\d)-(ask|done|fail)$/))){ const r = d.requests.find(x => x.id === m[1]); return r && {kind: m[2] === 'ask' ? '부탁' : '답장', ...r[m[2]]}; }
  if (/^C-\d{4}-\d\d-\d\d$/.test(key)) return COLD[id] && {kind: '식어 버린 차', ...COLD[id]};
  if (/^K\d\d$/.test(key)){ const k = d.keepsakes.find(x => x.id === key); return k && {kind: '선물', gift: k, en: k.note.en, ko: k.note.ko}; }
  void who;
  return null;
}
/* an owl invitation nobody answered: what the professor says about the cold pot (one line each, in their own voice) */
const COLD = {
  snape: {en: 'The tea went cold, {name}. I drank it anyway. I do not care for waste.', ko: '차가 식었다, {name}. 그래도 마셨다. 낭비는 질색이니까.'},
  mcgonagall: {en: 'The pot has gone cold, {first}. I shall assume you were busy, and expect you next time.', ko: '주전자가 식었다, {first}. 바빴던 거라고 여기겠다. 다음엔 오길 기대하마.'},
  lupin: {en: 'I kept your cup warm as long as I could, {first}. Another day, then. The chocolate will keep.', ko: '네 잔을 할 수 있는 만큼 따뜻하게 두었단다, {first}. 그럼 다음에 오렴. 초콜릿은 상하지 않으니까.'},
  moody: {en: "Tea's cold. You didn't come. Fine. Next time, don't leave me watching the door.", ko: '차 식었다. 안 왔더군. 됐다. 다음엔 문만 쳐다보게 하지 마라.'},
  umbridge: {en: 'I poured two cups, dear. One of them has gone quite cold. I am sure you had a very good reason.', ko: '두 잔을 따랐어요, 얘야. 한 잔은 완전히 식어 버렸네요. 분명 아주 그럴듯한 이유가 있었겠지요.'},
  slughorn: {en: 'A pity, {first}! The crystallised pineapple went to Hagrid in the end. Next time, eh?', ko: '아쉽군, {first}! 파인애플 설탕 절임은 결국 해그리드 차지가 됐다네. 다음엔 꼭 오게나.'},
  dumbledore: {en: 'Your cup and I waited together until the tea went cold. Pleasant company, all the same. Another day.', ko: '자네 잔과 나는 차가 식을 때까지 함께 기다렸다네. 그래도 꽤 좋은 동무였지. 다음에 보세.'}
};
/* the first letter of all (2026-10-04 user decision): once the guest has a name, the owl brings Dumbledore's welcome —
   how the castle works, in his voice. It stays in the post under Dumbledore like any other letter. */
const WELCOME = {
  en: "Dear {name},\n" +
    "Welcome to the castle. Your room is at the top of the tower. It is a little draughty, I'm afraid, but the view is splendid, and someone has already lit the fire.\n" +
    "Before the staircases start moving, here are a few things a guest ought to know.\n" +
    "You may choose one classroom to begin with. The other doors are locked for now, but the castle is generous: for every twenty new lines you learn, a key will turn up in your pocket. Use it on whichever door you fancy.\n" +
    "Each day your professor will have a handful of new lines for you, and a few old ones, to see whether they stuck. Answer aloud if you can. Professors are oddly fond of being listened to.\n" +
    "They also write letters. The better they know you, the thicker the post grows, and now and then an owl will bring an invitation to tea. Choose your words with care over the teacups. Each of my colleagues has firm views on what makes a pleasant afternoon.\n" +
    "Your letters wait on the desk in your room, beside a tea journal and a cabinet of drawers that your professors will slowly fill. At present it is rather empty.\n" +
    "Should you have friends in the castle, share a group code with them and the owls will carry your letters, in English only. Owls are stubborn about such things.\n" +
    "I do hope you will be happy here.\n" +
    "Albus Dumbledore",
  ko: "{name}에게\n" +
    "성에 온 걸 환영하네. 자네 방은 탑 꼭대기에 있다네. 외풍이 좀 있어 미안하네만, 전망은 훌륭하고 누군가 벽난로에 불도 지펴 두었지.\n" +
    "계단이 움직이기 시작하기 전에, 손님이 알아 두면 좋을 몇 가지를 적어 보내네.\n" +
    "처음에는 교실을 하나만 고를 수 있다네. 나머지 문은 당분간 잠겨 있지만, 이 성은 인심이 후하지. 새 대사를 스무 개 익힐 때마다 주머니에서 열쇠가 하나씩 나올 걸세. 마음 가는 문에 쓰게나.\n" +
    "교수들은 날마다 새 대사 몇 줄과, 잘 남아 있는지 확인할 지난 대사 몇 줄을 준비해 둘 걸세. 할 수 있으면 소리 내어 답해 보게. 교수들은 누가 귀 기울여 주는 걸 묘하게 좋아한다네.\n" +
    "교수들은 편지도 쓴다네. 자네를 알아 갈수록 편지가 늘고, 가끔은 부엉이가 차 초대장을 물어 올 걸세. 찻잔 앞에서는 말을 골라 하게. 내 동료들은 저마다 즐거운 오후가 무엇인지 확고한 생각이 있으니.\n" +
    "편지는 자네 방 책상 위에서 기다린다네. 그 옆에는 차 일지와, 교수들이 하나씩 채워 갈 서랍장이 있지. 지금은 좀 비어 있지만.\n" +
    "성 안에 친구가 있다면 그룹 코드를 나누게. 부엉이들이 편지를 날라 줄 걸세. 영어 편지만이네. 부엉이들은 그런 데 고집이 세거든.\n" +
    "여기서 즐겁게 지내길 바라네.\n" +
    "알버스 덤블도어"
};
export const welcomeDue = () => store.get().settings.named && !bondOf('dumbledore').sent.W00;
export const postWelcome = () => { const r = post('dumbledore', 'W00'); store.save(); return r; };

export const teasOf = id => (data[id] || {}).teas || [];
export const keepsakes = id => { const d = data[id], b = bondOf(id); return d ? d.keepsakes.filter(k => b.keep[k.id] || b.sent[k.id]) : []; };

export function init(a){
  app = a;
  loadNews();
  onPost((id, key) => {
    const who = byId(id);
    if (/^C-/.test(key) || key === 'W00') return;   // the cold-tea note waits quietly; the welcome comes by owl
    toast(`<span class="q" lang="en">An owl arrives.</span><span class="k">${esc(who.ko)}에게서 ${/^K/.test(key) ? '선물이' : /^R\d\d-ask/.test(key) ? '부탁이' : /^G/.test(key) ? '카드가' : '편지가'} 왔습니다.</span>`, 3200, true);
  });
}
