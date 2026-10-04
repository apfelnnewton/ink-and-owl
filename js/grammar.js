/* Grammar and sentence structure (2026-10-04 user decision, option C): every line gets its skeleton and one to three
   grammar notes (grammar/<deck>.json — {cardId: {struct, notes:[{pt, ko}]}}), and each note names a point in the
   shared catalogue (grammar/points.json — [{id, name, en, pattern, explain, ex:{en, ko}}]). On the back of a card,
   "문장 구조" opens the line's notes; a point's name opens the point itself with every line that uses it. The
   Expressions notebook opens the whole catalogue ("문법 노트"). Written for the decks that have a file so far;
   a deck without one simply shows no button. The source lines (data/) are never touched. */
import {DECKS, byId} from './decks.js';
import {$, esc, openSheet} from './ui.js';

let points = null, app = null;
const notes = {}, loading = {};
export const init = a => { app = a; };   // for the lines themselves (app.loadDeck)
const loadPoints = () => points ? Promise.resolve(points) :
  fetch('grammar/points.json').then(r => r.ok ? r.json() : []).catch(() => []).then(p => (points = p));
export function load(id){
  if (notes[id]) return Promise.resolve(notes[id]);
  return loading[id] || (loading[id] = Promise.all([loadPoints(),
    fetch(`grammar/${id}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}))]).then(([, n]) => (notes[id] = n)));
}
const loadAll = () => Promise.all(DECKS.filter(d => d.file).map(d => load(d.id)));
export const has = (deckId, cardId) => !!(notes[deckId] && notes[deckId][cardId]);
const pointOf = id => (points || []).find(p => p.id === id);
/* "[how to ① bottle …]" — brackets and circled numbers set off in colour */
const struct = s => esc(s).replace(/\[|\]/g, m => `<i class="gr-br">${m}</i>`).replace(/[①-⑳]/g, m => `<i class="gr-no">${m}</i>`);

/* the back of a card: this line's skeleton and its notes */
export function cardSheet(deckId, card){
  const g = notes[deckId] && notes[deckId][card.id]; if (!g) return;
  openSheet(`<div class="sh-kind"><span>문장 구조</span></div>` +
    `<p class="gr-struct" lang="en" id="shTitle">${struct(g.struct)}</p>` +
    `<ol class="gr-notes">${g.notes.map(n => { const p = pointOf(n.pt);
      return `<li>${p ? `<button type="button" class="gr-pt" data-gpt="${esc(p.id)}">${esc(p.name)} <span aria-hidden="true">›</span></button>` : ''}<p>${esc(n.ko)}</p></li>`; }).join('')}</ol>`);
}

/* one grammar point: what it is, an example, and every line (in the decks written so far) that uses it */
export async function pointSheet(id){
  await loadAll();
  const p = pointOf(id); if (!p) return;
  const uses = [];
  for (const d of DECKS) for (const [cid, g] of Object.entries(notes[d.id] || {})){
    const n = g.notes.find(x => x.pt === id); if (n) uses.push({d, cid, n});
  }
  const lineOf = async (d, cid) => { const cards = app ? await app.loadDeck(d.id).catch(() => []) : []; return cards.find(c => c.id === cid); };
  const rows = await Promise.all(uses.slice(0, 40).map(async u => ({...u, c: await lineOf(u.d, u.cid)})));
  openSheet(`<div class="sh-kind"><span>문법 노트</span><span lang="en">${esc(p.en)}</span></div>` +
    `<h2 class="sh-expr" id="shTitle">${esc(p.name)}</h2>` +
    `<p class="gr-pattern" lang="en">${esc(p.pattern)}</p><p class="sh-note">${esc(p.explain)}</p>` +
    (p.ex ? `<ul class="sh-ex"><li><span class="en" lang="en">${esc(p.ex.en)}</span><span class="kr">${esc(p.ex.ko)}</span></li></ul>` : '') +
    `<h3 class="gr-h">이 문법이 나오는 대사 · ${uses.length}</h3>` +
    `<ul class="gr-uses">${rows.filter(r => r.c).map(r => `<li><span class="who">${esc(r.d.ko.replace(/ 교수$/, ''))}</span>` +
      `<span class="en" lang="en">${esc(r.c.line)}</span><span class="kr">${esc(r.n.ko)}</span></li>`).join('')}</ul>`);
}

/* the whole catalogue, most used first (from Expressions) */
export async function catalogue(deckId){
  await loadAll();
  const count = id => DECKS.reduce((n, d) => n + Object.values(notes[d.id] || {}).filter(g => g.notes.some(x => x.pt === id)).length, 0);
  const here = id => Object.values(notes[deckId] || {}).filter(g => g.notes.some(x => x.pt === id)).length;
  const list = (points || []).map(p => ({p, n: count(p.id), h: here(p.id)})).filter(x => x.n).sort((a, b) => b.h - a.h || b.n - a.n);
  const who = byId(deckId);
  openSheet(`<div class="sh-kind"><span>문법 노트</span></div><h2 class="sh-expr" id="shTitle">대사 속 문법</h2>` +
    (list.length ? `<p class="w-lead">${who && Object.keys(notes[deckId] || {}).length ? `${esc(who.ko)}의 대사에 많이 나오는 순서입니다.` : '지금까지 정리된 교수의 대사 기준입니다.'}</p>` +
      `<ul class="gr-cat">${list.map(x => `<li><button type="button" data-gpt="${esc(x.p.id)}"><b>${esc(x.p.name)}</b><span lang="en">${esc(x.p.pattern)}</span><i>${x.h || x.n}</i></button></li>`).join('')}</ul>`
      : '<p class="w-lead">아직 정리된 문법이 없습니다.</p>'));
}

/* a point's name anywhere in a slip opens that point */
$('#sheetBody').addEventListener('click', e => { const b = e.target.closest('[data-gpt]'); if (b) pointSheet(b.dataset.gpt); });
