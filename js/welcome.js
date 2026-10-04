/* First visit (2026-10-04 user decision): before any owl can find you, the professors need a name to write to.
   A parchment note asks for an English first name, an optional surname and how to be addressed; it can be changed
   later in settings. Shown until it has been answered once (settings.named). */
import * as store from './store.js';
import {$, esc, openSheet, closeSheet, toast} from './ui.js';

const TITLES = [['', '성만'], ['Ms', 'Ms'], ['Miss', 'Miss'], ['Mrs', 'Mrs'], ['Mr', 'Mr'], ['Mx', 'Mx']];

function preview(){
  const first = $('#wFirst').value.trim(), sur = $('#wSur').value.trim(), title = $('#wTitle').value;
  const formal = sur ? (title ? `${title} ${sur}` : sur) : first;
  $('#wPrev').innerHTML = first
    ? `<span lang="en">“${esc(formal || first)}, do sit down.”</span> <small>— 격식 있게</small><br><span lang="en">“My dear ${esc(first)}, …”</span> <small>— 다정하게</small>`
    : '이름을 쓰면 교수들이 어떻게 부를지 여기 보입니다.';
  $('#wGo').disabled = !/^[A-Za-z][A-Za-z' -]*$/.test(first);
}

export function askName(done){
  const s = store.get().settings;
  if (s.named) return;
  const keep = v => (v === 'Ahn' || v === 'Jeonghyun') ? '' : (v || '');   // the old built-in example names are not anyone's
  const [bm, bd] = (s.birthday || '').split('-').map(Number);               // month-day only: the card needs no year
  openSheet(`<div class="sh-kind"><span>처음 오셨군요</span></div>` +
    `<h2 class="sh-expr" id="shTitle" lang="en">Your name, please.</h2>` +
    `<p class="w-lead">교수들이 편지와 차 대화에서 부를 이름입니다. 영어 알파벳으로 적어 주세요. 나중에 설정에서 바꿀 수 있습니다.</p>` +
    `<form class="w-form" id="wForm" autocomplete="off">` +
    `<label>이름 (영문) <input id="wFirst" maxlength="24" placeholder="예: Narcissa" value="${esc(keep(s.firstName))}" required></label>` +
    `<label>성 (영문, 선택) <input id="wSur" maxlength="24" placeholder="예: Malfoy" value="${esc(keep(s.surname))}"></label>` +
    `<label>호칭 <select id="wTitle">${TITLES.map(([v, t]) => `<option value="${v}"${(s.title || '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` +
    `<fieldset class="w-bday"><legend>생일 (선택) · 그날 교수들이 카드를 보냅니다</legend>` +
    `<select id="wMon" aria-label="월"><option value="">월</option>${Array.from({length: 12}, (_, i) => `<option value="${i + 1}"${bm === i + 1 ? ' selected' : ''}>${i + 1}월</option>`).join('')}</select>` +
    `<select id="wDay" aria-label="일"><option value="">일</option>${Array.from({length: 31}, (_, i) => `<option value="${i + 1}"${bd === i + 1 ? ' selected' : ''}>${i + 1}일</option>`).join('')}</select></fieldset>` +
    `<p class="w-prev" id="wPrev"></p>` +
    `<button type="submit" class="sh-drill" id="wGo">이 이름으로 시작하기</button></form>`);
  preview();
  $('#wForm').addEventListener('input', preview);
  $('#wForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#wGo').disabled) return;
    const st = store.get().settings;
    st.firstName = $('#wFirst').value.trim();
    st.surname = $('#wSur').value.trim();
    st.title = $('#wTitle').value;
    const m = +$('#wMon').value, d = +$('#wDay').value, max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    st.birthday = m && d && d <= max ? `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
    st.named = true;
    store.save();
    closeSheet();
    toast(`<span class="q" lang="en">Welcome, ${esc(st.firstName)}.</span><span class="k">부엉이들이 이 이름으로 편지를 보냅니다.</span>`, 2800, true);
    if (done) done();   // the welcome letter is already on the wing (app.js)
  });
  setTimeout(() => { const f = $('#wFirst'); if (f) f.focus({preventScroll: true}); }, 400);
}
