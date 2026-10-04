/* Which classroom doors are open (2026-10-04 user decision). On the first visit you choose ONE professor to begin
   with; after that, every 20 new lines learnt across all the professors earn a key, and you choose which locked
   door to open with it. Keys are not stored: earned = floor(lines learnt / 20), used = doors opened after the first.
   "Learnt" = a card that has been through 배우기 (it has a record in the deck); 더 도전 and 틀린 대사 연습 only revisit
   learnt lines, so they never add to it.
   state.doors = {open: ['snape', …], first: 'snape'}.
   A new character's door appears as soon as its deck exists in decks.js (DECKS) with a data file — it starts locked. */
import {DECKS} from './decks.js';
import * as srs from './srs.js';
import * as store from './store.js';
import * as group from './post.js';

export const PER_KEY = 20;
const decks = () => DECKS.filter(d => d.file);

function state(){
  const s = store.get();
  if (!s.doors){
    /* before this existed: any classroom already studied stays open (tester devices); a new visitor chooses first */
    const open = decks().map(d => d.id).filter(id => Object.keys(store.deck(id).cards || {}).length);
    s.doors = {open, first: open[0] || ''};
  }
  return s.doors;
}

export const needsFirst = () => !state().open.length;
export const first = () => state().first || state().open[0] || '';
export const isOpen = id => state().open.includes(id);
export const learnt = () => decks().reduce((n, d) => n + Object.keys(store.deck(d.id).cards || {}).length, 0);
export const keysEarned = () => Math.floor(learnt() / PER_KEY);
export const keysLeft = () => Math.max(0, keysEarned() - Math.max(0, state().open.length - 1));
export const toNextKey = () => PER_KEY - (learnt() % PER_KEY);
export const lockedCount = () => decks().filter(d => !isOpen(d.id)).length;

export function chooseFirst(id){
  const st = state(); if (st.open.length) return false;
  st.open = [id]; st.first = id; store.save(); group.announce('door', id); return true;
}
export function useKey(id){
  const st = state(); if (isOpen(id) || !keysLeft()) return false;
  st.open.push(id); store.save(); group.announce('door', id); return true;   // the friends hear of it
}

/* a new key the moment the twentieth line is learnt: tell whoever is listening (home.js shows the note) */
const listeners = new Set();
export const onKey = f => listeners.add(f);
let before = -1;
srs.hooks.push(() => {
  if (before < 0){ before = keysEarned(); return; }
  const now = keysEarned();
  if (now > before && lockedCount()) listeners.forEach(f => f(keysLeft()));
  before = now;
});
export function primeKeys(){ before = keysEarned(); }
