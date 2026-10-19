/* End of lesson: the professor's remark and the day's tally on parchment, laid in the classroom. */
import {tally} from './art-plus.js';
import {byId, voiceOf, homeOf} from './decks.js';
import * as manor from './manor.js';
import * as bella from './bella.js';
import * as srs from './srs.js';
import * as store from './store.js';
import * as bond from './bond.js';
import * as speech from './speech.js';
import {$, esc, fitPaper, reduced} from './ui.js';

export function initReport(app){
  const paper = $('#repPaper');
  fitPaper(paper, 27, {nails: true, bottom: true, id: 'rep'});
  let shown = '';
  $('#rpBack').addEventListener('click', () => { app.leftRoom = null; app.go(shown ? homeOf(shown) : '#/'); });
  $('#rpMore').addEventListener('click', () => app.go(`#/room/${shown}/extra`));
  $('#rpWrongGo').addEventListener('click', () => app.go(`#/room/${shown}/wrong`));
  $('#rpExGo').addEventListener('click', e => app.go(e.currentTarget.dataset.go));
  $('#rpExList').addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b && !store.get().settings.quiet) speech.speak(b.dataset.say, store.get().settings.voice, null, .92); });
  $('#repScroll').addEventListener('click', e => { const b = e.target.closest('.rp-teago'); if (b) app.go(b.dataset.go || `#/letters/${shown}/tea`); });

  const tier = (list, ratio) => list.find(r => ratio >= r.min) || list[list.length - 1];
  function remark(id, ratio, n, learned){
    const v = voiceOf(id).remarks;
    if (!n) return learned ? v.learned : v.empty;
    return tier(v.tiers, ratio);
  }
  const said = r => `<p class="q" lang="en">${esc(bond.fill(r.en))}</p><p class="k">${esc(bond.fill(r.ko))}</p>`;

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

    const place = d.place;
    await bond.load(id);
    $('#rpTitle').textContent = place === 'manor' ? "The Day's Work" : place === 'fire' ? 'By the Fire' : place === 'drawing' ? 'Taken Down' : 'End of Lesson';
    $('#rpBack').textContent = (({fire: '벽난로 앞으로', manor: '서재로', drawing: '응접실로'})[place] || '복도로') + ' 돌아가기';
    $('#rpSub').textContent = `${d.room} · ${srs.dayLabel(srs.today())}${day.pos < day.queue.length ? ` · ${day.pos} / ${day.queue.length}장에서 멈춤` : ''}`;
    $('#rpEn').textContent = bond.fill(r.en);
    $('#rpKo').textContent = bond.fill(r.ko);
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
    /* the day's expressions in other sentences (2026-10-17 · 19 user): for every expression of the lines first learnt today,
       its first example — a taste; the rest wait in the notebook's example book, reached by the button under the list */
    const exs = await app.loadExamples(id), t = srs.today();
    const fresh = day.queue.filter((cid, i) => map[cid] && (dk.cards[cid] && dk.cards[cid].ld === t || (day.kinds && day.kinds[i] === 'n' && day.results[cid] === 'learn')));
    /* lines learnt today before the learning day was kept on the line: given it now, so the example book finds them */
    let gave = false; for (const cid of fresh){ const r = dk.cards[cid]; if (r && !r.ld){ r.ld = t; gave = true; } } if (gave) store.save();
    const rows = fresh.flatMap(cid => { const list = srs.exampleList(map[cid], exs); return [...new Set(list.map(e => e.k))].map(k => list.find(e => e.k === k)); });
    $('#rpExs').hidden = !rows.length;
    $('#rpExList').innerHTML = rows.map(e => `<li><div><div class="ex-x" lang="en">${esc(e.expr)}</div><button type="button" class="en" lang="en" data-say="${esc(e.en)}">${esc(e.en)}</button><div class="kr">${esc(e.ko)}</div></div></li>`).join('');
    $('#rpExGo').dataset.go = `#/notes/${id}/exr/${t}`;
    /* side rounds played today (더 도전, 틀린 대사), each with its own tally and the professor's word on it */
    const exBox = $('#rpExtra'), rounds = [['insp', '검수'], ['extra', '더 도전'], ['wrong', '틀린 대사 연습'], ['req', '교수의 부탁']].filter(([k]) => day[k] && day[k].pos);
    exBox.hidden = !rounds.length;
    exBox.innerHTML = rounds.map(([k, title]) => {
      const ex = day[k], er = Object.values(ex.results), ok = er.filter(x => x === 'good').length, near = er.filter(x => x === 'hard').length;
      const missed = ex.queue.filter(cid => ex.results[cid] === 'again').map(cid => map[cid]).filter(Boolean);
      /* an inspection at the manor: his verdict on the object, once every line asked for has been written */
      const v = k === 'insp' && ex.pos >= ex.queue.length ? manor.verdict() : null;
      if (k === 'insp' && !v) return '';
      return `<div class="rx-round"><h2>${v ? `검수 · ${esc(v.name.ko)} · ${v.ok ? '통과' : '내일 다시'}` : title}</h2><div class="rx">${ok} / ${er.length} 정확 · 거의 ${near}</div>` +
        `<div class="rx-say">${said(v || tier(voiceOf(id).extra, er.length ? ok / er.length : 0))}</div>` +
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

    /* every thirty answers with this professor earn a tea invitation, offered here at the end of the lesson
       (by the fire it is a talk; at the manor there is no tea, only the day's wages) */
    let tea = $('#rpTea');
    if (!tea){ tea = document.createElement('div'); tea.id = 'rpTea'; tea.className = 'rx-round rp-tea'; $('#rpProg').before(tea); }
    const tv = bond.inviteSrc(id) === 'study' && bond.inviteText(id);
    tea.hidden = !tv;
    if (place === 'manor'){ const wg = manor.reportBlock(); tea.hidden = !wg; tea.innerHTML = wg; }
    else if (place === 'drawing'){
      /* what crossed the floor today; and, when she is about to start one, the talk */
      const html = bella.reportBlock() + (tv ? `<h2>응접실 대화</h2><div class="rx-say">${said(tv)}</div><button type="button" class="rp-teago" data-go="#/manor/drawing">펜을 내려놓는다 →</button>` : '');
      tea.hidden = !html; tea.innerHTML = html;
    }
    else if (tv && place === 'fire') tea.innerHTML = `<h2>불 속 대화</h2><div class="rx-say">${said({en: bond.fill(tv.en), ko: bond.fill(tv.ko)})}</div><button type="button" class="rp-teago" data-go="#/fire">불가에 더 앉아 있는다 →</button>`;
    else if (tv) tea.innerHTML = `<h2>차 한 잔 초대</h2><div class="rx-say">${said({en: bond.fill(tv.en), ko: bond.fill(tv.ko)})}</div><button type="button" class="rp-teago"><span lang="en">I'd be delighted.</span> 기꺼이 가겠습니다 →</button>`;

    if (!reduced()){ paper.classList.remove('drop'); void paper.offsetWidth; paper.classList.add('drop'); }
    $('#repScroll').scrollTop = 0;
  }
  return {show, resize: () => {}};
}
