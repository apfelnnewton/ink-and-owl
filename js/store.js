/* Progress lives in one localStorage entry.
   {v, settings, streak:{last, n}, stars:{<cardId#n>: true}, log:{<date>:{<deckId>:{n, good, hard, again, learn}}},
    decks:{<id>:{cards:{<cardId>:{i, d, g, st, t, m, h}}, day:{date, queue, kinds, pos, results, extra, wrong}}}}
   i = interval in days, d = next review date (YYYY-MM-DD), g = last grade (again | hard | good | learn), st = ladder rung,
   t = last date it was answered, m / h = how many times it was missed / nearly right. log feeds the register (records.js).
   Also: bond / bondDay (bond.js), doors (doors.js), friends (post.js), hints (hints.js), wand (wand.js), howl (howler.js), spells (spells.js), map (map.js), prophet (prophet.js). A key not copied in normalise() is lost on reload. */
const KEY = 'hogwarts-english:v1';

export const DEFAULT_SETTINGS = {newPerDay: 5, reviewCap: 30, koFront: false, autoRead: false, prior: true, howler: true, voice: '', surname: '', firstName: '', title: '', named: false, birthday: ''};

function fresh(){ return {v: 1, settings: {...DEFAULT_SETTINGS}, streak: {last: '', n: 0}, decks: {}, stars: {}, log: {}}; }

function normalise(s){
  const out = fresh();
  if (!s || typeof s !== 'object') return out;
  out.settings = {...DEFAULT_SETTINGS, ...(s.settings || {})};
  if (out.settings.title === 'Professor') out.settings.title = '';   // the learner is not a professor (2026-10-04)
  if (s.streak && typeof s.streak === 'object') out.streak = {last: String(s.streak.last || ''), n: +s.streak.n || 0};
  if (s.stars && typeof s.stars === 'object') out.stars = s.stars;
  if (s.log && typeof s.log === 'object') out.log = s.log;
  if (s.bond && typeof s.bond === 'object') out.bond = s.bond;
  if (s.bondDay && typeof s.bondDay === 'object') out.bondDay = s.bondDay;
  if (s.doors && typeof s.doors === 'object' && Array.isArray(s.doors.open)) out.doors = s.doors;
  if (s.friends && typeof s.friends === 'object' && Array.isArray(s.friends.mail)) out.friends = s.friends;
  if (s.hints && typeof s.hints === 'object') out.hints = s.hints;
  if (s.wand && typeof s.wand === 'object') out.wand = s.wand;
  if (s.howl && typeof s.howl === 'object') out.howl = s.howl;
  if (s.spells && typeof s.spells === 'object') out.spells = s.spells;
  if (s.map && typeof s.map === 'object') out.map = s.map;
  if (s.prophet && typeof s.prophet === 'object') out.prophet = s.prophet;
  if (s.decks && typeof s.decks === 'object'){
    for (const [id, d] of Object.entries(s.decks)){
      if (!d || typeof d !== 'object') continue;
      out.decks[id] = {cards: (d.cards && typeof d.cards === 'object') ? d.cards : {}, day: d.day || null};
    }
  }
  return out;
}

let state = fresh();
let storageOk = true;

export function load(){
  try { state = normalise(JSON.parse(localStorage.getItem(KEY) || 'null')); }
  catch (e){ storageOk = false; state = fresh(); }
  return state;
}
export function save(){
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
  catch (e){ storageOk = false; }
  return storageOk;
}
export const get = () => state;
export const canSave = () => storageOk;

export function deck(id){
  if (!state.decks[id]) state.decks[id] = {cards: {}, day: null};
  return state.decks[id];
}

export function exportData(){
  return JSON.stringify({app: 'hogwarts-english', exported: new Date().toISOString(), ...state}, null, 1);
}

/* returns an error message, or '' on success */
export function importData(text){
  let obj;
  try { obj = JSON.parse(text); } catch (e){ return '파일을 읽을 수 없습니다. JSON 형식이 아닙니다.'; }
  if (!obj || typeof obj !== 'object' || !obj.decks || typeof obj.decks !== 'object') return '이 앱에서 내보낸 진도 파일이 아닙니다.';
  state = normalise(obj);
  save();
  return '';
}

export function resetDeck(id){ delete state.decks[id]; save(); }
/* everything gone: progress, letters, teas, gifts, doors, friends' letters, the name (settings.js asks first) */
export function wipe(){ state = fresh(); try { localStorage.removeItem(KEY); } catch (e){} }

/* Another device's progress folded into this one: per card the more recently answered record wins (t, then the later
   due date); a day's session keeps whichever got further; the daily log keeps the larger count per field; stars are
   joined; settings stay this device's. Returns an error message, or '' on success. */
export function mergeData(text){
  let obj;
  try { obj = normalise(JSON.parse(text)); } catch (e){ return '파일을 읽을 수 없습니다. JSON 형식이 아닙니다.'; }
  if (!Object.keys(obj.decks).length && !Object.keys(obj.log).length) return '이 앱에서 보낸 진도 파일이 아닙니다.';
  const newer = (a, b) => (a.t || '') !== (b.t || '') ? (a.t || '') > (b.t || '') : (a.d || '') > (b.d || '');
  let cards = 0;
  for (const [id, od] of Object.entries(obj.decks)){
    const md = deck(id);
    for (const [cid, oc] of Object.entries(od.cards)){
      const mc = md.cards[cid];
      if (!mc || newer(oc, mc)){ md.cards[cid] = oc; cards++; }
    }
    const a = md.day, b = od.day;
    if (b && (!a || b.date > a.date || (b.date === a.date && (b.pos || 0) > (a.pos || 0)))) md.day = b;
  }
  for (const [date, decks] of Object.entries(obj.log)){
    const mine = state.log[date] || (state.log[date] = {});
    for (const [id, o] of Object.entries(decks)){
      const m = mine[id] || (mine[id] = {});
      for (const [k, v] of Object.entries(o)) m[k] = Math.max(m[k] || 0, +v || 0);
    }
  }
  Object.assign(state.stars, obj.stars);
  /* the professors: keep the closer relationship, and every piece of post either device received */
  for (const [id, ob] of Object.entries(obj.bond || {})){
    const mine = (state.bond || (state.bond = {}))[id];
    if (!mine){ state.bond[id] = ob; continue; }
    const base = (ob.pts || 0) > (mine.pts || 0) ? ob : mine, other = base === ob ? mine : ob;
    base.sent = {...other.sent, ...base.sent};
    const have = new Set((base.mail || []).map(m => m.id));
    base.mail = [...(base.mail || []), ...(other.mail || []).filter(m => !have.has(m.id))].sort((a, b) => a.t < b.t ? -1 : 1);
    base.teas = {...other.teas, ...base.teas}; base.keep = {...other.keep, ...base.keep};
    if (base.teaLog || other.teaLog) base.teaLog = {...other.teaLog, ...base.teaLog};
    state.bond[id] = base;
  }
  /* doors opened on either device stay open; friends' letters from either device are all kept (the group stays this device's) */
  if (obj.hints) state.hints = {...obj.hints, ...(state.hints || {})};
  /* the wand made more recently wins; Ollivander's note counts as arrived if either device had it */
  if (obj.wand){ const a = state.wand || {}, b = obj.wand; state.wand = (b.d || '') > (a.d || '') ? {...b, note: a.note || b.note} : {...a, note: a.note || b.note}; }
  if (obj.doors){ const d = state.doors || (state.doors = {open: [], first: obj.doors.first || ''}); d.open = [...new Set([...d.open, ...obj.doors.open])]; }
  if (obj.friends){
    const fr = state.friends || (state.friends = {...obj.friends, mail: []}), have = new Set(fr.mail.map(m => m.id));
    fr.mail.push(...obj.friends.mail.filter(m => !have.has(m.id)));
  }
  if ((obj.streak.last || '') >(state.streak.last || '') || (obj.streak.last === state.streak.last && obj.streak.n > state.streak.n)) state.streak = obj.streak;
  save();
  return '';
}
