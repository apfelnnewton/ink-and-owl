/* The Daily Prophet (#/prophet[/<n>], 2026-10-06 user decision, docs/plan-prophet.md). Once a week — the first time the
   app is opened on or after a Monday — an owl drops the paper, rolled and tied. The first comes on the Monday after the
   Marauder's Map; each reader's serial starts at their own issue 1 (twelve issues of Rita Skeeter's "The Vanishing
   Portraits"). What hangs on the calendar is the real week's: the Muggle Affairs column (24, each with a date window),
   two or three small advertisements, and the society column ("Ink & Owl Society", only in a group) from the friends'
   news of the week. All of it is fixed when the paper arrives, so a back issue reads the same ever after.
   On the page: a moving photograph, paragraphs that show their Korean when tapped, key expressions that open their
   meaning, a headline-English box, and a puzzle corner of three sentences from the week's six expressions (no effect
   on the review schedule). Issue 12 finds the hidden gallery, which then appears on the map.
   Text: docs/prophet-*.md → prophet/prophet.json (scratchpad converter). Pictures: assets/prophet/<nn>.mp4|.webp.
   state.prophet = {got: [{n, wk, col, ads, soc, read, puz}]} — wk = the Monday of the issue's week. */
import * as store from './store.js';
import * as srs from './srs.js';
import * as map from './map.js';
import * as post from './post.js';
import {byId} from './decks.js';
import {$, esc, openSheet, reduced} from './ui.js';

export const SERIAL = 12;
let data = null;
export async function load(){
  if (data) return data;
  try { const r = await fetch('prophet/prophet.json'); if (r.ok) data = await r.json(); } catch (e){}
  return data;
}

/* ---------- dates: the paper's week starts on Monday */
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const monday = s => srs.addDays(s, -((parse(s).getDay() + 6) % 7));
const weekNo = s => Math.floor(Date.UTC(...s.split('-').map((v, i) => i === 1 ? v - 1 : +v)) / 864e5 / 7);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateLine = s => { const d = parse(s); return `Monday ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const md = s => s.slice(5);   // MM-DD

const st = () => { const s = store.get(); return s.prophet || (s.prophet = {got: []}); };
export const issues = () => st().got || [];
export const have = () => issues().length > 0;
export const unread = () => issues().filter(i => !i.read).length;
const latest = () => issues()[issues().length - 1] || null;

/* the first Monday after the map came; then each week that has none yet. ?prophet brings the next one now (testing). */
export function due(){
  if (!map.have() || issues().length >= SERIAL) return false;
  if (/[?&]prophet/.test(location.search) && !sessionStorage.getItem('prophet-forced')) return true;
  const t = srs.today(), first = srs.addDays(monday(map.got()), 7), last = latest();
  if (t < first) return false;
  return !last || last.wk < monday(t);
}

/* the paper is printed when the owl sets off: this week's column, ads and society news are fixed into it */
export function take(){
  if (!data) return null;
  try { sessionStorage.setItem('prophet-forced', '1'); } catch (e){}
  const wk = monday(srs.today()), prev = latest(), n = issues().length + 1, w = weekNo(wk);
  const cols = data.columns, at = md(wk);
  let col = cols.findIndex(c => c.from <= at && at <= c.to);
  if (col < 0) col = 0;
  if (prev && prev.col === col) col = (col + 1) % cols.length;   // a long window never gives the same column twice running
  const soc = society(w);
  const nAds = soc && soc.length > 1 ? 2 : 3, start = (w * 3) % data.ads.length;
  const ads = Array.from({length: nAds}, (_, k) => (start + k) % data.ads.length);
  const iss = {n, wk, col, ads, soc, read: false, puz: {}};
  st().got.push(iss); store.save();
  return iss;
}

/* friends' news of the week, in Rita's kind voice — three at most; a quiet week has its own line; no group, no column */
function society(w){
  if (!post.inGroup()) return null;
  const S = data.society, list = post.weekNews(7).slice(-3);
  if (!list.length) return [S.none[w % S.none.length]];
  return list.map((nw, k) => {
    const v = S[nw.type] || S.none, [en, ko] = v[(w + k + nw.name.length) % v.length], d = byId(nw.deck);
    const fill = (s, prof) => s.replace(/\{friend\}/g, nw.name).replace(/\{prof\}/g, prof);
    return [fill(en, d ? d.who : 'a professor'), fill(ko, d ? d.ko : '교수')];
  });
}

/* ---------- the page */
const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
/* the bold words in a paragraph are the key expressions, in order; each opens its meaning */
function keyed(paras, keys){
  let k = 0;
  return paras.map(([en, ko], i) => {
    const html = esc(en).replace(/\*\*(.+?)\*\*/g, (_, w) => { const j = Math.min(k++, keys.length - 1); return `<b class="dp-k" data-k="${j}" role="button" tabindex="0">${w}</b>`; });
    return `<div class="dp-p" data-p="${i}"><p class="en" lang="en">${html}</p><p class="ko" hidden>${esc(ko)}</p></div>`;
  }).join('');
}
const keyBox = (keys, set) => `<ul class="dp-keys">${keys.map(([e, m], j) => `<li><button type="button" data-k="${j}" data-set="${set}"><b lang="en">${esc(e)}</b><span>${esc(m)}</span></button></li>`).join('')}</ul>`;

/* three of the week's six sentences: two from the front page and one from the column, or the other way round */
function puzzles(issue, column){
  const a = issue.puz, c = column.puz, n = issue.n;
  const pick = n % 2 ? [a[n % 3], a[(n + 1) % 3], c[n % 3]] : [a[n % 3], c[n % 3], c[(n + 1) % 3]];
  const pool = [...a, ...c].map(p => p.a);
  return pick.map((p, i) => {
    const others = pool.filter(x => x !== p.a), o1 = others[(n + i) % others.length], o2 = others[(n + i + 2) % others.length];
    const opts = [p.a, o1, o2 === o1 ? others[(n + i + 3) % others.length] : o2];
    const r = (n * 7 + i * 3) % 3; for (let k = 0; k < r; k++) opts.push(opts.shift());
    return {...p, opts};
  });
}

export function initProphet(app){
  const sec = $('#prophet'), body = $('#dpBody'), scroll = $('#dpScroll');
  let cur = null, view = null;

  function draw(iss){
    const I = data.issues[iss.n - 1], C = data.columns[iss.col];
    const nn = String(iss.n).padStart(2, '0');
    view = {I, C, puz: puzzles(I, C)};
    const done = iss.puz || {};
    body.innerHTML =
      `<header class="dp-mast"><p class="dp-ear"><span>No. ${iss.n}</span><span>${dateLine(iss.wk)}</span><span>Five Knuts</span></p>` +
        `<h1 lang="en">The Daily Prophet</h1><p class="dp-motto" lang="en">Wizarding Britain's Favourite Newspaper</p></header>` +
      `<article class="dp-lead">` +
        `<p class="dp-serial" lang="en">The Vanishing Portraits · ${iss.n} of ${SERIAL}</p>` +
        `<h2 class="dp-hl" lang="en">${esc(I.title)}</h2><p class="dp-hlko">${esc(I.title_ko)}</p>` +
        `<p class="dp-sub" lang="en">${esc(I.sub)}</p>` +
        `<figure class="dp-photo"><video src="assets/prophet/${nn}.mp4" poster="assets/prophet/${nn}.webp" muted loop playsinline preload="metadata" aria-label="움직이는 사진"></video></figure>` +
        `<p class="dp-by" lang="en">By Rita Skeeter</p>` +
        `<div class="dp-text" data-set="I">${keyed(I.paras, I.keys)}</div>` +
        `<p class="dp-tap">문단을 누르면 한국어가, 굵은 표현을 누르면 뜻이 나옵니다.</p>` +
        keyBox(I.keys, 'I') +
      `</article>` +
      `<aside class="dp-box"><h3><span lang="en">Headline English</span><small>헤드라인 영어 · ${esc(I.head.name)}</small></h3>${I.head.lines.map(l => `<p>${inl(l)}</p>`).join('')}</aside>` +
      `<article class="dp-col"><p class="dp-kicker" lang="en">From our Muggle Affairs Correspondent</p><h2 lang="en">${esc(C.title)}</h2>` +
        `<div class="dp-text" data-set="C">${keyed(C.paras, C.keys)}</div>${keyBox(C.keys, 'C')}</article>` +
      (iss.soc ? `<article class="dp-soc"><h2 lang="en">Ink &amp; Owl Society</h2><p class="dp-kicker" lang="en">By Rita Skeeter</p>` +
        iss.soc.map(([en, ko]) => `<div class="dp-p"><p class="en" lang="en">${esc(en)}</p><p class="ko" hidden>${esc(ko)}</p></div>`).join('') + `</article>` : '') +
      `<section class="dp-ads" aria-label="광고">${iss.ads.map(i => { const [en, ko] = data.ads[i]; return `<div class="dp-ad dp-p"><p class="en" lang="en">${inl(en.replace(/^(\*\*.+?\*\*)\s*·\s*/, '$1'))}</p><p class="ko" hidden>${esc(ko)}</p></div>`; }).join('')}</section>` +
      `<section class="dp-puz"><h2><span lang="en">Puzzle Corner</span><small>퍼즐 코너 · 이번 주 표현</small></h2>` +
        view.puz.map((p, i) => { const got = done[i]; const [b, a] = p.q.split('____');
          return `<div class="dp-q${got ? ' ok' : ''}" data-q="${i}"><p class="en" lang="en"><span class="no">${i + 1}.</span> ${esc(b)}<span class="blank">${got ? esc(p.a) : '______'}</span>${esc(a)}</p>` +
            `<p class="ko"${got ? '' : ' hidden'}>${esc(p.ko)}</p>` +
            `<div class="dp-opts">${p.opts.map(o => `<button type="button" data-o="${esc(o)}"${got ? ' disabled' : ''} class="${got && o === p.a ? 'right' : ''}" lang="en">${esc(o)}</button>`).join('')}</div></div>`; }).join('') +
      `</section>` +
      (issues().length > 1 ? `<nav class="dp-back" aria-label="지난 호"><h3>지난 호</h3><div>${issues().map(x => `<button type="button" data-n="${x.n}" class="${x.n === iss.n ? 'on' : ''}${x.read ? '' : ' new'}" aria-pressed="${x.n === iss.n}">No. ${x.n}<small>${md(x.wk).replace('-', '/')}</small></button>`).join('')}</div></nav>` : '') +
      (iss.n === SERIAL ? `<p class="dp-end">연재 끝 · 지도에 <b lang="en">The Painted Gallery</b>가 새로 그려졌습니다.</p>` : '');
    const v = body.querySelector('video');
    if (v && !reduced()){ v.play().catch(() => {}); }
    scroll.scrollTop = 0;
    if (!iss.read){ iss.read = true; store.save(); }
  }

  const keysOf = set => set === 'C' ? view.C.keys : view.I.keys;
  function gloss(set, j){
    const [e, m] = keysOf(set)[j];
    openSheet(`<div class="sh-kind"><span>예언자 일보 · 핵심 표현</span></div><h2 class="sh-expr" id="shTitle" lang="en">${esc(e)}</h2><p class="sh-note">${esc(m)}</p>`);
  }

  body.addEventListener('click', e => {
    const k = e.target.closest('[data-k]');
    if (k){ const set = k.dataset.set || k.closest('[data-set]').dataset.set; gloss(set, +k.dataset.k); return; }
    const o = e.target.closest('[data-o]');
    if (o){
      const q = o.closest('[data-q]'), i = +q.dataset.q, p = view.puz[i];
      if (o.dataset.o === p.a){
        cur.puz = cur.puz || {}; cur.puz[i] = 1; store.save();
        q.classList.add('ok'); q.querySelector('.blank').textContent = p.a; q.querySelector('.ko').hidden = false;
        q.querySelectorAll('button').forEach(b => { b.disabled = true; if (b.dataset.o === p.a) b.classList.add('right'); });
      } else { o.classList.add('wrong'); o.disabled = true; }
      return;
    }
    const n = e.target.closest('[data-n]');
    if (n){ app.go('#/prophet/' + n.dataset.n, true); return; }
    const para = e.target.closest('.dp-p');
    if (para){ const ko = para.querySelector('.ko'); ko.hidden = !ko.hidden; para.classList.toggle('open', !ko.hidden); }
  });
  body.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.dp-k')){ e.preventDefault(); e.target.click(); } });
  const back = () => { app.go('#/me'); };
  $('#dpBack').addEventListener('click', back);
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape' && !document.querySelector('#sheet.open')) back(); });

  async function show({id}){
    await load();
    if (!data || !have()){ body.innerHTML = `<p class="dp-none">아직 받은 신문이 없습니다. 지도를 받은 다음 월요일부터 부엉이가 매주 신문을 가져옵니다.</p>`; return; }
    cur = issues().find(x => x.n === +id) || latest();
    $('#dpCnt').textContent = `${cur.n} / ${SERIAL}`;
    draw(cur);
  }
  return {show, hide: () => { const v = body.querySelector('video'); if (v) v.pause(); }};
}
