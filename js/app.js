/* Start-up and routing. #/ corridor · #/room/<deck>[/extra|/wrong] classroom · #/report/<deck> end of lesson ·
   #/notes/<deck> expression notebook · #/script/<deck> the script · #/records the register · #/me your own room ·
   #/me/cabinet/<deck> the gift drawers · #/me/journal/<deck> the tea journal · #/me/wand the wand box ·
   #/ollivander[/again] the wand shop · #/spell/<id>[/review] a spell lesson or its page · #/me/spells the spellbook · #/map the Marauder's Map · #/prophet[/<n>] the Daily Prophet · #/need[/end|/shelf] the Room of Requirement ·
   #/letters/<deck|friends> owl post (on the desk in your room; friends' letters in the first tab) · #/settings */
import * as store from './store.js';
import {DECKS, byId} from './decks.js';
import {initHome} from './home.js';
import {initRoom} from './room.js';
import {initReport} from './report.js';
import {initSettings} from './settings.js';
import {initNotes} from './notes.js';
import {initRecords} from './records.js';
import {initScript} from './script.js';
import {initLetters} from './letters.js';
import {initMyRoom} from './myroom.js';
import {initOllivander} from './ollivander.js';
import {initSpell} from './spell.js';
import {initMap} from './map.js';
import * as wand from './wand.js';
import * as bond from './bond.js';
import * as post from './post.js';
import {deliver, deliverWandNote, deliverHowler, deliverProphet, owlBusy} from './owl.js';
import * as prophet from './prophet.js';
import {initProphet} from './prophet.js';
import * as need from './need.js';
import {initNeed} from './need.js';
import * as howler from './howler.js';
import {askName} from './welcome.js';
import * as door from './door.js';
import {hint} from './hints.js';
import * as grammar from './grammar.js';
import {$$, wait, closeSheet, isSheetOpen} from './ui.js';

store.load();

const app = {
  index: null,
  data: {},
  leftRoom: null,
  fontsReady: Promise.race([
    Promise.all(['22px "Fredericka the Great"', 'italic 16px "IM Fell English"', '15px "Gowun Batang"'].map(f => document.fonts.load(f))).catch(() => {}),
    wait(3000)
  ]),
  async loadDeck(id){
    if (app.data[id]) return app.data[id];
    const d = byId(id);
    const res = await fetch('data/' + d.file);
    if (!res.ok) throw new Error(res.status);
    app.data[id] = await res.json();
    return app.data[id];
  },
  practice: {},
  async loadPractice(id){
    if (app.practice[id]) return app.practice[id];
    const d = byId(id);
    if (!d.practice) return (app.practice[id] = {});
    try { const r = await fetch('practice/' + d.practice); app.practice[id] = r.ok ? await r.json() : {}; }
    catch (e){ return {}; }
    return app.practice[id];
  },
  examples: {},
  async loadExamples(id){
    if (app.examples[id]) return app.examples[id];
    const d = byId(id);
    if (!d.examples) return (app.examples[id] = {});
    try { const r = await fetch('practice/' + d.examples); app.examples[id] = r.ok ? await r.json() : {}; }
    catch (e){ return {}; }
    return app.examples[id];
  },
  go(hash, replace){
    if (replace){ history.replaceState(null, '', hash); route(); }
    else if (location.hash === hash) route();
    else location.hash = hash;
  },
  refresh(){ screens.home.refresh(); },
  /* the daily owl with a tea invitation: only on calm screens (not mid-lesson), never over an open sheet */
  owlCheck(){
    if (app.entering || howler.playing() || !store.get().settings.named || !['home', 'me', 'letters', 'records'].includes(current) || owlBusy() || isSheetOpen() || document.hidden) return;
    /* a friend's letter that has arrived comes first; the day's tea invitation waits for the next check */
    /* the very first: Dumbledore's welcome, as soon as the guest has a name */
    if (bond.welcomeDue()){ setTimeout(() => deliver(app, {note: {deck: 'dumbledore', key: 'W00'}}), 700); return; }
    /* something new in the castle: Dumbledore's notice (bond.NOTICES), once each */
    const nt = bond.noticeDue(); if (nt){ setTimeout(() => deliver(app, {note: {deck: 'dumbledore', key: nt}}), 700); return; }
    const fl = post.undelivered(); if (fl){ setTimeout(() => deliver(app, {letter: fl}), 700); return; }
    /* the day after the first lesson: Ollivander's note, asking the guest to call for a wand */
    if (wand.noteDue()){ setTimeout(() => deliverWandNote(app), 700); return; }
    /* days without a lesson: a Howler (or, from Dumbledore and Lupin, a gentle note) */
    const hw = howler.due(); if (hw){ setTimeout(() => deliverHowler(app, hw), 700); return; }
    /* Mondays: the Daily Prophet */
    if (prophet.due()){ setTimeout(() => deliverProphet(app), 700); return; }
    const inv = bond.owlDue(); if (inv) setTimeout(() => deliver(app, inv), 700);
  },
  /* friends' letters moved (arrived, read, sent): the counts in your room, the post and the corridor */
  refreshMail(){ ['me', 'letters', 'home'].forEach(n => { if (current === n && screens[n].refresh) screens[n].refresh(); }); }

};

const screens = {home: initHome(app), room: initRoom(app), report: initReport(app), settings: initSettings(app), notes: initNotes(app), records: initRecords(app), script: initScript(app), letters: initLetters(app), me: initMyRoom(app), ollivander: initOllivander(app), spell: initSpell(app), map: initMap(app), prophet: initProphet(app), need: initNeed(app)};
bond.init(app);
grammar.init(app);
/* the first professor's letter and the first request: Dumbledore's note (after the lesson, if one is on) */
bond.onPost((id, key) => {
  if (key === 'W00' || /^C-/.test(key)) return;
  hint(/^R\d\d-ask$/.test(key) ? 'request' : 'letter');
});
let current = null;

function route(){
  const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
  let name = parts[0] || 'home', params = {id: parts[1], sub: parts[2]};
  if (!screens[name]) name = 'home';
  closeSheet();
  if (current && current !== name && screens[current].hide) screens[current].hide();
  $$('.screen').forEach(s => { s.hidden = s.id !== name; });
  current = name;
  screens[name].show(params);
}
window.addEventListener('hashchange', route);

let rt = 0;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (current && screens[current].resize) screens[current].resize(); }, 160); });

fetch('data/index.json').then(r => r.json()).then(j => { app.index = j; if (current === 'home') screens.home.refresh(); }).catch(() => {});
Promise.all(DECKS.filter(d => d.file).map(d => app.loadDeck(d.id).catch(() => null))).then(() => bond.daily()).then(() => need.daily(app)).then(() => { if (current === 'home'){ screens.home.resize(); screens.home.refresh(); } });

app.fontsReady.then(() => { if (current === 'home') screens.home.refresh(); });
route();
/* first visit: ask for the name the professors will write to */
/* first visit: the castle door wants its spell (door.js), then the name the professors will write to */
if (!door.isOpen()) setTimeout(() => door.gate(() => askName(() => setTimeout(() => app.owlCheck(), 2600))), 600);
else if (!store.get().settings.named) setTimeout(() => askName(() => setTimeout(() => app.owlCheck(), 2600)), 900);
setInterval(() => app.owlCheck(), 30000);
/* the friends' post office (Firebase) opens only for a phone in a group; a letter landing brings the owl */
post.onChange(() => { bond.newsLetter().then(() => app.refreshMail()); app.refreshMail(); app.owlCheck(); });
setTimeout(() => post.start(), 1500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) app.owlCheck(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:'){
  let reg = null;
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(r => { reg = r; }).catch(() => {}));
  /* a new version (2026-10-09): look for one whenever the app comes back to the front (a phone resumes it rather than
     starting it), and once it has taken over, reload onto it at a calm moment — the corridor or your room, nothing
     open, no owl in flight — never mid-lesson. The very first install does not reload. */
  const had = !!navigator.serviceWorker.controller; let fresh = false;
  const swap = () => { if (fresh && ['home', 'me'].includes(current) && !isSheetOpen() && !owlBusy() && !app.entering && store.get().settings.named) location.reload(); };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had){ fresh = true; swap(); } });
  window.addEventListener('hashchange', () => setTimeout(swap, 300));
  document.addEventListener('visibilitychange', () => { if (document.hidden) return; if (reg) reg.update().catch(() => {}); swap(); });
}
