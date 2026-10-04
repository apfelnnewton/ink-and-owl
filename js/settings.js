/* Settings: the caretaker's notice board. Real inputs, dressed in parchment, ink and brass. */
import {rng, r1} from './art.js';
import {keyring} from './art-plus.js';
import {DECKS} from './decks.js';
import * as store from './store.js';
import * as speech from './speech.js';
import * as srs from './srs.js';
import {groupBox} from './friends.js';
import {$, $$, esc, toast, fitPaper, reduced} from './ui.js';

export const APP_VERSION = '1.0.0';

/* old scraps, pin holes and a few drawing-pin heads on the cork */
function corkBits(w, h){
  const R = rng(19); let s = `<rect width="${w}" height="${h}" filter="url(#cork)"/>`;
  for (let i = 0; i < 60; i++) s += `<circle cx="${r1(R() * w)}" cy="${r1(R() * h)}" r="${r1(.6 + R() * .8)}" fill="#2A1A0D" opacity=".55"/>`;
  const scraps = [[.05, .02, 70, 44, -6], [.7, .04, 86, 52, 5], [.02, .62, 64, 80, 4], [.74, .7, 78, 60, -4], [.4, .9, 90, 40, 2]];
  scraps.forEach(([fx, fy, sw, sh, rot], k) => {
    const x = fx * w, y = fy * h;
    s += `<g transform="rotate(${rot} ${r1(x + sw / 2)} ${r1(y + sh / 2)})" opacity=".8"><rect x="${r1(x + 2)}" y="${r1(y + 3)}" width="${sw}" height="${sh}" fill="#000" opacity=".3"/>` +
      `<rect x="${r1(x)}" y="${r1(y)}" width="${sw}" height="${sh}" fill="${k % 2 ? '#CDBE97' : '#BFAE84'}"/>` +
      Array.from({length: Math.floor(sh / 9) - 1}, (_, j) => `<path d="M${r1(x + 7)} ${r1(y + 12 + j * 8)} h${r1(sw - 16 - R() * 20)}" stroke="#2A2118" stroke-width=".7" opacity=".35"/>`).join('') +
      `<circle cx="${r1(x + sw / 2)}" cy="${r1(y + 5)}" r="3" fill="${k % 3 ? '#8E1B1B' : '#2E5A3A'}"/><circle cx="${r1(x + sw / 2 - .9)}" cy="${r1(y + 4.1)}" r=".9" fill="#fff" opacity=".5"/></g>`;
  });
  return s;
}

export function initSettings(app){
  const form = $('#setForm'), sec = $('#settings');
  fitPaper(form, 21, {top: true, pins4: true, id: 'set'});
  $('#hookKeys').innerHTML = keyring();
  const bits = $('#corkBits'), board = $('#corkboard');
  new ResizeObserver(() => { const w = board.clientWidth - 22, h = board.clientHeight - 22; if (w < 10 || h < 10) return; bits.setAttribute('viewBox', `0 0 ${w} ${h}`); bits.innerHTML = corkBits(w, h); }).observe(board);

  const S = () => store.get().settings;
  const num = (el, v) => { const n = Math.max(+el.min, Math.min(+el.max, Math.round(+v || 0))); el.value = n; return n; };

  function fill(){
    const s = S();
    $('#fNew').value = s.newPerDay; $('#fCap').value = s.reviewCap;
    $('#fKo').checked = s.koFront; $('#fAuto').checked = s.autoRead;
    $('#fSur').value = s.surname || ''; $('#fFirst').value = s.firstName || ''; $('#fTitle').value = s.title ?? ''; $('#fBday').value = s.birthday || '';
    namePreview();
    $('#fGroup').innerHTML = groupBox();
    const open = DECKS.filter(d => d.file);
    $('#fDeck').innerHTML = open.map(d => `<option value="${d.id}">${esc(d.ko)}</option>`).join('');
    $('#fVer').textContent = `앱 ${APP_VERSION} · 데이터 ${app.index ? app.index.version : '—'}`;
    voices(speech.gbVoices());
  }
  function voices(list){
    const sel = $('#fVoice'), s = S();
    if (!speech.supported() || !list.length){
      sel.innerHTML = '<option>영국 영어 목소리 없음</option>'; sel.disabled = true; $('#fTry').disabled = true;
      $('#voiceNote').textContent = speech.supported() ? '이 기기에는 en-GB 목소리가 없습니다. 기기 설정의 음성(손쉬운 사용 → 읽기 및 말하기)에서 영국 영어 목소리를 내려받으면 여기에 나타납니다.' : '이 브라우저는 읽어 주기를 지원하지 않습니다.';
      return;
    }
    sel.disabled = false; $('#fTry').disabled = false;
    sel.innerHTML = list.map(v => `<option value="${esc(v.name)}"${v.name === s.voice ? ' selected' : ''}>${esc(v.name)}</option>`).join('');
    if (!list.some(v => v.name === s.voice)) sel.selectedIndex = Math.max(0, list.findIndex(v => v.localService));
    $('#voiceNote').textContent = `영국 영어(en-GB) 목소리 ${list.length}개.`;
  }
  speech.onVoices(list => { if (!sec.hidden) voices(list); });

  function commit(){
    const s = S();
    s.newPerDay = num($('#fNew'), $('#fNew').value);
    s.reviewCap = num($('#fCap'), $('#fCap').value);
    s.koFront = $('#fKo').checked; s.autoRead = $('#fAuto').checked;
    if (!$('#fVoice').disabled) s.voice = $('#fVoice').value;
    s.surname = $('#fSur').value.trim(); s.firstName = $('#fFirst').value.trim() || s.firstName || ''; if (s.firstName) s.named = true; s.title = $('#fTitle').value;
    const bd = $('#fBday').value.trim().replace(/[./]/g, '-'), m = bd.match(/^(\d{1,2})-(\d{1,2})$/);
    s.birthday = m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31 ? `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : '';
    namePreview();
    if (!store.save()) toast('저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.');
  }
  /* how the professors will address you, shown as Snape would write it */
  function namePreview(){ const s = S(), first = s.firstName || '(이름)', formal = s.surname ? (s.title ? s.title + ' ' + s.surname : s.surname) : first; $('#fNamePrev').textContent = `교수들이 부르는 이름: ${formal} · 아주 친해지면 ${first}. 생일에는 카드가 옵니다.`; }
  form.addEventListener('change', commit);
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-step]'); if (!b) return;
    const el = $('#' + b.dataset.for); num(el, +el.value + +b.dataset.step); commit();
  });
  $('#fTry').addEventListener('click', () => { commit(); speech.speak('I assure you, Miss Granger, this will not happen again.', S().voice); });

  $('#fExport').addEventListener('click', async () => {
    const text = store.exportData(), name = `ink-and-owl-progress-${srs.today()}.json`;
    const file = new File([text], name, {type: 'application/json'});
    try {
      if (navigator.canShare && navigator.canShare({files: [file]}) && /iPhone|iPad|Android/i.test(navigator.userAgent)){ await navigator.share({files: [file], title: name}); return; }
    } catch (e){ if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('진도 파일을 저장했습니다.');
  });
  $('#fImport').addEventListener('click', () => $('#fFile').click());
  $('#fFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const err = store.mergeData(await f.text());
    if (err){ toast(err); return; }
    fill(); app.refresh();
    toast('두 기기의 진도를 합쳤습니다.');
  });
  $('#fReset').addEventListener('click', () => {
    const d = DECKS.find(x => x.id === $('#fDeck').value); if (!d) return;
    if (!confirm(`${d.ko} 덱의 진도를 모두 지웁니다. 되돌릴 수 없습니다. 지울까요?`)) return;
    store.resetDeck(d.id); app.refresh();
    toast(`${d.ko} 덱 진도를 초기화했습니다.`);
  });
  $('#setBack').addEventListener('click', () => app.go('#/'));
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape') app.go('#/'); });

  function show(){
    fill();
    if (!reduced()){ sec.classList.remove('enter-anim'); void sec.offsetWidth; sec.classList.add('enter-anim'); }
    $('.set-scroll', sec).scrollTop = 0;
  }
  return {show, resize: () => {}};
}
