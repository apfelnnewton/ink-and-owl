/* The register (#/records): an attendance calendar on parchment, each studied day sealed with the wax of every place
   studied that day, overlapping, the most-studied on top (2026-10-09 user decision; up to four show, then "+n"; the
   Room of Requirement has its own grey seal); a snitch when every answer was right; each professor's progress; the lines missed
   most often; and eight weeks of accuracy and volume drawn in ink. Everything comes from state.log and the cards. */
import {DECKS, byId} from './decks.js';
import * as srs from './srs.js';
import * as store from './store.js';
import * as bond from './bond.js';
import * as need from './need.js';
import {$, esc, fitPaper, toast} from './ui.js';

const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* British school terms */
const term = m => m >= 8 ? 'Autumn Term' : m <= 2 ? 'Spring Term' : m <= 6 ? 'Summer Term' : 'Summer Holidays';
const missScore = c => (c ? (c.m || 0) * 2 + (c.h || 0) + (c.g === 'again' ? 2 : c.g === 'hard' ? 1 : 0) : 0);

export function initRecords(app){
  const sec = $('#records');
  ['#recCal', '#recProf', '#recMiss', '#recWeeks'].forEach((s, i) => fitPaper($(s), 50 + i));
  let y = 0, m = 0;

  /* ---------- attendance */
  const placeKo = id => id === 'need' ? '필요의 방' : byId(id) ? byId(id).ko : id;
  function dayInfo(date){
    const e = store.get().log[date]; if (!e) return null;
    let n = 0, wrong = 0; const places = [];
    for (const [id, o] of Object.entries(e)){
      const k = (o.good || 0) + (o.hard || 0) + (o.again || 0) + (o.learn || 0);
      n += k; wrong += (o.hard || 0) + (o.again || 0);
      if (k && (id === 'need' || byId(id))) places.push({id, k});
    }
    places.sort((a, b) => b.k - a.k);
    return n ? {n, perfect: !wrong && Object.values(e).some(o => o.good), places} : null;
  }
  /* the seals of the day, overlapping: the place studied most lies on top, the rest peep out beneath it */
  const seals = ps => {
    const show = ps.slice(0, 4), more = ps.length - show.length;
    return `<span class="rc-seals n${show.length}">${show.map((p, i) => `<i class="seal s-${p.id}" style="--i:${i}"></i>`).join('')}${more ? `<small>+${more}</small>` : ''}</span>`;
  };
  function drawCal(){
    const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7, today = srs.today();
    let cells = '', seen = 0;
    for (let i = 0; i < lead; i++) cells += '<span class="rc-d empty"></span>';
    for (let d = 1; d <= days; d++){
      const date = ymd(y, m, d), info = dayInfo(date);
      if (info) seen++;
      cells += `<span class="rc-d${date === today ? ' today' : ''}${date > today ? ' future' : ''}"${info ? ` data-day="${date}"` : ''} title="${info ? `${info.places.map(p => placeKo(p.id)).join(' · ')} · ${info.n}문제` : ''}">` +
        `<b>${d}</b>${info ? seals(info.places) + (info.perfect ? '<em class="snitch" role="img" aria-label="모두 맞음"></em>' : '') : ''}</span>`;
    }
    $('#recCalBody').innerHTML = `<div class="rc-head"><button type="button" data-mo="-1" aria-label="이전 달">‹</button>` +
      `<div><span class="rc-term">${term(m)} · ${y}</span><span class="rc-month">${MONTH[m]}</span></div>` +
      `<button type="button" data-mo="1" aria-label="다음 달">›</button></div>` +
      `<div class="rc-grid">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(w => `<span class="rc-w">${w}</span>`).join('')}${cells}</div>` +
      `<p class="rc-sum">이달 출석 ${seen}일 · 연속 ${srs.streak()}일</p>` +
      `<p class="rc-key">${DECKS.map(d => `<span><i class="seal s-${d.id}" style="--c:${d.glow}"></i>${esc(d.ko.replace(/ 교수$/, ''))}</span>`).join('')}${need.isOpen() ? '<span><i class="seal s-need"></i>필요의 방</span>' : ''}<span><em class="snitch" aria-hidden="true"></em>모두 맞은 날</span></p>`;
  }
  $('#recCalBody').addEventListener('click', e => {
    /* a day: every place studied, in order */
    const dd = e.target.closest('[data-day]');
    if (dd){ const info = dayInfo(dd.dataset.day), [, mm, ddn] = dd.dataset.day.split('-').map(Number);
      toast(`<span class="q">${mm}월 ${ddn}일 · ${info.n}문제</span><span class="k">${info.places.map(p => `${esc(placeKo(p.id))} ${p.k}`).join(' · ')}</span>`, 3200, true); return; }
    const b = e.target.closest('[data-mo]'); if (!b) return;
    m += +b.dataset.mo; if (m < 0){ m = 11; y--; } if (m > 11){ m = 0; y++; }
    drawCal();
  });

  /* ---------- each professor's progress, and the lines missed most */
  async function drawDecks(){
    const all = await Promise.all(DECKS.map(d => app.loadDeck(d.id).then(c => [d, c]).catch(() => [d, null])));
    $('#recProfBody').innerHTML = all.map(([d, cards]) => {
      if (!cards) return '';
      const g = srs.progress(d.id, cards), pl = g.seen / g.total * 100, pm = g.mastered / g.total * 100;
      return `<li><div class="rp-name"><span lang="en">${esc(d.who)}</span><em class="rp-stage">${bond.STAGES[bond.stage(d.id)]}</em><small>${g.seen} / ${g.total} · 숙달 ${g.mastered}</small></div>` +
        `<div class="rp-bar" role="img" aria-label="배운 ${g.seen}장, 숙달 ${g.mastered}장, 전체 ${g.total}장"><i class="seen" style="width:${pl}%;--c:${d.glow}"></i><i class="mast" style="width:${pm}%;--c:${d.glow}"></i></div></li>`;
    }).join('');
    const rows = [];
    for (const [d, cards] of all){
      if (!cards) continue;
      const ds = store.deck(d.id).cards;
      for (const c of cards){ const s = missScore(ds[c.id]); if (s > 0) rows.push({d, c, s, st: ds[c.id]}); }
    }
    rows.sort((a, b) => b.s - a.s);
    const top = rows.slice(0, 5);
    $('#recMissBody').innerHTML = top.length ? `<ol>${top.map(({d, c, st}) => {
      const expr = c.bre.length ? c.bre[0].expr : c.line;
      return `<li><button type="button" data-wrong="${d.id}"><span class="en" lang="en">${esc(expr)}</span>` +
        `<span class="kr">${esc(d.ko)} · 틀림 ${st.m || 0} · 비슷 ${st.h || 0}</span><span class="ln" lang="en">${esc(c.line)}</span><i class="rm-go" aria-hidden="true">→</i></button></li>`;
    }).join('')}</ol>` : '<p class="rm-none" lang="en">Nothing missed yet. Keep it that way.</p>';
  }
  /* (the professors' gifts now live in the specimen drawers of your own room, #/me/cabinet) */
  $('#recMissBody').addEventListener('click', e => { const b = e.target.closest('[data-wrong]'); if (b) app.go(`#/room/${b.dataset.wrong}/wrong`); });

  /* ---------- eight weeks in ink: bars = answers, line = share right */
  function drawWeeks(){
    const log = store.get().log, t = srs.today(), [ty, tm, td] = t.split('-').map(Number);
    const now = new Date(ty, tm - 1, td), monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
    const weeks = [];
    for (let w = 7; w >= 0; w--){
      const s = new Date(monday); s.setDate(monday.getDate() - w * 7);
      let n = 0, good = 0;
      for (let k = 0; k < 7; k++){
        const d = new Date(s); d.setDate(s.getDate() + k);
        const e = log[ymd(d.getFullYear(), d.getMonth(), d.getDate())];
        if (e) for (const o of Object.values(e)){ const a = (o.good || 0) + (o.hard || 0) + (o.again || 0); n += a; good += o.good || 0; }
      }
      weeks.push({label: `${s.getMonth() + 1}/${s.getDate()}`, n, acc: n ? good / n : null});
    }
    const W = 320, H = 150, L = 8, R = 8, T = 16, B = 28, cw = (W - L - R) / 8, max = Math.max(10, ...weeks.map(w => w.n));
    let bars = '', pts = [], labels = '';
    weeks.forEach((w, i) => {
      const x = L + i * cw, h = (H - T - B) * w.n / max;
      if (w.n) bars += `<rect x="${(x + cw * .22).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(cw * .56).toFixed(1)}" height="${h.toFixed(1)}" class="bar"/>` +
        `<text x="${(x + cw / 2).toFixed(1)}" y="${(H - B - h - 4).toFixed(1)}" class="n">${w.n}</text>`;
      if (w.acc !== null) pts.push([x + cw / 2, T + (H - T - B) * (1 - w.acc), w.acc]);
      labels += `<text x="${(x + cw / 2).toFixed(1)}" y="${H - 10}" class="lab">${w.label}</text>`;
    });
    const line = pts.length > 1 ? `<polyline points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" class="acc"/>` : '';
    const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" class="dot"/><text x="${p[0].toFixed(1)}" y="${(p[1] - 7).toFixed(1)}" class="pc">${Math.round(p[2] * 100)}%</text>`).join('');
    const total = weeks.reduce((s, w) => s + w.n, 0);
    $('#recWeeksBody').innerHTML = total ? `<svg viewBox="0 0 ${W} ${H}" class="rw-chart" role="img" aria-label="최근 8주 주별 문제 수와 정답률">` +
      `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="base"/>${bars}${line}${dots}${labels}</svg>` +
      `<p class="rw-key"><span class="k-bar"></span>푼 문제 수 <span class="k-acc"></span>맞은 비율</p>`
      : '<p class="rm-none" lang="en">No marks recorded yet.</p>';
  }

  $('#recBack').addEventListener('click', () => app.go('#/'));
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape') app.go('#/'); });

  function show(){
    const [ty, tm] = srs.today().split('-').map(Number);
    y = ty; m = tm - 1;
    $('#recStreak').textContent = `연속 ${srs.streak()}일`;
    drawCal(); drawWeeks(); drawDecks();
    $('#recScroll').scrollTop = 0;
  }
  return {show};
}
