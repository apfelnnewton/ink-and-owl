/* The word tests (2026-10-16 user decision, docs/plan-owl.md): each professor sets an O.W.L. paper on the hard words
   of their own lines the learner has learnt (words/<deck>.json). The paper itself is exam.js (#/exam/<deck>).
   - A paper opens when 12 words never asked have built up (the first paper too); a retake opens seven days after a
     paper with mistakes, for the words missed. The professor's notice (OW-<n>) comes to the post; the corridor card
     shows a line once the day's lesson is done. A paper is sat after the lesson, never in its place.
   - Questions: the meaning to choose (Korean, four), the word to write from its plain gloss (first letter given), the
     gap in a new sentence (four options from owl/blank.json, or written at the high level). The missed words come first.
   - The grade (O E A P D T) is never stored: it is worked out from the record of the sitting. O brings the professor
     20 nearer, E and A 10, a fail nothing (nothing is taken).
   state.exams = {<deck>: {s: [{t, d, w: [keys asked], miss: [keys missed]}], sent: <notices sent>, kinds: {<n>: kind}}}
   a key is '<card id>#<n>' (the n-th word of that card). ?exam=<deck> makes a paper due now (testing). */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as doors from './doors.js';
import {byId, PROFS} from './decks.js';
import * as post from './post.js';

export const SUBJECT = {snape: 'Potions', slughorn: 'Potions', mcgonagall: 'Transfiguration', lupin: 'Defence Against the Dark Arts',
  moody: 'Defence Against the Dark Arts', umbridge: 'Defence Against the Dark Arts', dumbledore: "The Headmaster's Paper"};
export const SUBJECT_KO = {snape: '마법약', slughorn: '마법약', mcgonagall: '변신술', lupin: '어둠의 마법 방어술', moody: '어둠의 마법 방어술', umbridge: '어둠의 마법 방어술', dumbledore: '교장의 시험'};
export const examiner = id => 'Professor ' + byId(id).tag;
export const GRADES = [['O', 'Outstanding', .9], ['E', 'Exceeds Expectations', .75], ['A', 'Acceptable', .6], ['P', 'Poor', .45], ['D', 'Dreadful', .25], ['T', 'Troll', 0]];
export const PASS = new Set(['O', 'E', 'A']);
const NEW_AT = 12, RETAKE_DAYS = 7, MOST = 20, LEAST = 12;

let TEXT = null, BLANK = null;
export const load = () => Promise.all([
  TEXT ? TEXT : fetch('owl/texts.json').then(r => r.ok ? r.json() : null).then(j => (TEXT = j)).catch(() => null),
  BLANK ? BLANK : fetch('owl/blank.json').then(r => r.ok ? r.json() : null).then(j => (BLANK = j)).catch(() => null)
]);
export const text = () => TEXT;
export const blankOf = key => (BLANK || {})[key] || null;
/* a gap with no fair set of wrong options (owl-blank.cjs: dropped by the reviewers) is asked only where it is written */
const gapFits = (key, level) => { const b = blankOf(key); return !!b && (level === 'high' || !!(b.o && b.o.length === 3)); };

export function st(id){
  const s = store.get(), e = s.exams || (s.exams = {}), x = e[id] || (e[id] = {s: [], sent: 0, kinds: {}});
  x.s = x.s || []; x.kinds = x.kinds || {}; x.sent = +x.sent || 0;
  return x;
}
export const sittings = id => [...st(id).s].sort((a, b) => a.t - b.t);
const RANK = Object.fromEntries(GRADES.map((g, i) => [g[0], 6 - i]));

/* the words of the lines learnt (one per word and meaning: the same word with the same meaning on two cards is one word) */
export function learnt(id, words){
  const ds = store.deck(id).cards || {}, seen = new Set(), out = [];
  for (const [cid, list] of Object.entries(words || {})){
    if (!ds[cid]) continue;
    list.forEach((e, i) => { const k = e.w.toLowerCase() + '|' + e.ko; if (seen.has(k)) return; seen.add(k); out.push({key: cid + '#' + i, ...e}); });
  }
  return out;
}

/* where the words stand: never asked · missed the last time they were asked · passed */
export function standing(id, words){
  const all = learnt(id, words), last = {};
  for (const s of sittings(id)) for (const k of s.w) last[k] = s.miss.includes(k) ? 'miss' : 'ok';
  return {all, fresh: all.filter(e => !last[e.key]), missed: all.filter(e => last[e.key] === 'miss'), passed: all.filter(e => last[e.key] === 'ok')};
}
const forced = id => new URLSearchParams(location.search).get('exam') === id;
/* which paper is due: 'first' · 'next' · 'retake' · null */
export function due(id, words){
  if (!PROFS.some(d => d.id === id) || !doors.isOpen(id)) return null;
  const w = standing(id, words), ss = sittings(id), last = ss[ss.length - 1];
  if (last && last.d === srs.today() && !forced(id)) return null;   // one paper a day for each professor, however many words wait
  if (w.fresh.length >= NEW_AT) return ss.length ? 'next' : 'first';
  if (w.missed.length && last && srs.addDays(last.d, RETAKE_DAYS) <= srs.today()) return 'retake';
  if (forced(id) && w.all.length) return ss.length ? (w.missed.length ? 'retake' : 'next') : 'first';
  return null;
}
/* the professor's notice of a paper due: once for each paper (the n-th) */
export function notify(id, words){
  const k = due(id, words); if (!k) return false;
  const x = st(id), n = x.s.length + 1;
  if (x.sent >= n) return false;
  if (!bond.postItem(id, 'OW-' + n)) return false;
  x.sent = n; x.kinds[n] = k; x.on = srs.today(); store.save();
  return true;
}
/* a notice's words (bond.itemOf) */
export function textOf(id, key){
  const m = key.match(/^OW-(\d+)$/); if (!m || !TEXT || !TEXT[id]) return null;
  const k = st(id).kinds[m[1]] || (m[1] === '1' ? 'first' : 'next'), t = TEXT[id].notice && TEXT[id].notice[k];
  return t ? {kind: '시험 공지', en: t.en, ko: t.ko, keys: t.keys, go: '#/exam/' + id, btn: '시험지를 받는다 · O.W.L.'} : null;
}

/* ---------- a paper */
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const rnd = seed => { let a = hash(seed) || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; };
const shuffle = (xs, r) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tokens = s => new Set((String(s).replace(/\([^)]*\)/g, ' ').toLowerCase().match(/[a-z]{3,}|[가-힣]{2,}/g) || []).filter(w => !STOP.has(w)));
const STOP = new Set('the and for with from that this someone something someone\'s not into out way lack good thing things very more most make made take'.split(' '));
/* two meanings close enough that one could pass for the other: never each other's wrong option */
const close = (a, b) => { const x = tokens(a.ko + ' ' + a.plain), y = tokens(b.ko + ' ' + b.plain); for (const t of x) if (y.has(t)) return true; return false; };
/* the gloss gives the word away (realise · make real): no "write it from the gloss" for that word */
const tells = e => { const w = e.w.toLowerCase().split(' ')[0]; return String(e.plain).toLowerCase().includes(w.slice(0, Math.max(4, w.length - 3))); };

/* the questions: kind, level → the shape of each. Every word is asked once and once only (2026-10-16, user: a word asked
   twice on one paper answers itself — "cheek" to write and "cheek" to choose); with too few words the paper is shorter.
   And no question may show the answer of another: a word to be written that appears anywhere else on the paper (an
   option, a sentence, a gloss) is asked as a meaning to choose instead. */
export function paper(id, words, allWords, kind){
  const w = standing(id, words), r = rnd(id + ':' + Date.now()), level = srs.level();
  const one = new Set(), pick = [];
  for (const e of [...w.missed, ...shuffle(w.fresh, r), ...shuffle(w.passed, r)]){
    const k = e.w.toLowerCase(); if (one.has(k)) continue;   // the same word in two meanings: one of them only
    if (pick.length >= MOST || (pick.length >= LEAST && !w.missed.includes(e) && !w.fresh.includes(e))) break;
    one.add(k); pick.push(e);
  }
  void kind;
  const shapes = level === 'low' ? ['mean', 'blank'] : level === 'high' ? ['plain', 'blank', 'plain', 'mean'] : ['mean', 'plain', 'blank'];
  const qs = [];
  const make = (e, want) => {
    const order = [want, ...shapes.filter(s => s !== want), 'mean'];
    for (const s of order){
      if (s === 'plain' && tells(e)) continue;
      if (s === 'blank' && !gapFits(e.key, level)) continue;
      if (s === 'blank' && level === 'high' && tells(e)) continue;   // its English gloss under the gap would give the word away
      return question(e, s, allWords, r, level);
    }
    return question(e, 'mean', allWords, r, level);
  };
  pick.forEach((e, i) => qs.push(make(e, shapes[i % shapes.length])));
  /* a written answer seen elsewhere on the paper: that question becomes a meaning to choose (its options are Korean, so
     they show no English word) — repeated until nothing on the paper gives anything away */
  for (let pass = 0; pass < 3; pass++){
    let changed = false;
    qs.forEach((q, i) => {
      if (!written(q)) return;
      const forms = [...new Set([q.answer, q.w, ...(q.accept || [])].filter(Boolean).map(f => f.toLowerCase()))];
      const elsewhere = qs.filter((o, j) => j !== i).map(shown).join(' \n ').toLowerCase();
      if (forms.some(f => new RegExp(`(^|[^a-z])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(elsewhere))){ qs[i] = question(pick.find(e => e.key === q.key), 'mean', allWords, r, level); changed = true; }
    });
    if (!changed) break;
  }
  return shuffle(qs, r);
}
const written = q => q.shape === 'plain' || (q.shape === 'blank' && q.write);
/* the English a question puts on the paper */
const shown = q => q.shape === 'mean' ? q.w : q.shape === 'plain' ? q.plain : [q.sentence, q.hint || '', ...(q.write ? [] : q.opts || [])].join(' ');
/* a meaning as an option: without the note that tells it apart from the word's usual sense ("('뺨'이 아니라)",
   "(흔히는 '구금')") — only the right meaning would carry one */
const bare = ko => String(ko).replace(/\s*\([^)]*(아니라|흔히)[^)]*\)/g, '').trim();
function question(e, shape, allWords, r, level){
  const q = {key: e.key, shape, w: e.w, pos: e.pos, ko: bare(e.ko), plain: e.plain};
  if (shape === 'mean'){
    const pool = allWords.filter(o => bare(o.ko) !== q.ko && o.w.toLowerCase() !== e.w.toLowerCase() && !close(o, e));
    const same = shuffle(pool.filter(o => o.pos === e.pos), r), rest = shuffle(pool.filter(o => o.pos !== e.pos), r);
    const wrong = []; for (const o of [...same, ...rest]){ if (wrong.length === 3) break; const k = bare(o.ko); if (!wrong.includes(k)) wrong.push(k); }
    q.opts = shuffle([q.ko, ...wrong], r); q.answer = q.ko;
  } else if (shape === 'plain'){
    q.answer = e.w; q.accept = [e.w, e.as].filter(Boolean); q.first = e.w[0];
  } else {
    const b = blankOf(e.key); q.sentence = b.s; q.answer = b.a; q.accept = [b.a];
    /* the high level writes it; the word's plain English gloss stands under the gap, so that the sentence is not a
       riddle (2026-10-17 user, 1가 — English, not Korean, which would turn it into a translation) */
    if (level === 'high'){ q.write = true; q.first = b.a[0]; q.hint = e.plain; }
    else q.opts = shuffle([b.a, ...b.o], r);
  }
  return q;
}
/* an answer of more than one word says so beside the box (2026-10-17 user: "prior to" written as "prior") */
const COUNT = ['', '', '두', '세', '네', '다섯'];
export const wordCount = q => { const n = String(q.answer || '').trim().split(/\s+/).length; return n > 1 ? `<span class="ex-nw">${COUNT[n] || n} 단어</span>` : ''; };
const norm = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim();
export function right(q, given){
  if (given == null || given === '') return false;
  if (q.opts && !q.write) return given === q.answer;
  return (q.accept || [q.answer]).some(a => norm(a) === norm(given));
}

/* a paper handed in: kept, and the professor's regard for a pass */
export function record(id, qs, answers){
  const x = st(id), t = Date.now(), keys = [...new Set(qs.map(q => q.key))];
  const miss = keys.filter(k => qs.some((q, i) => q.key === k && !right(q, answers[i])));
  /* a word asked twice counts once: missed if either time was wrong. The grade is on the questions, though */
  const sit = {t, d: srs.today(), w: keys, miss, n: qs.length, ok: qs.filter((q, i) => right(q, answers[i])).length,
    /* the marked paper itself, sent back with the results notice (2026-10-16, user): each question as asked — its shape
       (m meaning · p write from the gloss · b gap to choose · w gap to write), the word, the options, the answer given,
       the right answer and whether it was right — so that it reads the same later, whatever the word lists become */
    p: qs.map((q, i) => ({s: q.shape === 'mean' ? 'm' : q.shape === 'plain' ? 'p' : q.write ? 'w' : 'b', k: q.key, w: q.w, pos: q.pos,
      x: q.shape === 'plain' ? q.plain : q.shape === 'mean' ? '' : q.sentence, h: q.hint || undefined, o: q.opts && !q.write ? q.opts : undefined, g: answers[i] || '', a: q.answer, r: right(q, answers[i]) ? 1 : 0}))};
  x.s.push(sit); if (x.sent < x.s.length) x.sent = x.s.length;
  const g = gradeAt(sit)[0];
  if (g === 'O') post.announce('owl', id);   // the friends hear of a first Outstanding in a subject (once: post.said)
  if (g === 'O') bond.gain(id, 20); else if (PASS.has(g)) bond.gain(id, 10);
  bond.postItem(id, 'OR-' + t);
  store.save();
  return sit;
}
/* a kept paper back as questions and answers, for exam.js to draw marked (null for a paper sat before papers were kept) */
export function keptPaper(sit){
  if (!sit || !Array.isArray(sit.p)) return null;
  const qs = sit.p.map(p => ({key: p.k, shape: p.s === 'm' ? 'mean' : p.s === 'p' ? 'plain' : 'blank', write: p.s === 'w', w: p.w, pos: p.pos,
    plain: p.s === 'p' ? p.x : '', sentence: p.s === 'b' || p.s === 'w' ? p.x : '', hint: p.h || '', opts: p.o, answer: p.a, ok: !!p.r}));
  return {qs, answers: sit.p.map(p => p.g)};
}
/* the grade of a sitting: on its questions when it has the count, else on its words */
export function gradeAt(sit){ const r = sit.n ? sit.ok / sit.n : sit.w.length ? (sit.w.length - sit.miss.length) / sit.w.length : 0; return GRADES.find(g => r >= g[2] - 1e-9); }
export const gradeLetter = sit => gradeAt(sit)[0];
/* the margin remark for a grade: the same paper always gets the same one */
export function remark(id, sit){ const set = TEXT && TEXT[id] && TEXT[id].remarks && TEXT[id].remarks[gradeLetter(sit)]; return set ? set[sit.t % set.length] : null; }

/* the results so far, best grade per paper: for the notice (OR-<t>) and the record room */
export function results(){
  return PROFS.filter(d => SUBJECT[d.id] && (doors.isOpen(d.id) || st(d.id).s.length)).map(d => {   // only the professors met: a closed door is not a subject yet
    const ss = sittings(d.id); let b = null;
    for (const s of ss){ const g = gradeAt(s); if (!b || RANK[g[0]] > RANK[b.g[0]]) b = {g, s}; }
    return {id: d.id, subject: SUBJECT[d.id], ko: SUBJECT_KO[d.id], examiner: examiner(d.id), best: b, n: ss.length};
  });
}
export function resultText(id, key){
  const t = +key.slice(3), sit = st(id).s.find(s => s.t === t); if (!sit) return null;
  const g = gradeAt(sit);
  return {kind: '성적 통지서', en: `Ordinary Wizarding Level Results.\n${SUBJECT[id]}, ${examiner(id)}: ${g[1]} (${g[0]}).`,
    ko: `O.W.L. 성적 통지서. ${SUBJECT_KO[id]}(${byId(id).ko}): ${g[0]}.`, go: `#/exam/${id}/results/${t}`, btn: sit.p ? '성적 통지서 · 채점된 시험지' : '성적 통지서 보기'};
}

/* ---------- the manor's two tests (2026-10-16, docs/plan-owl.md 1 · 2 · 4): no grade letters, no notices by owl —
   a line on the room's card once the day's work is done.
   The Audit (Lucius): his house ledger, one entry for each word wanting it; due at each object passed at inspection and
   every tenth day of work. Stamped by the lines that do not balance; paid 5 Sickles, 2, or nothing (never a deduction).
   Word for Word (Bellatrix): she gives a word's meaning in plain words, the guest gives her word back, against a clock;
   three misses and she tears the page. Due every fifth day of dictation. A clean page brings coins on the floor.
   Their sittings are kept as the professors' are, with k: 'audit' | 'wfw' (and torn: true for a torn page). */
export const MANOR = {lucius: 'audit', bellatrix: 'wfw'};
const LEAST_M = 6;
const ofKind = (id, k) => sittings(id).filter(s => s.k === k);
export function manorDue(id, words, cards){
  const k = MANOR[id]; if (!k) return false;
  const w = standing(id, words); if (w.all.length < LEAST_M) return false;
  const past = ofKind(id, k); if (forced(id)) return true;   // ?exam=<id>: testing
  if (past.length && past[past.length - 1].d === srs.today()) return false;
  let owed = 0;
  if (k === 'audit'){ const m = store.get().manor || {}; owed = Object.values(m.insp || {}).filter(r => r && r.ok).length + Math.floor((m.days || 0) / 10); }
  else owed = Math.floor((bond.bondOf(id).days || 0) / 5);
  void cards;
  return past.length < owed || forced(id);
}
/* the entries of a ledger / the meanings of a read-back: missed words first, then words not yet asked, then the rest */
export function manorQuestions(id, words, allWords){
  const k = MANOR[id], w = standing(id, words), r = rnd(id + ':' + Date.now()), level = srs.level(), n = k === 'audit' ? 12 : 10;
  const seen = new Set(), pick = [];
  for (const e of [...w.missed, ...shuffle(w.fresh, r), ...shuffle(w.passed, r)]){
    const lw = e.w.toLowerCase(); if (seen.has(lw)) continue;
    if (k === 'audit' && !blankOf(e.key)) continue;   // an entry needs its sentence
    seen.add(lw); pick.push(e); if (pick.length >= n) break;
  }
  const qs = pick.map(e => {
    const q = {key: e.key, w: e.w, pos: e.pos, ko: bare(e.ko), plain: e.plain};
    if (k === 'audit'){
      const b = blankOf(e.key); q.sentence = b.s; q.answer = b.a; q.accept = [b.a];
      /* a gap to be written carries the word's plain English gloss, as on the O.W.L. paper (2026-10-17 user) — unless the
         gloss gives the word away */
      if (level === 'high' || !(b.o && b.o.length === 3)){ q.write = true; q.first = b.a[0]; if (!tells(e)) q.hint = e.plain; } else q.opts = shuffle([b.a, ...b.o], r);
    } else {
      q.answer = e.w; q.accept = [e.w, e.as].filter(Boolean);
      /* the high level writes it, with its first letter (the user, 2026-10-14); the others choose among four of her words */
      if (level === 'high'){ q.write = true; q.first = e.w[0]; }
      else {
        const pool = allWords.filter(o => o.w.toLowerCase() !== e.w.toLowerCase() && !close(o, e)), same = shuffle(pool.filter(o => o.pos === e.pos), r), rest = shuffle(pool.filter(o => o.pos !== e.pos), r);
        const wrong = []; for (const o of [...same, ...rest]){ if (wrong.length === 3) break; if (!wrong.includes(o.w)) wrong.push(o.w); }
        q.opts = shuffle([e.w, ...wrong], r);
      }
    }
    return q;
  });
  /* a gloss that names the answer of another entry would hand it over: that entry's gloss is left off */
  for (const q of qs) if (q.hint){
    const low = q.hint.toLowerCase();
    if (qs.some(o => o !== q && [o.answer, ...(o.accept || [])].some(a => a && new RegExp(`(^|[^a-z])${a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(low)))) delete q.hint;
  }
  return qs;
}
export const WFW_TIME = {low: 20, mid: 15, high: 20};
/* a manor sitting kept; the money it brings (in Sickles) */
export function recordManor(id, qs, answers, extra = {}){
  const x = st(id), t = Date.now(), asked = qs.slice(0, answers.length), keys = asked.map(q => q.key);
  const miss = asked.filter((q, i) => !right(q, answers[i])).map(q => q.key);
  const sit = {t, d: srs.today(), k: MANOR[id], w: keys, miss, n: asked.length, ok: asked.length - miss.length, ...extra,
    p: asked.map((q, i) => ({s: q.write ? 'w' : 'b', k: q.key, w: q.w, pos: q.pos, x: q.sentence || q.plain, h: q.hint || undefined, o: q.opts && !q.write ? q.opts : undefined, g: answers[i] || '', a: q.answer, r: right(q, answers[i]) ? 1 : 0}))};
  x.s.push(sit); store.save();
  return sit;
}
export const auditStamp = n => n === 0 ? ['The accounts balance.', '장부가 맞는다'] : n === 1 ? ['One discrepancy.', '어긋난 줄 하나'] : n === 2 ? ['Two discrepancies.', '어긋난 줄 둘'] : ['This will not do.', '이래서는 안 된다'];
export const auditPay = n => n === 0 ? 5 : n <= 2 ? 2 : 0;
export const manorPast = id => ofKind(id, MANOR[id]);

/* called with the other daily letters (bond.daily): the notice of a paper newly due, one a day */
export async function daily(app){
  /* an Outstanding the group has not heard of yet (offline then, or the rule not yet published): told again, once */
  for (const d of PROFS) if (sittings(d.id).some(s => gradeLetter(s) === 'O')) post.announce('owl', d.id);
  await load(); if (!TEXT) return;
  if (PROFS.some(d => st(d.id).on === srs.today())) return;
  for (const d of PROFS){
    if (!SUBJECT[d.id] || !doors.isOpen(d.id)) continue;
    const words = await app.loadWords(d.id);
    if (notify(d.id, words)) return;   // one notice a day in all: a learner with many words waiting is not sent seven at once
  }
}
