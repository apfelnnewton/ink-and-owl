/* Paging the lists that only ever grow (2026-10-21 user: "스크롤이 길어지기만 함 — 묶어서 넘기는 기능").
   Things that come with a date — a professor's letters, the friends' letters, the example book's days — a month at a time,
   the newest month first; numbered things — the tea journal, the word book — twenty at a time. ‹ always goes back (an older
   month, lower numbers), › forward. A list of a single page shows no bar. Where a list stands is kept while the app is open,
   not saved. The screen that draws a list catches [data-pg] and calls turn() before drawing it again. */
import {esc} from './ui.js';

const at = {};   // key → {kind: 'month' | 'count', i}
const monthOf = d => String(d || '').slice(0, 7);
const bar = (key, back, fwd, label, small) =>
  `<div class="pg-nav"><button type="button" data-pg="${esc(key)}" data-dir="back"${back ? '' : ' disabled'} aria-label="이전">‹</button>` +
  `<span><b>${esc(label)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span>` +
  `<button type="button" data-pg="${esc(key)}" data-dir="fwd"${fwd ? '' : ' disabled'} aria-label="다음">›</button></div>`;

/* a month at a time: {items: this month's, nav, oldest: true on the earliest month} */
export function byMonth(key, items, dateOf, unit = ''){
  const months = [...new Set(items.map(x => monthOf(dateOf(x))).filter(Boolean))].sort().reverse();
  if (months.length < 2){ delete at[key]; return {items, nav: '', oldest: true}; }
  const s = at[key] || (at[key] = {kind: 'month', i: 0});
  s.i = Math.max(0, Math.min(months.length - 1, s.i));
  const m = months[s.i], [y, mo] = m.split('-').map(Number), shown = items.filter(x => monthOf(dateOf(x)) === m);
  return {items: shown, oldest: s.i === months.length - 1, nav: bar(key, s.i < months.length - 1, s.i > 0, `${y}년 ${mo}월`, `${shown.length}${unit}`)};
}

/* so many at a time: {items: this page's, from: index of its first, nav}; a list opens on its last page when atEnd */
export function byCount(key, items, size = 20, atEnd = false, unit = ''){
  const pages = Math.ceil(items.length / size);
  if (pages < 2){ delete at[key]; return {items, from: 0, nav: ''}; }
  const s = at[key] || (at[key] = {kind: 'count', i: atEnd ? pages - 1 : 0});
  s.i = Math.max(0, Math.min(pages - 1, s.i));
  const from = s.i * size, shown = items.slice(from, from + size);
  return {items: shown, from, nav: bar(key, s.i > 0, s.i < pages - 1, `${from + 1}–${from + shown.length}`, `/ ${items.length}${unit}`)};
}

/* a press on ‹ or ›: true if it was one (the caller then draws its list again) */
export function turn(btn){
  const b = btn && btn.closest && btn.closest('[data-pg]'); if (!b || b.disabled) return false;
  const s = at[b.dataset.pg]; if (!s) return false;
  const back = b.dataset.dir === 'back';
  s.i += s.kind === 'month' ? (back ? 1 : -1) : (back ? -1 : 1);
  return true;
}
