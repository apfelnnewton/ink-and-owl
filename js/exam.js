/* The O.W.L. paper (2026-10-16, docs/plan-owl.md · the look: docs/owl-paper-mock.html): one sheet of the app's
   parchment over the professor's classroom, the questions down it, the answers in a pen's blue-black. Handed in, the
   same sheet comes back in the professor's red ink: a tick or a cross on each, the right word beside a wrong one, the
   grade circled, one remark in the margin. Then the results notice, as the Examinations Authority sends it.
   #/exam/<deck> the paper · #/exam/<deck>/results/<t> the notice of that sitting (from the post) */
import {byId, homeOf} from './decks.js';
import * as exams from './exams.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import {$, esc, fitPaper, toast, reduced} from './ui.js';
import {showManor} from './manortest.js';

const KIND = {mean: '뜻 고르기', plain: '쉬운 말을 보고 낱말을', blank: '새 문장의 빈칸'};
const POS = {'n.': '명사', 'v.': '동사', 'adj.': '형용사', 'adv.': '부사', 'phr. v.': '구동사', 'prep.': '전치사', 'conj.': '접속사', 'interj.': '감탄사'};

export function initExam(app){
  const body = $('#exBody'), scroll = $('#exScroll');
  fitPaper($('#exPaper'));
  let id = null, qs = null, answers = [], sit = null, warned = false, manor = null;   // manor: the Audit or Word for Word is on (manortest.js)

  $('#exBack').addEventListener('click', () => {
    if (qs && !sit && answers.some(a => a)){ if (!warned){ warned = true; toast('지금 나가면 이 시험지는 버려진다 · 한 번 더 누르면 나간다', 3200); return; } }
    /* a kept paper or notice was opened from somewhere (the post, the register): back is back there */
    if (/^#\/exam\/[a-z]+\/(paper|results)\//.test(location.hash) && history.length > 1){ history.back(); return; }
    app.go(homeOf(id || 'snape'));
  });

  const head = (sub) => `<div class="ex-auth">Wizarding Examinations Authority</div><div class="ex-title">Ordinary Wizarding Level</div>
    <div class="ex-subj" lang="en">${esc(exams.SUBJECT[id])}</div><div class="ex-exr" lang="en">Examiner: ${esc(exams.examiner(id))}</div>
    <div class="ex-rule dbl"></div><div class="ex-meta"><span lang="en">Candidate: <i>${esc(bond.fill('{name}'))}</i>${sub ? ' · ' + esc(sub) : ''}</span></div><div class="ex-rule"></div>`;

  async function show({id: deck}){
    id = deck; qs = null; answers = []; sit = null; warned = false; handWarned = false;
    if (manor && manor.cancel) manor.cancel(); manor = null; body.onclick = body.oninput = body.onkeydown = null; $('#exTtl').textContent = 'O.W.L.';
    const d = byId(id);
    if (d && exams.MANOR[id]){
      const pic = f => `url("${new URL(`assets/rooms/${id}-${f}.webp`, location.href).href}")`;
      $('#exPhoto').style.setProperty('--p', pic('portrait')); $('#exPhoto').style.setProperty('--w', pic('wide'));
      $('#exCnt').textContent = ''; body.innerHTML = '<p class="ex-wait">종이를 펼치는 중…</p>';
      await exams.load(); await bond.load(id);
      manor = {app, id, body, scroll, setTitle: t => { $('#exTtl').textContent = t; }, setCount: t => { $('#exCnt').textContent = t; }};
      showManor(manor); return;
    }
    if (!d || !exams.SUBJECT[id]){ app.go('#/', true); return; }
    const pic = f => `url("${new URL(`assets/rooms/${id}-${f}.webp`, location.href).href}")`;
    $('#exPhoto').style.setProperty('--p', pic('portrait')); $('#exPhoto').style.setProperty('--w', pic('wide'));
    $('#exCnt').textContent = '';
    body.innerHTML = '<p class="ex-wait">시험지를 펼치는 중…</p>';
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const [words, cards] = await Promise.all([app.loadWords(id), app.loadDeck(id).catch(() => null), exams.load(), bond.load(id)]);
    if (parts[2] === 'results'){ notice(+parts[3]); return; }
    if (parts[2] === 'paper'){ const k = exams.st(id).s.find(x => x.t === +parts[3]), kp = exams.keptPaper(k); if (kp){ sit = k; marked(kp.qs, kp.answers); } else notice(+parts[3]); return; }
    const kind = exams.due(id, words);
    if (!kind){ nothing(words); return; }
    const p = cards && srs.preview(id, cards);
    if (p && !(p.done || p.empty)){ lessonFirst(); return; }
    const all = Object.values(words).flat();
    qs = exams.paper(id, words, all, kind); answers = qs.map(() => null);
    paperView(kind);
  }

  function card(en, ko, btns){
    body.innerHTML = `<div class="ex-auth">Wizarding Examinations Authority</div><p class="ex-say" lang="en">${esc(en)}</p><p class="ex-say-ko">${esc(ko)}</p><div class="ex-foot">${btns}</div>`;
    scroll.scrollTop = 0;
  }
  function nothing(words){
    const w = exams.standing(id, words), left = Math.max(0, 12 - w.fresh.length);
    card('No paper is waiting for you.', `지금은 기다리는 시험지가 없다. 이 교실 대사에서 새 낱말이 ${left}개 더 쌓이면 시험지가 온다.`,
      `<button type="button" class="ex-btn" data-go="${homeOf(id)}"><span lang="en">Back</span> 돌아가기</button>`);
  }
  function lessonFirst(){
    card('The lesson first. The paper will keep.', '오늘 수업을 먼저 마친다. 시험지는 그 뒤에 받는다.',
      `<button type="button" class="ex-btn" data-go="#/room/${id}"><span lang="en">To the lesson</span> 수업으로</button>`);
  }

  /* ---------- the paper being answered */
  function qHtml(q, i){
    const opts = q.opts && !q.write;
    let ask = '';
    if (q.shape === 'mean') ask = `<div class="ex-qw" lang="en">${esc(q.w)}<span class="pos">${esc(q.pos)}</span></div>`;
    else if (q.shape === 'plain') ask = `<div class="ex-qs" lang="en">${esc(q.plain)}<span class="gloss">${esc(q.ko)} · ${esc(POS[q.pos] || q.pos)}</span></div>`;
    else ask = `<div class="ex-qs" lang="en">${esc(q.sentence).replace(/____/g, '<span class="ex-gap"></span>')}${q.hint ? `<span class="gloss en">${esc(q.hint)}</span>` : ''}</div>`;
    const ans = opts
      ? `<div class="ex-opts${q.shape === 'mean' ? '' : ' en'}">${q.opts.map((o, k) => `<button type="button" data-q="${i}" data-o="${k}"${q.shape === 'mean' ? '' : ' lang="en"'}><b>${'abcd'[k]}</b><span>${esc(o)}</span></button>`).join('')}</div>`
      : `<label class="ex-write"><span class="first" lang="en">${esc(q.first)}</span><input type="text" data-q="${i}" lang="en" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" aria-label="${i + 1}번 답">${exams.wordCount(q)}</label>`;
    return `<li data-i="${i}"><span class="num">${i + 1}.</span><div class="ex-qk">${KIND[q.shape]}</div>${ask}${ans}</li>`;
  }
  function paperView(kind){
    const n = exams.sittings(id).length + 1;
    body.innerHTML = head(`Paper ${n}`) +
      `<p class="ex-instr" lang="en">Answer every question. Write in ink.<span class="ko">모든 문제에 답한다. 내기 전까지는 고칠 수 있다.</span></p>` +
      (kind === 'retake' ? '<p class="ex-instr ko-only">지난번에 틀린 낱말이 새 낱말 사이에 다시 나온다.</p>' : '') +
      `<ol class="ex-q">${qs.map(qHtml).join('')}</ol>` +
      `<div class="ex-foot"><button type="button" class="ex-btn" id="exHand"><span lang="en">Hand in your paper</span> 답안 내기</button></div>`;
    count(); scroll.scrollTop = 0;
  }
  const count = () => { if (!qs) return; $('#exCnt').textContent = sit ? '' : `${answers.filter(a => a).length} / ${qs.length}`; };

  body.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if (go){ app.go(go.dataset.go); return; }
    if (manor) return;   // the manor's tests answer on their own (manortest.js)
    const b = e.target.closest('.ex-opts button');
    if (b && !sit){
      const i = +b.dataset.q; answers[i] = qs[i].opts[+b.dataset.o];
      b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); count(); return;
    }
    if (e.target.closest('#exHand')) handIn();
    if (e.target.closest('#exNotice')) notice(sit.t);
  });
  body.addEventListener('input', e => {
    const inp = e.target.closest('input[data-q]'); if (!inp || sit || manor) return;
    const i = +inp.dataset.q, q = qs[i], v = inp.value.trim();
    answers[i] = v ? (v.toLowerCase().startsWith(q.first.toLowerCase()) ? v : q.first + v) : null;   /* the first letter is given: typed or not, it counts */
    count();
  });
  body.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return; const inp = e.target.closest('input[data-q]'); if (!inp) return;
    e.preventDefault(); const next = body.querySelector(`input[data-q="${+inp.dataset.q + 1}"]`) || [...body.querySelectorAll('input[data-q]')].find(x => +x.dataset.q > +inp.dataset.q); if (next) next.focus(); else inp.blur();
  });

  let handWarned = false;
  function handIn(){
    const empty = answers.filter(a => !a).length;
    if (empty && !handWarned){ handWarned = true; toast(`${empty}문제가 비어 있다 · 그대로 내려면 한 번 더 누른다`, 3200); return; }
    sit = exams.record(id, qs, answers);
    marked(qs, answers);
  }

  /* ---------- the paper marked in red */
  function marked(qs, answers){
    const g = exams.gradeAt(sit), r = exams.remark(id, sit);
    const items = qs.map((q, i) => {
      const ok = q.ok !== undefined ? q.ok : exams.right(q, answers[i]), given = answers[i];
      let ask = q.shape === 'mean' ? `<div class="ex-qw" lang="en">${esc(q.w)}<span class="pos">${esc(q.pos)}</span></div>`
        : q.shape === 'plain' ? `<div class="ex-qs" lang="en">${esc(q.plain)}</div>`
        : `<div class="ex-qs" lang="en">${esc(q.sentence).replace(/____/g, '<span class="ex-gap"></span>')}${q.hint ? `<span class="gloss en">${esc(q.hint)}</span>` : ''}</div>`;
      const ko = q.shape === 'mean';
      const mine = given ? `<span class="ex-pen${ok ? '' : ' struck'}"${ko ? '' : ' lang="en"'}>${esc(given)}</span>` : '<span class="ex-pen none">—</span>';
      const fix = ok ? '' : `<span class="ex-fix"${ko ? '' : ' lang="en"'}>${esc(q.answer)}</span>`;
      return `<li class="${ok ? 'ok' : 'no'}" style="--i:${i}"><span class="mk" aria-label="${ok ? '맞음' : '틀림'}">${ok ? '✓' : '✗'}</span><span class="num">${i + 1}.</span>${ask}<div class="ex-ans">${mine}${fix}</div></li>`;
    }).join('');
    body.innerHTML = `<div class="ex-grade" aria-label="등급 ${g[0]}"><b lang="en">${g[0]}</b><small lang="en">${esc(g[1])}</small></div>` + head(`${sit.ok} of ${sit.n}`) +
      `<ol class="ex-q marked">${items}</ol>` +
      (r ? `<div class="ex-margin"><p lang="en">${esc(bond.fill(r.en))}</p><p class="ko">${esc(bond.fill(r.ko))}</p><p class="sig" lang="en">${esc(initials(id))}</p></div>` : '') +
      `<div class="ex-foot"><button type="button" class="ex-btn" id="exNotice"><span lang="en">Results</span> 성적 통지서 보기</button>` +
      `<button type="button" class="ex-btn quiet" data-go="${homeOf(id)}"><span lang="en">Back</span> 돌아가기</button></div>`;
    $('#exCnt').textContent = ''; scroll.scrollTop = 0;
    if (!reduced()) body.classList.add('marking'); setTimeout(() => body.classList.remove('marking'), 60);
  }
  const initials = d => byId(d).tag.split(/\s+/).map(x => x[0]).join('.') + '.';

  /* ---------- the results notice: every paper sat so far, the best grade of each */
  function notice(t){
    const s = exams.st(id).s.find(x => x.t === t) || exams.st(id).s[exams.st(id).s.length - 1]; sit = s;
    const rows = exams.results().map(r => r.best
      ? `<tr${r.id === id ? ' class="this"' : ''}><td lang="en">${esc(r.subject)}<span class="who">${esc(r.examiner)} · ${esc(dateEn(r.best.s.d))}</span></td><td class="g${exams.PASS.has(r.best.g[0]) ? '' : ' fail'}" lang="en">${r.best.g[0]}</td></tr>`
      : `<tr class="wait"><td lang="en">${esc(r.subject)}<span class="who">${esc(r.examiner)} · not yet sat</span></td><td class="g">–</td></tr>`).join('');
    body.innerHTML = `<div class="ex-auth">Wizarding Examinations Authority</div><div class="ex-title">Ordinary Wizarding Level Results</div><div class="ex-rule dbl"></div>
      <div class="ex-keys" lang="en"><div><h4>Pass grades</h4>Outstanding (O)<br>Exceeds Expectations (E)<br>Acceptable (A)</div><div><h4>Fail grades</h4>Poor (P)<br>Dreadful (D)<br>Troll (T)</div></div>
      <div class="ex-rule"></div><p class="ex-name" lang="en">${esc(bond.fill('{name}'))} has achieved:</p><table class="ex-res">${rows}</table>
      <p class="ex-sign" lang="en">Griselda Marchbanks, Head of the Wizarding Examinations Authority</p>
      <p class="ex-note">과목마다 지금까지 가장 좋은 등급.${s ? ` 이번 시험: ${esc(exams.SUBJECT_KO[id])} ${exams.gradeLetter(s)}.` : ''}</p>
      <div class="ex-foot">${s && s.p ? `<button type="button" class="ex-btn" data-go="#/exam/${id}/paper/${s.t}"><span lang="en">The marked paper</span> 채점된 시험지 보기</button>` : ''}<button type="button" class="ex-btn${s && s.p ? ' quiet' : ''}" data-go="${homeOf(id)}"><span lang="en">Back</span> 돌아가기</button></div>`;
    $('#exCnt').textContent = ''; scroll.scrollTop = 0;
  }
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateEn = d => { const [, m, dd] = d.split('-'); return `${+dd} ${MON[+m - 1]}`; };

  return {show, hide(){ qs = null; sit = null; if (manor && manor.cancel) manor.cancel(); manor = null; }};
}
