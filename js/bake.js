/* Baking. Static art is rendered once, with heavy SVG lighting filters (stone relief, rough edges, wood grain),
   into a canvas. Only the moving parts — flames, glows, stars, motes — stay as live SVG on top.
   Until a bake is ready the live SVG shows everything, so nothing is ever missing. */
import {stoneWall, CX, SPRING, BOTTOM, RL} from './art.js';
import {shadeStones} from './art-plus.js';

/* things that move or need web fonts stay live; the bake leaves them out */
const LIVE = '.flame,.glow,.tw,.rune,.mote,.blink,.spark,.glint,.float,.bub,.pop,.steam,.swirl,text';
let defs = '';
const ppuOf = s => s * Math.min(2, window.devicePixelRatio || 1);
export {ppuOf};

function svgImage(inner, w, h, pw, ph){
  if (!defs) defs = document.querySelector('body > svg > defs').outerHTML;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${defs}<style>${LIVE}{display:none}</style>${inner}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = e => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}
function canvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const idle = () => new Promise(r => (window.requestIdleCallback || setTimeout)(r, {timeout: 120}));

/* ---------- material tiles: stone grit, wood grain, damp */
let tiles = null;
export function textures(){
  if (tiles) return tiles;
  const S = 512;
  const mk = f => svgImage(`<filter id="tx" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${f}</filter><rect width="${S}" height="${S}" filter="url(#tx)"/>`, S, S, S, S)
    .then(img => { const c = canvas(S, S); c.getContext('2d').drawImage(img, 0, 0); return c; });
  tiles = Promise.all([
    mk(`<feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="5" seed="3" stitchTiles="stitch"/><feDiffuseLighting surfaceScale="3.4" diffuseConstant=".84" lighting-color="#fff"><feDistantLight azimuth="235" elevation="42"/></feDiffuseLighting>`),
    mk(`<feTurbulence type="fractalNoise" baseFrequency=".06 .004" numOctaves="4" seed="8" stitchTiles="stitch"/><feDiffuseLighting surfaceScale="1.8" diffuseConstant=".84" lighting-color="#fff"><feDistantLight azimuth="180" elevation="42"/></feDiffuseLighting>`),
    mk(`<feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="4" seed="21" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .07  0 0 0 0 .1  0 0 0 0 .06  1.7 0 0 0 -.62"/>`)
  ]).then(([grit, wood, damp]) => ({grit, wood, damp}));
  return tiles;
}
function pattern(x, tile, k){ const p = x.createPattern(tile, 'repeat'); p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0])); return p; }

/* ---------- a stone wall (and optionally the corridor floor) with real relief */
const ROUGH = `<filter id="bk-rough" x="-1%" y="-1%" width="102%" height="102%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="3" seed="7" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>`;
const BEVEL = `<filter id="bk-bevel" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="3" seed="7" result="t"/>
  <feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feColorMatrix in="d" type="luminanceToAlpha" result="a"/><feGaussianBlur in="a" stdDeviation="2.2" result="b"/>
  <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="5" seed="11" result="n"/>
  <feComposite in="n" in2="b" operator="arithmetic" k2=".38" k3="1" result="h"/>
  <feDiffuseLighting in="h" surfaceScale="5" diffuseConstant=".8" lighting-color="#fff"><feDistantLight azimuth="235" elevation="40"/></feDiffuseLighting></filter>`;
const whiteStones = (str, rx) => [...str.matchAll(new RegExp(`<rect x="([-\\d.]+)" y="([-\\d.]+)" width="([\\d.]+)" height="([\\d.]+)" rx="${rx}"`, 'g'))]
  .map(m => `<rect x="${m[1]}" y="${m[2]}" width="${m[3]}" height="${m[4]}" rx="${rx}" fill="#fff"/>`).join('');

export async function bakeWall({w, h, seed, base, floor = false, overlay = '', ppu}){
  const pw = Math.min(16000, Math.round(w * ppu)), ph = Math.round(h * ppu), k = pw / w;
  const wallH = floor ? 500 : h, wall = stoneWall(w, wallH, seed, base);
  const flags = floor ? stoneWall(w, 143, seed + 40, '#1C221E') : '';
  const floorColor = floor ? `<rect y="500" width="${w}" height="60" fill="#121714"/><g transform="translate(0 500) scale(1 .42)" opacity=".92">${shadeStones(flags)}</g>` +
    `<path d="M0 522 H${w} M0 559 H${w}" stroke="#070908" stroke-width="2.4" opacity=".7"/><rect y="496" width="${w}" height="5" fill="#000" opacity=".45"/>` : '';
  const floorMask = floor ? `<g transform="translate(0 500) scale(1 .42)">${whiteStones(flags, '3.5')}</g>` : '';
  const [color, bump, T] = await Promise.all([
    svgImage(`${ROUGH}<g filter="url(#bk-rough)">${shadeStones(wall)}${floorColor}</g>${overlay}`, w, h, pw, ph),
    svgImage(`${BEVEL}<g filter="url(#bk-bevel)"><rect width="${w}" height="${h}" fill="#000"/>${whiteStones(wall, '3.5')}${floorMask}</g>`, w, h, pw, ph),
    textures()
  ]);
  await idle();
  const c = canvas(pw, ph), x = c.getContext('2d');
  x.drawImage(color, 0, 0, pw, ph);
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = .95; x.drawImage(bump, 0, 0, pw, ph);
  x.globalCompositeOperation = 'soft-light'; x.globalAlpha = .7; x.fillStyle = pattern(x, T.grit, k * .9); x.fillRect(0, 0, pw, ph);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = .75; x.fillStyle = pattern(x, T.damp, k * 1.6); x.fillRect(0, 0, pw, wallH * k);
  x.globalAlpha = 1;
  return c;
}

/* ---------- a door at rest: everything static, then grit over stone and iron and grain into the wood */
const cache = new Map();
export function bakeDoor(key, svgString, ppu){
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const pw = Math.round(250 * ppu), ph = Math.round(560 * ppu), k = ppu;
    const [img, T] = await Promise.all([svgImage(svgString, 250, 560, pw, ph), textures()]);
    await idle();
    const c = canvas(pw, ph), x = c.getContext('2d');
    x.drawImage(img, 0, 0, pw, ph);
    x.globalCompositeOperation = 'soft-light';
    x.globalAlpha = .5; x.fillStyle = pattern(x, T.grit, k * .9); x.fillRect(0, 0, pw, ph);
    x.save();
    const leaf = new Path2D(`M${(CX - RL) * k} ${BOTTOM * k} L${(CX - RL) * k} ${SPRING * k} A${RL * k} ${RL * k} 0 0 1 ${(CX + RL) * k} ${SPRING * k} L${(CX + RL) * k} ${BOTTOM * k} Z`);
    x.clip(leaf); x.globalAlpha = .42; x.fillStyle = pattern(x, T.wood, k * 1.6); x.fillRect(0, 0, pw, ph);
    x.restore();
    x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(img, 0, 0, pw, ph);
    x.globalCompositeOperation = 'source-over';
    return c;
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

/* copy a baked canvas into a visible one */
export function paint(target, src){
  target.width = src.width; target.height = src.height;
  target.getContext('2d').drawImage(src, 0, 0);
}

/* ---------- any live SVG prop (shelf, cauldron): bake the still parts, light them, keep the moving parts live.
   lights: [x, y, radius, colour] in the SVG's own units; ambient: how dark it is away from them */
export async function bakeLive(wrap, opts = {}){
  const svg = wrap.querySelector(':scope > svg'), vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
  if (!r.width || !vb.width) return;
  const ppu = r.width / vb.width * Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(vb.width * ppu), ph = Math.round(vb.height * ppu), key = pw + 'x' + ph;
  if (wrap.dataset.bk === key) return;
  wrap.dataset.bk = key;
  const [img, T] = await Promise.all([svgImage(svg.innerHTML, vb.width, vb.height, pw, ph), textures()]);
  await idle();
  const c = canvas(pw, ph), x = c.getContext('2d');
  x.drawImage(img, 0, 0, pw, ph);
  if (opts.lights){
    const m = canvas(pw, ph), mx = m.getContext('2d');
    mx.fillStyle = opts.ambient || '#7d7d7d'; mx.fillRect(0, 0, pw, ph);
    mx.globalCompositeOperation = 'lighter';
    opts.lights.forEach(([lx, ly, lr]) => { const g = mx.createRadialGradient(lx * ppu, ly * ppu, 0, lx * ppu, ly * ppu, lr * ppu); g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); mx.fillStyle = g; mx.fillRect(0, 0, pw, ph); });
    x.globalCompositeOperation = 'multiply'; x.drawImage(m, 0, 0);
    x.globalCompositeOperation = 'screen';
    opts.lights.forEach(([lx, ly, lr, col]) => { const g = x.createRadialGradient(lx * ppu, ly * ppu, 0, lx * ppu, ly * ppu, lr * ppu * .8); g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, pw, ph); });
  }
  x.globalCompositeOperation = 'soft-light'; x.globalAlpha = opts.grit ?? .45; x.fillStyle = pattern(x, T.grit, ppu * .8); x.fillRect(0, 0, pw, ph);
  x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(img, 0, 0, pw, ph);
  let cv = wrap.querySelector(':scope > canvas');
  if (!cv){ cv = document.createElement('canvas'); wrap.prepend(cv); }
  if (wrap.dataset.bk !== key) return;
  cv.width = pw; cv.height = ph; cv.getContext('2d').drawImage(c, 0, 0);
  wrap.classList.add('baked');
}

/* ---------- a material grain laid over an HTML surface (slate, board frame) with soft-light */
export function texturize(el, kind, alpha, scale = 1){
  const cv = document.createElement('canvas');
  cv.className = 'tex'; cv.style.opacity = alpha; cv.setAttribute('aria-hidden', 'true');
  el.prepend(cv);
  let lw = 0, lh = 0;
  const draw = async () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h || (w === lw && h === lh)) return;
    lw = w; lh = h;
    const T = await textures(), d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    const x = cv.getContext('2d'); x.fillStyle = pattern(x, T[kind], d * scale); x.fillRect(0, 0, cv.width, cv.height);
  };
  new ResizeObserver(() => draw()).observe(el);
  draw();
}
