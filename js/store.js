/* Progress lives in one localStorage entry.
   {v, settings, streak:{last, n}, stars:{<cardId#n>: true}, log:{<date>:{<deckId>:{n, good, hard, again, learn}}},
    decks:{<id>:{cards:{<cardId>:{i, d, g, st, t, m, h}}, day:{date, queue, kinds, pos, results, extra, wrong}}}}
   i = interval in days, d = next review date (YYYY-MM-DD), g = last grade (again | hard | good | learn), st = ladder rung,
   t = last date it was answered, m / h = how many times it was missed / nearly right. log feeds the register (records.js).
   Also: bond / bondDay (bond.js), doors (doors.js), friends (post.js), hints (hints.js), wand (wand.js), howl (howler.js), spells (spells.js), map (map.js), prophet (prophet.js), need (need.js), wrote (friends.js), census (census.js), sync / stamp / cleared (sync.js and mergeData below). A key not copied in normalise() is lost on reload. */
const KEY = 'hogwarts-english:v1';

export const DEFAULT_SETTINGS = {newPerDay: 5, reviewCap: 30, koFront: false, autoRead: false, prior: true, howler: true, voice: '', surname: '', firstName: '', title: '', named: false, birthday: '', level: 'mid', quiet: false, door: false, doorWord: ''};

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
  if (s.need && typeof s.need === 'object') out.need = s.need;
  if (s.fire && typeof s.fire === 'object') out.fire = s.fire;       // the fireplace in my room: Sirius (fire.js)
  if (s.manor && typeof s.manor === 'object') out.manor = s.manor;   // work at Malfoy Manor (manor.js)
  if (Number.isFinite(+s.purse) && +s.purse > 0) out.purse = Math.floor(+s.purse);   // money, in Knuts (manor.js)
  if (s.shop && typeof s.shop === 'object') out.shop = s.shop;   // the paper bag and the presents sent (shops.js)
  if (s.census && typeof s.census === 'object') out.census = s.census;
  if (s.sync && typeof s.sync === 'object') out.sync = s.sync;         // where this device stands with the caretaker's other devices (sync.js)
  if (s.stamp && typeof s.stamp === 'object') out.stamp = s.stamp;     // when the stars, the purse, the bag, the hidden room last changed here
  if (s.cleared && typeof s.cleared === 'object') out.cleared = s.cleared;   // decks wiped on purpose, and the day: {<deckId>: date}   // what this device last told the caretaker's ledger (census.js)
  if (s.wrote && typeof s.wrote === 'object') out.wrote = s.wrote;   // expressions used in letters to friends (friends.js): {<cardId#n>: times}
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
  mendStreak();
  return state;
}
/* The days in a row are what the register says they are: counted back from the last day studied through every day that has an
   entry. Two devices each keep their own count, and until 2026-10-13 a merge simply took the count of the device that had studied
   last — a laptop used for the first time today handed its "2" to a phone that had many days (the maker lost a streak that way).
   The register of both devices is joined before this is called, so the count comes out right whichever device studied when.
   It only ever raises the number: a count the register cannot account for (older than the register) is left alone.
   There is no setting the number by hand, on purpose (the maker: a count that can be typed in is a count that lies) — the register
   is the only source, and a wrong register is put right in the register (sync-core.js mendRegister). */
const dayBefore = d => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() - 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
export function mendStreak(){
  const s = state.streak, log = state.log || {};
  if (!s || !/^\d{4}-\d\d-\d\d$/.test(s.last || '')) return false;
  let n = 0, d = s.last;
  while (n < 5000 && log[d] && typeof log[d] === 'object' && Object.keys(log[d]).length){ n++; d = dayBefore(d); }
  if (n > (+s.n || 0)){ s.n = n; return true; }
  return false;
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

/* a deck wiped on purpose is remembered with its day, so that another of the caretaker's devices does not hand the old cards back */
const dayNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function resetDeck(id){ delete state.decks[id]; (state.cleared || (state.cleared = {}))[id] = dayNow(); save(); }
/* the progress as another of the caretaker's devices should receive it: not this device's settings, its place in a friends' group,
   or its own book-keeping with the server */
export function syncable(){ const {settings, friends, census, sync, ...rest} = state; return rest; }
let joinedAny = false;
export const mergedByJoining = () => joinedAny;   // the last merge had to join two copies of something stamped: the result is news to the other device too
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
  /* Stamps (sync.js sets them when the thing changes on a device): where both copies carry one, the more recently changed copy is
     taken whole — so that money spent, a thing given or found, a star removed stays so. Where either has none, the joining rules
     below, as for a file carried by hand. */
  const ms = state.stamp || (state.stamp = {}), os = obj.stamp || {};
  joinedAny = false;
  const whole = k => { if (!(os[k] && ms[k])) return 0; if (os[k] > ms[k]){ ms[k] = os[k]; return 1; } return -1; };   // 1 theirs · -1 mine · 0 join
  const joined = k => { if (os[k]){ ms[k] = Date.now(); joinedAny = true; } };
  /* a deck wiped on purpose on either device stays wiped: cards from before that day are dropped, on whichever side they are */
  const mcl = state.cleared || (state.cleared = {}), ocl = obj.cleared || {}, cut = {};
  for (const id of new Set([...Object.keys(mcl), ...Object.keys(ocl)])){
    const a = mcl[id] || '', b = ocl[id] || '';
    if (b > a){ mcl[id] = b; const md = state.decks[id]; if (md){ for (const [cid, c] of Object.entries(md.cards)) if ((c.t || '') <= b) delete md.cards[cid]; if (md.day && md.day.date <= b) md.day = null; } }
    else if (a > b) cut[id] = a;
  }
  for (const [id, od] of Object.entries(obj.decks)){
    const md = deck(id);
    for (const [cid, oc] of Object.entries(od.cards)){
      if (cut[id] && (oc.t || '') <= cut[id]) continue;
      const mc = md.cards[cid];
      if (!mc || newer(oc, mc)){ md.cards[cid] = oc; cards++; }
    }
    const a = md.day, b = cut[id] && od.day && od.day.date <= cut[id] ? null : od.day;
    if (b && (!a || b.date > a.date || (b.date === a.date && (b.pos || 0) > (a.pos || 0)))) md.day = b;
  }
  for (const [date, decks] of Object.entries(obj.log)){
    const mine = state.log[date] || (state.log[date] = {});
    for (const [id, o] of Object.entries(decks)){
      const m = mine[id] || (mine[id] = {});
      for (const [k, v] of Object.entries(o)) m[k] = Math.max(m[k] || 0, +v || 0);
    }
  }
  { const w = whole('stars'); if (w === 1) state.stars = obj.stars || {}; else if (w === 0){ Object.assign(state.stars, obj.stars); joined('stars'); } }
  for (const [k, v] of Object.entries(obj.wrote || {})){ const w = state.wrote || (state.wrote = {}); w[k] = Math.max(w[k] || 0, +v || 0); }
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
  if (obj.fire) state.fire = {...obj.fire, ...(state.fire || {})};
  if (obj.manor){ const a = state.manor || {}, b = obj.manor; state.manor = (b.days || 0) > (a.days || 0) ? {...a, ...b, seen: {...a.seen, ...b.seen}} : {...b, ...a, seen: {...b.seen, ...a.seen}}; }
  { const w = whole('purse'); if (w === 1){ if (obj.purse) state.purse = obj.purse; else delete state.purse; } else if (w === 0){ if (obj.purse) state.purse = Math.max(state.purse || 0, obj.purse); joined('purse'); } }
  /* the shops: whichever device has sent more presents keeps its bag and its tallies (adding two bags would double what was bought once) */
  { const w = whole('shop');
    if (w === 1){ if (obj.shop) state.shop = obj.shop; }
    else if (w === 0){ if (obj.shop){ const tot = x => Object.values((x || {}).n || {}).reduce((a, n) => a + n, 0); if (!state.shop || tot(obj.shop) > tot(state.shop)) state.shop = {...obj.shop, open: (state.shop || {}).open || obj.shop.open}; } joined('shop'); } }
  /* the wand made more recently wins; Ollivander's note counts as arrived if either device had it */
  if (obj.wand){ const a = state.wand || {}, b = obj.wand; state.wand = (b.d || '') > (a.d || '') ? {...b, note: a.note || b.note} : {...a, note: a.note || b.note}; }
  if (obj.doors){ const d = state.doors || (state.doors = {open: [], first: obj.doors.first || ''}); d.open = [...new Set([...d.open, ...obj.doors.open])]; }
  if (obj.friends){
    const fr = state.friends || (state.friends = {...obj.friends, mail: []}), have = new Set(fr.mail.map(m => m.id));
    fr.mail.push(...obj.friends.mail.filter(m => !have.has(m.id)));
  }
  /* what came after this function was first written, and so was left behind on the other device (2026-10-12): the spells
     learnt, the map, the issues of the Prophet, the Room of Requirement, the Howlers already sent */
  if (obj.spells){
    const a = state.spells || (state.spells = {sent: {}, learnt: {}}), b = obj.spells;
    a.sent = a.sent || {}; a.learnt = a.learnt || {};
    for (const [id, d] of Object.entries(b.sent || {})) if (!a.sent[id] || d < a.sent[id]) a.sent[id] = d;
    for (const [id, r] of Object.entries(b.learnt || {})){ const m = a.learnt[id]; if (!m || (+r.i || 0) > (+m.i || 0) || ((+r.i || 0) === (+m.i || 0) && (r.due || '') > (m.due || ''))) a.learnt[id] = r; }   // the further along of the two
    if ((b.day || '') > (a.day || '')) a.day = b.day;
  }
  if (obj.map && obj.map.got && !(state.map || {}).got) state.map = {...obj.map};
  if (obj.prophet && Array.isArray(obj.prophet.got)){
    const p = state.prophet || (state.prophet = {got: []}); if (!Array.isArray(p.got)) p.got = [];
    for (const it of obj.prophet.got){
      const m = p.got.find(x => x.n === it.n);
      if (!m) p.got.push(it); else { m.read = m.read || it.read; if (m.puz === undefined && it.puz !== undefined) m.puz = it.puz; }   // an issue is kept as this device received it
    }
    p.got.sort((x, y) => x.n - y.n);
  }
  const wn = whole('need');
  if (wn === 1){ if (obj.need) state.need = obj.need; }
  else if (wn === 0 && obj.need){
    const a = state.need || (state.need = {hidden: {}, found: {}}), b = obj.need;
    a.hidden = a.hidden || {}; a.found = a.found || {};
    for (const k of ['ready', 'open', 'round']) if (!a[k] && b[k]) a[k] = b[k];
    for (const [k, n] of Object.entries(b.found || {})) a.found[k] = Math.max(+a.found[k] || 0, +n || 0);
    for (const [k, h] of Object.entries(b.hidden || {})) if (!a.hidden[k]) a.hidden[k] = h;   // a thing found on one device only may have to be found once more
    joined('need');
  }
  if (obj.howl && (obj.howl.last || '') > ((state.howl || {}).last || '')){
    const n = {...((state.howl || {}).n || {})}; for (const [k, v] of Object.entries(obj.howl.n || {})) n[k] = Math.max(+n[k] || 0, +v || 0);
    state.howl = {...obj.howl, n};
  }
  if ((obj.streak.last || '') >(state.streak.last || '') || (obj.streak.last === state.streak.last && obj.streak.n > state.streak.n)) state.streak = {...obj.streak};
  mendStreak();   // …and then counted from the joined register, so that a device new to the progress does not shorten it
  save();
  return '';
}
