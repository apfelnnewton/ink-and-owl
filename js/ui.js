/* Small shared pieces: parchment that fits its element, the rising slip, the toast, wall painting. */
import {stoneWall} from './art.js';
import {shadeStones} from './art-plus.js';
import {bakeWall, paint, ppuOf} from './bake.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* every sheet of paper is the same photographed parchment (assets/ui/parchment.webp), stretched by its torn border
   in CSS (.paperbox border-image), so it fits any size without redrawing */
export function fitPaper(el){
  el.querySelector(':scope > .paperbox').classList.add('parch');
  return () => {};
}

/* stone wall filling the viewport, with optional light overlays */
export function paintWall(svg, seed, base, overlay = ''){
  const w = Math.ceil(innerWidth), h = Math.ceil(innerHeight);
  if (svg.dataset.size === w + 'x' + h) return;
  svg.dataset.size = w + 'x' + h;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = shadeStones(stoneWall(w, h, seed, base)) + overlay;
  const bg = svg.parentNode, key = svg.dataset.size;
  bg.classList.remove('wall-baked');
  bakeWall({w, h, seed, base, overlay, ppu: ppuOf(1)}).then(c => {
    if (svg.dataset.size !== key) return;
    let cv = svg.previousElementSibling;
    if (!cv || cv.tagName !== 'CANVAS'){ cv = document.createElement('canvas'); cv.className = 'wallbake'; svg.before(cv); }
    paint(cv, c); bg.classList.add('wall-baked');
  }).catch(() => {});
}

let toastTimer = 0;
export function toast(msg, ms = 2400, html = false){
  const t = $('#toast');
  if (html) t.innerHTML = msg; else t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

/* the parchment slip that rises from the bottom */
let refit = null, sheetOpen = false, lastFocus = null;
export function openSheet(html){
  const sh = $('#sheet'), paper = $('.sheet-paper', sh);
  lastFocus = document.activeElement;
  $('#sheetBody').innerHTML = html;
  sh.classList.remove('closing');
  sh.hidden = false;
  sheetOpen = true;
  if (!refit) refit = fitPaper(paper, 41, {top: true});
  else refit();
  $('#sheetBody').scrollTop = 0;
  $('.sheet-close', sh).focus({preventScroll: true});
}
export function closeSheet(){
  if (!sheetOpen) return;
  sheetOpen = false;
  const sh = $('#sheet');
  if (reduced()){ sh.hidden = true; }
  else { sh.classList.add('closing'); setTimeout(() => { if (!sheetOpen) sh.hidden = true; }, 290); }
  if (lastFocus && lastFocus.focus) lastFocus.focus({preventScroll: true});
}
export const isSheetOpen = () => sheetOpen;
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
