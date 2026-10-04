/* Reading the script (#/script/<deck>): a professor's lines film by film, in order, under their scenes, with the line
   spoken just before. Key expressions are underlined; tapping a line reads it aloud (en-GB). Reading only — nothing
   here touches the review schedule. */
import {DECKS, SPEAKERS, LOCKED, byId} from './decks.js';
import * as store from './store.js';
import * as speech from './speech.js';
import {findRanges} from './room.js';
import {$, esc, toast} from './ui.js';

export function initScript(app){
  const sec = $('#script'), list = $('#scList');
  let deck = null, cards = [], film = 0, showKo = true;

  function underline(line, bre){
    const rs = findRanges(line, bre).sort((a, b) => a[0] - b[0]);
    let html = '', at = 0;
    rs.forEach(([a, b]) => { if (a < at) return; html += esc(line.slice(at, a)) + `<u>${esc(line.slice(a, b))}</u>`; at = b; });
    return html + esc(line.slice(at));
  }
  function draw(){
    const films = [...new Set(cards.map(c => c.film))].sort((a, b) => a - b);
    if (!films.includes(film)) film = films[0];
    $('#scFilms').innerHTML = films.map(f => {
      const c = cards.find(x => x.film === f);
      return `<button type="button" data-film="${f}" class="${f === film ? 'on' : ''}" aria-pressed="${f === film}" title="${esc(c.film_ko)}">${f}편</button>`;
    }).join('');
    const rows = cards.filter(c => c.film === film).sort((a, b) => a.order - b.order);
    const learnt = store.deck(deck.id).cards;
    let scene = '', html = '';
    for (const c of rows){
      if (c.scene_ko !== scene){ scene = c.scene_ko; html += `<h3 class="sc-scene">${esc(scene)}</h3>`; }
      const cue = !c.prev_line && c.cue ? `<p class="sc-cue"><b>${esc(SPEAKERS[c.cue_speaker] || c.cue_speaker || '')}</b> <span lang="en">${esc(c.cue)}</span></p>` : '';
      html += `${cue}<div class="sc-line${learnt[c.id] ? ' seen' : ''}" data-say="${esc(c.id)}" tabindex="0" role="button" aria-label="읽어 주기">` +
        `<p class="en" lang="en">${underline(c.line, c.bre)}</p>${showKo ? `<p class="kr">${esc(c.ko)}</p>` : ''}` +
        `${c.source === 'fan_script' ? '<span class="fan">팬 대본</span>' : ''}</div>`;
    }
    list.innerHTML = html;
    $('#scCount').textContent = `${rows.length}줄`;
    $('#scFilmName').textContent = rows.length ? `${film}편 · ${rows[0].film_ko}` : '';
  }

  $('#scFilms').addEventListener('click', e => { const b = e.target.closest('[data-film]'); if (!b) return; film = +b.dataset.film; draw(); $('#scScroll').scrollTop = 0; });
  $('#scKo').addEventListener('click', () => { showKo = !showKo; $('#scKo').setAttribute('aria-pressed', !showKo); $('#scKo').textContent = showKo ? '한국어 숨기기' : '한국어 보기'; draw(); });
  const say = el => {
    const c = cards.find(x => x.id === el.dataset.say); if (!c) return;
    if (!speech.speak(c.line, store.get().settings.voice)) toast('이 기기에서 영국 영어(en-GB) 목소리를 찾지 못했습니다.');
    list.querySelectorAll('.sc-line.on').forEach(x => x.classList.remove('on')); el.classList.add('on');
  };
  list.addEventListener('click', e => { const el = e.target.closest('[data-say]'); if (el) say(el); });
  list.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-say]')){ e.preventDefault(); say(e.target); } });
  $('#scWho').addEventListener('click', e => {
    const b = e.target.closest('[data-who]'); if (!b) return;
    const d = byId(b.dataset.who);
    if (d.file){ if (d.id !== deck.id) app.go('#/script/' + d.id); return; }
    const l = (LOCKED[d.id] || [{en: 'Not yet.', ko: '아직이다.'}])[0];
    toast(`<span class="q" lang="en">“${esc(l.en)}”</span><span class="k">${esc(l.ko)} — ${esc(d.ko)}</span>`, 3600, true);
  });
  $('#scBack').addEventListener('click', () => app.go('#/notes/' + deck.id));
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape') app.go('#/notes/' + deck.id); });

  async function show({id}){
    const d = byId(id) && byId(id).file ? byId(id) : byId('snape');
    if (!deck || deck.id !== d.id) film = 0;
    deck = d;
    $('#scWho').innerHTML = DECKS.map(x => `<button type="button" data-who="${x.id}" class="${x.id === d.id ? 'on' : ''}${x.file ? '' : ' shut'}" aria-pressed="${x.id === d.id}">${esc(x.ko.replace(/ 교수$/, ''))}</button>`).join('');
    $('#scPhoto').style.backgroundImage = `url("${new URL(`assets/rooms/${d.id}-portrait.webp`, location.href).href}")`;
    try { cards = (await app.loadDeck(d.id)).filter(c => c.card !== false); }
    catch (e){ toast('대본을 불러오지 못했습니다.'); app.go('#/', true); return; }
    draw();
    $('#scScroll').scrollTop = 0;
  }
  return {show, hide: () => speech.stop()};
}
