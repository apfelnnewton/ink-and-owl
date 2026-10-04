/* Grading, review intervals and the study ladder (CLAUDE.md).
   again → 1 day · hard → keep (at least 1) · good → ×2.5 along 1 → 3 → 7 → 18 → 45, then ×2.5 rounded.
   The ladder is fixed because 3 × 2.5 = 7.5 would otherwise round to 8. Over 30 days counts as mastered.
   A new card graded good starts at 3 days (treated as 1 × 2.5). */
import * as store from './store.js';

export const LADDER = [1, 3, 7, 18, 45];
export const MASTERED = 30;

export function nextInterval(prev, grade){
  if (grade === 'again') return 1;
  if (grade === 'hard') return Math.max(1, prev || 1);
  if (!prev) return 3;
  const k = LADDER.indexOf(prev);
  if (k >= 0 && k < LADDER.length - 1) return LADDER[k + 1];
  return Math.round(prev * 2.5);
}

/* ---------- dates (local calendar days). ?date=YYYY-MM-DD in the address pretends it is that day (for checking). */
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parse(s){ const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function today(){
  const q = new URLSearchParams(location.search).get('date');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return fmt(new Date());
}
export function addDays(s, n){ const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
export function dayLabel(s){ const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`; }
export function whenLabel(days){ return days <= 1 ? '내일' : `${days}일 뒤`; }

/* ---------- daily session */
const usable = cards => cards.filter(c => c.card !== false);

function plan(deckId, cards, date){
  const st = store.get().settings, ds = store.deck(deckId).cards;
  const due = usable(cards).filter(c => ds[c.id] && ds[c.id].d <= date)
    .sort((a, b) => (ds[a.id].d < ds[b.id].d ? -1 : ds[a.id].d > ds[b.id].d ? 1 : a.order - b.order))
    .slice(0, Math.max(0, st.reviewCap | 0));
  const fresh = usable(cards).filter(c => !ds[c.id]).sort((a, b) => a.order - b.order).slice(0, Math.max(0, st.newPerDay | 0));
  return {queue: due.map(c => c.id).concat(fresh.map(c => c.id)), kinds: due.map(() => 'r').concat(fresh.map(() => 'n'))};
}

/* Today's session, built once per day. Rebuilt while nothing has been graded yet, so settings changes apply. */
export function session(deckId, cards){
  const date = today(), dk = store.deck(deckId);
  if (!dk.day || dk.day.date !== date || dk.day.pos === 0){
    const p = plan(deckId, cards, date);
    dk.day = {date, queue: p.queue, kinds: p.kinds, pos: 0, results: {}};
    store.save();
  }
  return dk.day;
}

/* Counts for the corridor notice without committing a session. */
export function preview(deckId, cards){
  const date = today(), dk = store.deck(deckId);
  const day = (dk.day && dk.day.date === date && dk.day.pos > 0) ? dk.day : {...plan(deckId, cards, date), pos: 0, results: {}};
  const rest = day.kinds.slice(day.pos);
  return {
    started: day.pos > 0, done: day.pos > 0 && day.pos >= day.queue.length, empty: day.queue.length === 0,
    review: rest.filter(k => k === 'r').length, fresh: rest.filter(k => k === 'n').length, total: day.queue.length, pos: day.pos
  };
}

/* ---------- the study ladder: learn → fill the blank → arrange → say it.
   Each card's stage (st 0–3) rises one rung with every right answer and falls back to learn on a wrong one.
   Learn sets the next visit 3 days out, so the rungs land on the 1 → 3 → 7 → 18 → 45 day ladder.
   Cards saved before the ladder existed have no st and count as "say it". */
export const STAGES = ['learn', 'cloze', 'arrange', 'recall'];
export const arrangeable = card => card.line.trim().split(/\s+/).length >= 4;
export function stageOf(deckId, card, practice){
  const st = store.deck(deckId).cards[card.id];
  let s = st ? (st.st ?? 3) : 0;
  if (card.minimal && s > 0) s = 3;
  if (s === 1 && !(practice && practice[card.id])) s = 2;
  if (s === 2 && !arrangeable(card)) s = 3;
  return STAGES[s];
}

export function grade(deckId, cardId, g, stage = 'recall', minimal = false){
  const date = today(), dk = store.deck(deckId), prev = dk.cards[cardId];
  let i, st;
  if (stage === 'learn'){ i = 3; st = minimal ? 3 : 1; g = 'learn'; }
  else if (g === 'again'){ i = 1; st = 0; }
  else if (stage === 'recall'){ i = nextInterval(prev ? prev.i : 0, g); st = 3; }
  else { i = nextInterval(prev ? prev.i : 0, 'good'); st = Math.min(3, STAGES.indexOf(stage) + 1); }
  dk.cards[cardId] = {i, d: addDays(date, i), g, st, t: date, m: (prev && prev.m || 0) + (g === 'again' ? 1 : 0), h: (prev && prev.h || 0) + (g === 'hard' ? 1 : 0)};
  let dayDone = false, dayPerfect = false;
  if (dk.day && dk.day.date === date){
    dk.day.results[cardId] = g; dk.day.pos++;
    if (dk.day.pos >= dk.day.queue.length){ const rs = Object.values(dk.day.results); dayDone = true; dayPerfect = rs.some(x => x === 'good') && rs.every(x => x === 'good' || x === 'learn'); }
  }
  note(deckId, g, {cardId, kind: '', dayDone, dayPerfect});
  store.save();
  return i;
}

/* listeners told about every answer (bond.js): {deckId, g, cardId, kind, dayDone, dayPerfect, roundDone, roundPerfect, roundGood} */
export const hooks = [];
/* the day's register: one line per deck per day, and the streak */
function note(deckId, g, ev = {}){
  const date = today(), log = store.get().log, day = log[date] || (log[date] = {}), e = day[deckId] || (day[deckId] = {n: 0, good: 0, hard: 0, again: 0, learn: 0});
  e.n++; e[g] = (e[g] || 0) + 1;
  const s = store.get().streak;
  if (s.last !== date){ s.n = (s.last === addDays(date, -1)) ? s.n + 1 : 1; s.last = date; }
  hooks.forEach(h => { try { h({deckId, g, ...ev}); } catch (e){ console.error(e); } });
}

export function peek(deckId, cardId, g){
  const prev = store.deck(deckId).cards[cardId];
  return g === 'again' ? 1 : nextInterval(prev ? prev.i : 0, g);
}

export function progress(deckId, cards){
  const ds = store.deck(deckId).cards, list = usable(cards);
  const seen = list.filter(c => ds[c.id]).length, mastered = list.filter(c => ds[c.id] && ds[c.id].i > MASTERED).length;
  const tomorrow = addDays(today(), 1);
  const dueTomorrow = list.filter(c => ds[c.id] && ds[c.id].d <= tomorrow).length;
  return {total: list.length, seen, mastered, complete: list.length > 0 && mastered === list.length, dueTomorrow};
}

export function streak(){
  const s = store.get().streak, t = today();
  if (s.last === t || s.last === addDays(t, -1)) return s.n;
  return 0;
}

/* ---------- side rounds, outside the day's lesson, kept in day.extra / day.wrong:
   "더 도전" = ten learned lines at random; "틀린 대사" = the lines missed (or nearly missed) most often.
   Only misses touch the schedule: a missed line goes back to learn tomorrow; a right answer leaves the schedule alone
   (so a lucky round can never mark a line as mastered early), though in the wrong-lines round it lowers the miss count. */
const missScore = c => (c ? (c.m || 0) * 2 + (c.h || 0) + (c.g === 'again' ? 2 : c.g === 'hard' ? 1 : 0) : 0);
export function wrongLines(deckId, cards){
  const ds = store.deck(deckId).cards;
  return usable(cards).filter(c => missScore(ds[c.id]) > 0).sort((a, b) => missScore(ds[b.id]) - missScore(ds[a.id]) || a.order - b.order);
}
export function roundSession(deckId, cards, kind, n = 10, ids = null){
  const date = today(), dk = store.deck(deckId);
  if (!dk.day || dk.day.date !== date) dk.day = {date, queue: [], kinds: [], pos: 0, results: {}};
  let list;
  if (ids) list = ids.map(id => cards.find(c => c.id === id)).filter(Boolean);
  else if (kind === 'wrong') list = wrongLines(deckId, cards).slice(0, n);
  else {
    const seen = usable(cards).filter(c => dk.cards[c.id]);
    const round = (dk.day.extraRounds || 0) + 1;
    let s = 0; for (const ch of date + '#' + round) s = (s * 31 + ch.charCodeAt(0)) | 0;
    const R = () => ((s = (s * 1103515245 + 12345) | 0) >>> 0) / 4294967296;
    list = seen.slice();
    for (let i = list.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    list = list.slice(0, n);
    dk.day.extraRounds = round;
  }
  dk.day[kind] = {queue: list.map(c => c.id), pos: 0, results: {}};
  store.save();
  return dk.day[kind];
}
export const extraSession = (deckId, cards, n) => roundSession(deckId, cards, 'extra', n);
export function gradeRound(deckId, cardId, g, kind){
  const date = today(), dk = store.deck(deckId), st = dk.cards[cardId], r = dk.day && dk.day[kind];
  if (st){
    st.t = date;
    if (g === 'again'){ st.i = 1; st.d = addDays(date, 1); st.g = 'again'; st.st = 0; st.m = (st.m || 0) + 1; }
    else if (g === 'hard') st.h = (st.h || 0) + 1;
    else if (kind === 'wrong'){ if (st.m) st.m--; else if (st.h) st.h--; if (st.g === 'again' || st.g === 'hard') st.g = 'good'; }
  }
  let roundDone = false, roundPerfect = false, roundGood = 0;
  if (r){
    r.results[cardId] = g; r.pos++;
    if (r.pos >= r.queue.length){ const rs = Object.values(r.results); roundDone = true; roundGood = rs.filter(x => x === 'good').length; roundPerfect = roundGood === rs.length; }
  }
  note(deckId, g, {cardId, kind, roundDone, roundPerfect, roundGood});
  store.save();
}
export const learnedCount = (deckId, cards) => usable(cards).filter(c => store.deck(deckId).cards[c.id]).length;
