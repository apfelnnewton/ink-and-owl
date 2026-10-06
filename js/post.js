/* The owl post between friends (2026-10-04 user decision, CLAUDE.md "친구 그룹"). Up to eight people share a group
   code; each holds one player seal nobody else in the group has; letters between them are English only, at most 600
   characters. Every letter, sent or received, is kept on this phone (state.friends.mail) — the server only carries
   them: the recipient's phone saves a letter and deletes it from the server; the sender's phone clears any of its own
   still waiting after 30 days. When someone leaves the group, the letters to and from them go from every phone
   (2026-10-05 user decision): the others' phones drop them when that seal disappears, and the leaver's own phone
   drops all its friends' letters.
   state.friends = {uid, code, seal, practice, members:[{uid, name, seal, wand}], mail:[{id, from, to, t, at, text, read, seen}]}
   wand = the wood of that friend's wand (wand.js), kept on their seal so a read letter can show it (2026-10-05).
   day = {d, rooms} that friend's classrooms today, in order, for the Marauder's Map (map.js, 2026-10-06).
   t = date (YYYY-MM-DD), at = arrival time (ms) — a letter whose time has not come yet is still on the wing;
   seen = the owl has already brought it (owl.js), read = it has been opened.
   Server: Firebase project "ink-and-owl" (js/firebase-config.js, rules in firestore.rules), signed in anonymously.
   The SDK is loaded from Google's CDN only when the friends' group is used, so studying never needs the network.
   Add ?practice to the address to use the PRACTICE post office instead: three made-up friends who answer within a
   minute, no server (for trying the screens). */
import * as store from './store.js';
import * as srs from './srs.js';
import {firebaseConfig} from './firebase-config.js';
import * as wand from './wand.js';

export const SEALS = [
  {id: 'lion', en: 'Lion', ko: '사자'}, {id: 'serpent', en: 'Serpent', ko: '뱀'}, {id: 'eagle', en: 'Eagle', ko: '독수리'},
  {id: 'badger', en: 'Badger', ko: '오소리'}, {id: 'thestral', en: 'Thestral', ko: '세스트랄'}, {id: 'spider', en: 'Spider', ko: '거미'}
];
export const MAX_MEMBERS = 8, LIMIT = 600;
export const sealOf = id => SEALS.find(s => s.id === id) || null;
/* the owls carry English only: any Korean (or other CJK) script stops the letter */
export const foreign = s => /[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ㐀-鿿]/.test(s);
export const codeOk = s => /^[A-HJ-NP-Z2-9]{6}$/.test(s);
const PRACTICE_MODE = /[?&]practice\b/.test(location.search);
export const practiceMode = () => PRACTICE_MODE;

const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

function f(){
  const s = store.get();
  if (!s.friends) s.friends = {uid: '', code: '', seal: '', practice: false, members: [], mail: []};
  return s.friends;
}
export const myName = () => store.get().settings.firstName || 'friend';

/* someone listening for news from the post (app.js: bring the owl, redraw the counts) */
let notify = () => {};
export function onChange(fn){ notify = fn; }

/* ---------- the practice post office (no server): made-up friends, canned answers */
const PRACTICE = [
  {uid: 'p-clara', name: 'Clara', seal: 'eagle', wand: 'hazel'},
  {uid: 'p-theo', name: 'Theo', seal: 'badger', wand: 'oak'},
  {uid: 'p-iris', name: 'Iris', seal: 'thestral', wand: 'willow'}
];
const HELLO = {from: 'p-clara', text: "Hello! I've just found the Owlery — it's freezing up here, and an owl keeps staring at me. " +
  "Snape made me say 'I don't recall asking for your opinion' three times today. I think I'm getting the hang of it. Write back?"};
const REPLIES = {
  'p-clara': ["Your letter made my morning. McGonagall caught me yawning in Transfiguration, so I needed it. Tell me which line you're stuck on.",
    "I tried your trick and it worked! Dumbledore's riddles are still beyond me, though. Write again soon."],
  'p-theo': ["Cheers for the owl. Mine got lost twice — I think it doesn't like me. Lupin's lesson was brilliant today, by the way.",
    "Ha! I laughed out loud on the bus. Slughorn invited me to tea and I picked the worst answer. Never again."],
  'p-iris': ["Thank you for writing. It's quiet up in my tower, and your letter was a nice surprise. I'm halfway through Moody's lines.",
    "I read your letter twice. Umbridge gave me a very pink look today — I still don't know what I did."]
};
function arrive({from, text}, delay){
  const fr = f(), now = Date.now();
  fr.mail.push({id: 'm' + now.toString(36) + rnd(3), from, to: fr.uid, t: srs.today(), at: now + delay, text, read: false, seen: false});
  store.save();
}
const practice = {
  async uid(){ return f().uid || 'u' + rnd(10).toLowerCase(); },
  async create(){ return {code: rnd(6)}; },
  async join(code){ return {code}; },
  async seals(){ return PRACTICE.slice(); },
  async claim(){
    const fr = f(); if (!fr.mail.length) arrive(HELLO, 8000);
    /* and a piece of news, so the professors have something to tell */
    queueNews({id: 'pn-' + rnd(6), from: 'p-clara', name: 'Clara', type: 'door', deck: 'lupin', at: Date.now()});
    setTimeout(() => notify(), 3000);
    return '';
  },
  async announce(){},
  async leave(){},
  async send(m){
    const fr = f(), to = PRACTICE.find(p => p.uid === m.to); if (!to) return '';
    const n = fr.mail.filter(x => x.to === to.uid).length - 1, list = REPLIES[to.uid];   // this is my n-th letter to them
    arrive({from: to.uid, text: list[n % list.length]}, 25000);
    return '';
  },
  listen(){}
};

/* ---------- the real post office: Firebase (Firestore + anonymous sign-in) */
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
let fb = null, connecting = null;
function connect(){
  if (fb) return Promise.resolve(fb);
  if (connecting) return connecting;
  connecting = (async () => {
    const [{initializeApp}, A, F] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
    const app = initializeApp(firebaseConfig), auth = A.getAuth(app);
    await auth.authStateReady();
    if (!auth.currentUser) await A.signInAnonymously(auth);
    fb = {F, db: F.getFirestore(app), uid: auth.currentUser.uid};
    return fb;
  })().catch(e => { connecting = null; throw e; });
  return connecting;
}
const g = (code, ...p) => fb.F.doc(fb.db, 'groups', code, ...p);
const col = (code, name) => fb.F.collection(fb.db, 'groups', code, name);
const OFFLINE = '부엉이 우체국에 닿지 못했습니다. 인터넷 연결을 확인해 주세요.';

const firebase = {
  async uid(){ return (await connect()).uid; },
  async create(){
    const {F} = await connect();
    for (let i = 0; i < 4; i++){
      const code = rnd(6);
      try { await F.setDoc(g(code), {by: fb.uid, t: F.serverTimestamp()}); return {code}; }
      catch (e){ /* that code is taken (or the network failed): try another */ }
    }
    throw new Error('create');
  },
  async join(code){
    const {F} = await connect();
    const s = await F.getDoc(g(code));
    return s.exists() ? {code} : null;
  },
  async seals(code){
    const {F} = await connect();
    const q = await F.getDocs(col(code, 'seals'));
    return q.docs.map(d => ({uid: d.data().uid, name: d.data().name, seal: d.id, wand: d.data().wand || ''}));
  },
  /* take a seal and become a member in one go; fails if someone took that seal first */
  async claim(code, seal, name){
    const {F} = await connect();
    const b = F.writeBatch(fb.db);
    b.set(g(code, 'seals', seal), {uid: fb.uid, name});
    b.set(g(code, 'members', fb.uid), {name, seal});
    try { await b.commit(); return ''; } catch (e){ return 'taken'; }
  },
  async leave(code, seal){
    const {F} = await connect();
    const b = F.writeBatch(fb.db);
    b.delete(g(code, 'members', fb.uid));
    if (seal) b.delete(g(code, 'seals', seal));
    await b.commit();
  },
  async send(m, code){
    const {F} = await connect();
    try { await F.addDoc(col(code, 'mail'), {from: fb.uid, to: m.to, text: m.text, at: F.serverTimestamp()}); return ''; }
    catch (e){ return OFFLINE; }
  },
  async announce(code, type, deck){
    const {F} = await connect();
    await F.addDoc(col(code, 'news'), {from: fb.uid, type, deck, at: F.serverTimestamp()});
  },
  /* while the app is open: letters addressed to me land on the phone (and leave the server); the members list stays current */
  listen(code){
    const {F} = fb;
    stopListening();
    const mine = F.query(col(code, 'mail'), F.where('to', '==', fb.uid));
    unsub.push(F.onSnapshot(mine, snap => {
      const fr = f(); let got = 0;
      snap.docs.forEach(d => {
        const x = d.data();
        if (!fr.mail.some(m => m.id === d.id)){
          fr.mail.push({id: d.id, from: x.from, to: fb.uid, t: srs.today(), at: Date.now(), text: String(x.text || ''), read: false, seen: false});
          got++;
        }
        F.deleteDoc(d.ref).catch(() => {});
      });
      if (got){ store.save(); notify(); }
    }, () => {}));
    unsub.push(F.onSnapshot(col(code, 'seals'), snap => {
      const fr = f();
      fr.members = snap.docs.filter(d => d.data().uid !== fb.uid).map(d => ({uid: d.data().uid, name: d.data().name, seal: d.id, wand: d.data().wand || '', day: d.data().day || null}));
      /* someone has left (their seal is gone): the letters to and from them, and their news, go from this phone too.
         Only on a fresh answer from the server, never on a stale copy. */
      if (!snap.metadata.fromCache){
        const here = new Set([fb.uid, ...fr.members.map(m => m.uid)]), other = m => m.from === fb.uid ? m.to : m.from;
        const before = fr.mail.length;
        fr.mail = fr.mail.filter(m => here.has(other(m)));
        if (fr.news) fr.news = fr.news.filter(n => here.has(n.from));
        if (fr.mail.length !== before) notify();
      }
      /* my own seal carries my wand's wood; put it right if it is missing or out of date */
      const own = snap.docs.find(d => d.data().uid === fb.uid), mine = (wand.get() || {}).wood || '';
      if (own && mine && (own.data().wand || '') !== mine) F.updateDoc(own.ref, {wand: mine}).catch(() => {});
      store.save(); notify();
    }, () => {}));
    /* friends' milestones of the last fortnight that this phone has not heard yet: a professor will pass them on */
    const since = F.Timestamp.fromMillis(Date.now() - 14 * 864e5);
    unsub.push(F.onSnapshot(F.query(col(code, 'news'), F.where('at', '>', since)), snap => {
      let got = 0;
      snap.docs.forEach(d => {
        const x = d.data(); if (x.from === fb.uid) return;
        const who = f().members.find(m => m.uid === x.from);
        if (queueNews({id: d.id, from: x.from, name: who ? who.name : '', type: x.type, deck: x.deck || '', at: x.at ? x.at.toMillis() : Date.now()})) got++;
      });
      if (got) notify();
    }, () => {}));
    /* my own letters nobody collected, and my own news, after 30 days */
    const old = F.Timestamp.fromMillis(Date.now() - 30 * 864e5);
    for (const name of ['mail', 'news'])
      F.getDocs(F.query(col(code, name), F.where('from', '==', fb.uid), F.where('at', '<', old)))
        .then(q => q.docs.forEach(d => F.deleteDoc(d.ref).catch(() => {}))).catch(() => {});
  }
};
let unsub = [];
function stopListening(){ unsub.forEach(u => { try { u(); } catch (e){} }); unsub = []; }

const backend = () => f().practice || (PRACTICE_MODE && !f().code) ? practice : firebase;

/* ---------- what the screens use */
export const inGroup = () => !!(f().code && f().seal);
export const joined = () => !!f().code;               // code entered, seal not yet chosen
export const isPractice = () => f().practice;
export const code = () => f().code;
export const myUid = () => f().uid;
export const mySeal = () => f().seal;
export const members = () => f().members;
export const memberOf = uid => uid === f().uid ? {uid, name: myName(), seal: f().seal, wand: (wand.get() || {}).wood || ''} : f().members.find(m => m.uid === uid) || {uid, name: '?', seal: ''};
export const takenSeals = () => new Map(f().members.map(m => [m.seal, m.name]));

/* the Marauder's Map (map.js): today's classrooms, in order, go onto my seal — only the date and the professors' ids */
export function shareDay(rooms){
  const fr = f(); if (!fr.code || !fr.seal || backend() === practice) return;
  connect().then(({F}) => F.updateDoc(g(fr.code, 'seals', fr.seal), {day: {d: srs.today(), rooms: rooms.slice(0, 7)}})).catch(() => {});
}

/* a new wand (ollivander.js): its wood goes onto my seal for the friends to see */
export function shareWand(){
  const fr = f(), w = wand.get(); if (!w || !fr.code || !fr.seal || backend() === practice) return;
  connect().then(({F}) => F.updateDoc(g(fr.code, 'seals', fr.seal), {wand: w.wood})).catch(() => {});
}

/* letters that have arrived (their time has come), newest first; sent ones are always "arrived" */
export const letters = () => f().mail.filter(m => m.from === f().uid || m.at <= Date.now()).sort((a, b) => b.at - a.at);
export const letterOf = id => f().mail.find(m => m.id === id);
export const unread = (uid) => f().mail.filter(m => m.to === f().uid && m.at <= Date.now() && !m.read && (!uid || m.from === uid)).length;
/* the next letter an owl should bring (arrived, not yet brought) */
export const undelivered = () => f().mail.filter(m => m.to === f().uid && m.at <= Date.now() && !m.seen).sort((a, b) => a.at - b.at)[0] || null;
export const markSeen = id => { const m = letterOf(id); if (m && !m.seen){ m.seen = true; store.save(); } };
export const markRead = id => { const m = letterOf(id); if (m && !m.read){ m.read = m.seen = true; store.save(); } };

/* each returns an error message, or '' */
export async function create(){
  const be = PRACTICE_MODE ? practice : firebase;
  try {
    const uid = await be.uid(), r = await be.create();
    Object.assign(f(), {uid, code: r.code, seal: '', members: await be.seals(r.code), practice: be === practice});
    store.save(); return '';
  } catch (e){ return OFFLINE; }
}
export async function join(c){
  c = String(c).trim().toUpperCase();
  if (!codeOk(c)) return '그룹 코드는 영문과 숫자 6자리입니다.';
  const be = PRACTICE_MODE ? practice : firebase;
  try {
    const uid = await be.uid(), r = await be.join(c);
    if (!r) return '그 코드의 그룹이 없습니다. 코드를 다시 확인해 주세요.';
    const list = await be.seals(c);
    if (list.length >= MAX_MEMBERS) return '이 그룹은 이미 8명이 모두 찼습니다.';
    Object.assign(f(), {uid, code: c, seal: '', members: list, practice: be === practice});
    store.save(); return '';
  } catch (e){ return OFFLINE; }
}
/* the seals already taken, fresh from the post (for the chooser) */
export async function refreshSeals(){
  const fr = f(); if (!fr.code) return;
  try { fr.members = (await backend().seals(fr.code)).filter(m => m.uid !== fr.uid); store.save(); } catch (e){}
}
export async function pickSeal(id){
  const fr = f();
  if (!sealOf(id) || takenSeals().has(id)) return '그 도장은 이미 다른 사람이 가졌습니다.';
  let err;
  try { err = await backend().claim(fr.code, id, myName()); } catch (e){ return OFFLINE; }
  if (err === 'taken'){ await refreshSeals(); return '그 도장은 방금 다른 사람이 가져갔습니다.'; }
  if (err) return err;
  fr.seal = id; store.save();
  start();
  return '';
}
/* leaving takes the friends' letters off this phone as well (2026-10-05 user decision); the others' phones drop the
   letters to and from me when my seal disappears */
export async function leave(){
  const fr = f();
  stopListening();
  try { await backend().leave(fr.code, fr.seal); } catch (e){ /* the server copy is cleared next time; the phone forgets now */ }
  Object.assign(fr, {code: '', seal: '', members: [], practice: false, mail: [], news: []}); store.save();
}

export async function send(to, text){
  text = String(text).replace(/\r/g, '').trim();
  if (!text) return '편지가 비어 있습니다.';
  if (foreign(text)) return '부엉이는 영어 편지만 나릅니다.';
  if (text.length > LIMIT) return `${LIMIT}자까지 쓸 수 있습니다.`;
  const fr = f(), now = Date.now();
  const m = {id: 'm' + now.toString(36) + rnd(3), from: fr.uid, to, t: srs.today(), at: now, text, read: true, seen: true};
  const err = await backend().send(m, fr.code);
  if (err) return err;
  fr.mail.push(m); store.save();
  return '';
}

/* ---------- news of friends (2026-10-04 user decision): a friend's milestone — a door opened, a professor grown close,
   a classroom fully learnt, a birthday — reaches the others, and a professor tells it in a letter (bond.js, max one a
   day). f().news = [{id, from, name, type, deck, at, told}] (kept to the last 60); f().said = {"type:deck": date}. */
export const NEWS_TYPES = ['door', 'stage', 'learnt', 'bday'];
function queueNews(n){
  const fr = f(); if (!fr.news) fr.news = [];
  if (!NEWS_TYPES.includes(n.type) || fr.news.some(x => x.id === n.id) || Date.now() - n.at > 14 * 864e5) return false;
  fr.news.push({...n, told: false});
  if (fr.news.length > 60) fr.news = fr.news.slice(-60);
  store.save();
  return true;
}
/* the oldest news not yet told, with the friend's current name */
export function nextNews(){
  const fr = f(), n = (fr.news || []).filter(x => !x.told && Date.now() - x.at < 14 * 864e5).sort((a, b) => a.at - b.at)[0];
  if (!n) return null;
  const m = fr.members.find(x => x.uid === n.from);
  return {...n, name: (m && m.name) || n.name || 'your friend'};
}
export const markNewsTold = id => { const n = (f().news || []).find(x => x.id === id); if (n){ n.told = true; store.save(); } };
/* tell the group about one of my milestones — each one once (a birthday once a year), and only from a real group */
export function announce(type, deck = '', once = ''){
  const fr = f();
  if (!inGroup() || fr.practice || !NEWS_TYPES.includes(type)) return;
  const key = `${type}:${deck}${once ? ':' + once : ''}`;
  fr.said = fr.said || {};
  if (fr.said[key]) return;
  fr.said[key] = srs.today(); store.save();
  firebase.announce(fr.code, type, deck).catch(() => { delete fr.said[key]; store.save(); });   // try again next time
}

/* app start (and back online): open the post office if this phone is in a group */
export function start(){
  const fr = f();
  if (!inGroup() || fr.practice) return;
  connect().then(() => {
    if (fb.uid !== fr.uid){ fr.seal = ''; store.save(); notify(); return; }   // this phone lost its pass: choose a seal again
    firebase.listen(fr.code);
    /* the name on my seal follows the name in settings */
    const mine = fr.seal && myName();
    fb.F.updateDoc(g(fr.code, 'seals', fr.seal), {uid: fb.uid, name: mine}).catch(() => {});
    fb.F.updateDoc(g(fr.code, 'members', fb.uid), {name: mine, seal: fr.seal}).catch(() => {});
  }).catch(() => {});
}
addEventListener('online', () => { if (!unsub.length) start(); });
