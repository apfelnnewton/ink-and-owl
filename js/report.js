/* End of lesson: the professor's remark and the day's tally on parchment, laid in the classroom. */
import {tally} from './art-plus.js';
import {byId, voiceOf} from './decks.js';
import * as srs from './srs.js';
import * as store from './store.js';
import * as bond from './bond.js';
import {$, esc, fitPaper, reduced} from './ui.js';

export function initReport(app){
  const paper = $('#repPaper');
  fitPaper(paper, 27, {nails: true, bottom: true, id: 'rep'});
  $('#rpBack').addEventListener('click', () => { app.leftRoom = null; app.go('#/'); });
  let shown = '';
  $('#rpMore').addEventListener('click', () => app.go(`#/room/${shown}/extra`));
  $('#rpWrongGo').addEventListener('click', () => app.go(`#/room/${shown}/wrong`));
  $('#repScroll').addEventListener('click', e => { if (e.target.closest('.rp-teago')) app.go(`#/letters/${shown}/tea`); });

  const tier = (list, ratio) => list.find(r => ratio >= r.min) || list[list.length - 1];
  function remark(id, ratio, n, learned){
    const v = voiceOf(id).remarks;
    if (!n) return learned ? v.learned : v.empty;
    return tier(v.tiers, ratio);
  }
  const said = r => `<p class="q" lang="en">${esc(r.en)}</p><p class="k">${esc(r.ko)}</p>`;

  async function show({id}){
    const d = byId(id);
    if (!d || !d.file){ app.go('#/', true); return; }
    /* the report lies in the professor's own classroom (same painting as the lesson, dimmed) */
    const pic = f => `url("${new URL(`assets/rooms/${id}-${f}.webp`, location.href).href}")`;
    $('#repPhoto').style.setProperty('--p', pic('portrait'));
    $('#repPhoto').style.setProperty('--w', pic('wide'));
    let cards;
    try { cards = await app.loadDeck(id); } catch (e){ app.go('#/', true); return; }
    const map = Object.fromEntries(cards.map(c => [c.id, c]));
    const dk = store.deck(id), day = (dk.day && dk.day.date === srs.today()) ? dk.day : {queue: [], results: {}, pos: 0};
    const all = Object.values(day.results), learned = all.filter(g => g === 'learn').length, res = all.filter(g => g !== 'learn'), n = res.length;
    const cnt = {good: res.filter(g => g === 'good').length, hard: res.filter(g => g === 'hard').length, again: res.filter(g => g === 'again').length};
    const r = remark(id, n ? cnt.good / n : 0, n, learned);

    $('#rpTitle').textContent = 'End of Lesson';
    $('#rpSub').textContent = `${d.room} · ${srs.dayLabel(srs.today())}${day.pos < day.queue.length ? ` · ${day.pos} / ${day.queue.length}장에서 멈춤` : ''}`;
    $('#rpEn').textContent = r.en;
    $('#rpKo').textContent = r.ko;
    $('#rpBy').textContent = '— ' + d.who;

    let base = .8;
    $('#rpTallies').innerHTML = n ? [['맞음', cnt.good], ['비슷', cnt.hard], ['틀림', cnt.again]].map(([label, v], row) => {
      const t = tally(v, 11 + row), html = `<div class="t"><b>${label}</b>` +
        (v ? `<svg viewBox="0 0 ${t.width} 26" width="${t.width}" style="--base:${base.toFixed(2)}s" aria-hidden="true">${t.svg}</svg>` : '<span style="opacity:.5">—</span>') +
        `<span class="n">${v}</span></div>`;
      base += v * .07 + .15;
      return html;
    }).join('') : '';
    if (learned) $('#rpTallies').insertAdjacentHTML('afterbegin', `<div class="t"><b>배움</b><span>새로 익힌 대사</span><span class="n">${learned}</span></div>`);
    $('#rpTallies').hidden = !n && !learned;

    const wrong = day.queue.filter(cid => day.results[cid] === 'again').map(cid => map[cid]).filter(Boolean);
    $('#rpWrongBox').hidden = !n;
    $('#rpWrong').innerHTML = wrong.length
      ? wrong.map(c => `<li><div><div class="en" lang="en">${esc(c.line)}</div><div class="kr">${esc(c.ko)}</div></div></li>`).join('')
      : '<li class="none-li"><span class="none" lang="en">Not a single slip. Hm.</span></li>';

    shown = id;
    /* side rounds played today (더 도전, 틀린 대사), each with its own tally and the professor's word on it */
    const exBox = $('#rpExtra'), rounds = [['extra', '더 도전'], ['wrong', '틀린 대사 연습'], ['req', '교수의 부탁']].filter(([k]) => day[k] && day[k].pos);
    exBox.hidden = !rounds.length;
    exBox.innerHTML = rounds.map(([k, title]) => {
      const ex = day[k], er = Object.values(ex.results), ok = er.filter(x => x === 'good').length, near = er.filter(x => x === 'hard').length;
      const missed = ex.queue.filter(cid => ex.results[cid] === 'again').map(cid => map[cid]).filter(Boolean);
      return `<div class="rx-round"><h2>${title}</h2><div class="rx">${ok} / ${er.length} 정확 · 거의 ${near}</div>` +
        `<div class="rx-say">${said(tier(voiceOf(id).extra, er.length ? ok / er.length : 0))}</div>` +
        (missed.length ? `<ol>${missed.map(c => `<li><div class="en" lang="en">${esc(c.line)}</div><div class="kr">${esc(c.ko)}</div></li>`).join('')}</ol>` : '') + '</div>';
    }).join('');
    $('#rpMore').hidden = !srs.learnedCount(id, cards);
    const nWrong = srs.wrongLines(id, cards).length;
    $('#rpWrongGo').hidden = !nWrong;
    $('#rpWrongGo').textContent = `틀린 대사 연습 · ${Math.min(10, nWrong)}문제`;
    const g = srs.progress(id, cards);
    $('#rpProg').innerHTML = `<h2>덱 진도</h2>` +
      `<div class="gauge"><span>숙달 ${g.mastered} / ${g.total}</span><span class="bar"><i style="width:${Math.max(1.5, 100 * g.mastered / g.total)}%"></i></span></div>` +
      `<div>배운 카드 ${g.seen} / ${g.total}장 · 내일 복습 ${g.dueTomorrow}장</div>` +
      (g.complete ? '<div><b>덱 완료.</b> 모든 대사의 복습 간격이 30일을 넘었습니다.</div>' : '');

    /* every thirty answers with this professor earn a tea invitation, offered here at the end of the lesson */
    await bond.load(id);
    let tea = $('#rpTea');
    if (!tea){ tea = document.createElement('div'); tea.id = 'rpTea'; tea.className = 'rx-round rp-tea'; $('#rpProg').before(tea); }
    const tv = bond.inviteSrc(id) === 'study' && bond.inviteText(id);
    tea.hidden = !tv;
    if (tv) tea.innerHTML = `<h2>차 한 잔 초대</h2><div class="rx-say">${said({en: bond.fill(tv.en), ko: bond.fill(tv.ko)})}</div><button type="button" class="rp-teago"><span lang="en">I'd be delighted.</span> 기꺼이 가겠습니다 →</button>`;

    if (!reduced()){ paper.classList.remove('drop'); void paper.offsetWidth; paper.classList.add('drop'); }
    $('#repScroll').scrollTop = 0;
  }
  return {show, resize: () => {}};
}
