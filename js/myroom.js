/* My room (#/me): the guest room at the top of the tower, the first door in the corridor. The letters wait on the
   desk (the owl post, #/letters); the professors' gifts are kept in the specimen drawers of the cabinet
   (#/me/cabinet/<deck>): one drawer per professor, thirty velvet compartments each. A gift that has arrived sits in
   its compartment, its black ground melting into the velvet; an empty one says how it is earned. The wand box and
   the spellbook (#/me/wand, #/me/spells) come with Ollivander's note and the wand. */
import {DECKS, byId} from './decks.js';
import * as bond from './bond.js';
import * as post from './post.js';
import * as wand from './wand.js';
import * as spells from './spells.js';
import * as doors from './doors.js';
import {cardWords, gloss, boxed} from './ollivander.js';
import {$, esc, toast, openSheet, closeSheet, isSheetOpen, fitPaper} from './ui.js';
const ID = n => 'K' + String(n).padStart(2, '0');
/* how each keepsake is earned (bond.js: stage letters, requests, half / all learnt, every tenth tea, every fifteenth letter) */
const WHEN = n => n <= 4 ? `${bond.STAGES[n]} 단계` : n <= 8 ? `부탁 ${[1, 3, 6, 10][n - 5]}번째` : n === 9 ? '대사 절반 배움' :
  n === 10 ? '대사 전부 숙달' : n <= 20 ? `차 ${(n - 10) * 10}번째` : `편지 ${(n - 20) * 15}통째`;
const img = (id, k) => new URL(`assets/keepsakes/${id}-${k}.webp`, location.href).href;
const fmt = t => { const [, m, d] = t.split('-').map(Number); return `${m}월 ${d}일`; };
const para = s => esc(bond.fill(s)).split(/\n+/).map(p => `<p>${p}</p>`).join('');

export function initMyRoom(app){
  const sec = $('#me');
  let deck = null, cabinet = false, view = 'room';

  const gifts = id => bond.keepsakes(id);
  const total = () => DECKS.reduce((s, d) => s + gifts(d.id).length, 0);

  function drawRoom(){
    const n = bond.unread() + post.unread(), g = total();   // the post holds the friends' letters too
    $('#meMailN').textContent = n ? `· 새 편지 ${n}통` : '';
    $('#meCabN').textContent = `· ${g} / ${DECKS.length * 30}`;
    $('#meJnlN').textContent = `· ${DECKS.reduce((s, d) => s + drunk(d.id).length, 0)}잔`;
    /* the wand box appears with Ollivander's note, and holds the wand once it is made */
    const w = wand.get();
    $('#meWand').hidden = !w && !wand.noteArrived();
    $('#meWandN').textContent = w ? `· ${wand.WOODS[w.wood].ko}` : '· 올리밴더의 쪽지';
    /* the spellbook comes with the wand */
    $('#meSpl').hidden = !w;
    const due = spells.dueCount();
    $('#meSplN').textContent = `· ${spells.learntList().length} / 21${due ? ` · 복습 ${due}` : ''}`;
  }

  /* ---------- the wand box (#/me/wand): the wand in its box and Ollivander's card; earlier wands below */
  function drawWand(){
    const w = wand.get(), body = $('#wndBody');
    if (!w){
      body.innerHTML = `<header class="jnl-head"><i class="seal o-wand"></i><div><h2 lang="en">A note from Ollivanders</h2><p>부엉이가 가져온 쪽지</p></div></header>` +
        `<p class="wnd-note" lang="en">${esc(bond.fill(wand.NOTE.en))}</p><p class="wnd-sign" lang="en">— ${wand.NOTE.sign}</p><p class="wnd-ko">${esc(bond.fill(wand.NOTE.ko))}</p>` +
        `<button type="button" class="wnd-go" data-shop><span lang="en">Call at the shop</span><small>올리밴더 가게로 가기</small></button>`;
      return;
    }
    const old = w.old || [];
    body.innerHTML = boxed(w.wood) + cardWords(w) +
      (old.length ? `<h3 class="wnd-h">예전 지팡이</h3><ul class="wnd-old">${old.map(o => `<li><img src="${wand.img(o.wood)}" alt=""><span>${esc(wand.titleKo(o))}</span><small>${o.d ? fmt(o.d) : ''}</small></li>`).join('')}</ul>` : '') +
      `<button type="button" class="wnd-go quiet" data-again><span lang="en">A new wand</span><small>새 지팡이 맞추기</small></button>`;
  }

  /* ---------- the spellbook (#/me/spells): every professor's three spells — learnt ones open their page (spell.js),
     one whose letter has come waits for its lesson, the rest say what opens them */
  function drawSpells(){
    const list = spells.all();
    $('#splBody').innerHTML = `<header class="jnl-head"><div><h2 lang="en">The Spellbook</h2><p>주문서 · ${spells.learntList().length} / ${list.length || 21}</p></div></header>` +
      DECKS.map(d => `<section class="spl-prof"><h3><i class="seal s-${d.id}"></i>${esc(d.ko)}</h3><ol>${spells.ofProf(d.id).map(sp => {
        if (spells.isLearnt(sp.id)) return `<li><button type="button" data-spell="${sp.id}" class="has"><b lang="en">${esc(sp.name)}</b><span>${esc(sp.ko)}</span>${spells.reviewDue(sp.id) ? '<em>복습할 때</em>' : ''}<i aria-hidden="true">→</i></button></li>`;
        if (spells.isSent(sp.id)) return `<li><button type="button" data-spell="${sp.id}" class="wait"><b lang="en">${esc(sp.name)}</b><span>편지가 왔습니다 · 수업 듣기</span><i aria-hidden="true">→</i></button></li>`;
        return `<li class="lock"><b>주문 ${sp.n}</b><span>${doors.isOpen(d.id) ? esc(spells.condition(sp)) + '이 되면 편지가 옵니다' : '이 교수의 문을 열면'}</span></li>`;
      }).join('')}</ol></section>`).join('');
  }

  function drawCabinet(){
    const have = new Map(gifts(deck.id).map(k => [k.id, k]));
    $('#cabWho').innerHTML = DECKS.map(d => `<button type="button" data-who="${d.id}" class="${d.id === deck.id ? 'on' : ''}" aria-pressed="${d.id === deck.id}">` +
      `${esc(d.ko.replace(/ 교수$/, ''))}<small>${gifts(d.id).length}</small></button>`).join('');
    $('#cabName').textContent = deck.tag || deck.who;
    $('#cabGrid').innerHTML = Array.from({length: 30}, (_, i) => {
      const n = i + 1, k = have.get(ID(n)), pos = `${(n * 37) % 100}% ${(n * 61) % 100}%`;
      return k
        ? `<button type="button" class="cab-cell has" data-k="${ID(n)}" style="background-position:${pos}" aria-label="${esc(k.name.ko)}"><img src="${img(deck.id, k.id)}" alt="" loading="lazy" onerror="this.remove()"></button>`
        : `<button type="button" class="cab-cell" data-k="${ID(n)}" style="background-position:${pos}" aria-label="빈 칸 · ${WHEN(n)}"><span>${WHEN(n)}</span></button>`;
    }).join('');
  }

  function openGift(key){
    const k = gifts(deck.id).find(x => x.id === key);
    if (!k){ const n = +key.slice(1); toast(`아직 빈 칸 · ${deck.ko}에게서 <b>${WHEN(n)}</b>에 받습니다`, 2600, true); return; }
    const b = bond.bondOf(deck.id), m = b.mail.find(x => x.id === key), t = b.keep[key] || (m && m.t);
    openSheet(`<div class="sh-kind"><span>${esc(deck.ko)}의 선물${t ? ' · ' + fmt(t) : ''}</span></div>` +
      `<figure class="lt-gift"><img src="${img(deck.id, key)}" alt=""><figcaption><b lang="en">${esc(k.name.en)}</b><span>${esc(k.name.ko)}</span></figcaption></figure>` +
      `<div class="lt-letter" lang="en" id="shTitle">${para(k.note.en)}</div><div class="lt-ko">${para(k.note.ko)}</div>`);
  }

  /* ---------- the tea journal (#/me/journal/<deck>): every tea taken, one page each, with the professor's own stain */
  const drunk = id => bond.teasOf(id).filter(t => bond.bondOf(id).teas[t.id] !== undefined);
  const stain = (id, key) => { const n = +key.slice(1), x = (n * 37) % 3, r = (n * 53) % 50 - 25;
    const pos = [['-16px', 'auto', '-12px', 'auto'], ['auto', '-16px', '-8px', 'auto'], ['auto', '-18px', 'auto', '38%']][x];
    return `<img class="jnl-stain" src="assets/journal/stain-${id}.webp" alt="" style="left:${pos[0]};right:${pos[1]};bottom:${pos[2]};top:${pos[3]};transform:rotate(${r}deg)">`; };
  let page = null;

  function drawJournal(){
    const list = drunk(deck.id), all = bond.teasOf(deck.id).length || 100, b = bond.bondOf(deck.id);
    $('#jnlWho').innerHTML = DECKS.map(d => `<button type="button" data-who="${d.id}" class="${d.id === deck.id ? 'on' : ''}" aria-pressed="${d.id === deck.id}">` +
      `${esc(d.ko.replace(/ 교수$/, ''))}<small>${drunk(d.id).length}</small>${bond.teaReady(d.id) ? '<i class="dot" aria-label="차 초대장">✉</i>' : ''}</button>`).join('');
    if (page){ drawPage(); return; }
    /* a tea invitation not yet taken is clipped to the front of the journal (it is also tucked into the professor's door) */
    const inv = bond.teaReady(deck.id), invCard = inv ? `<button type="button" class="jnl-inv" data-teago="${deck.id}"><i class="clip" aria-hidden="true"></i><i class="seal s-${deck.id}"></i>` +
      `<span><small>아직 마시지 않은 차${bond.inviteSrc(deck.id) === 'owl' ? ' · 오늘 밤까지' : ''}</small><b lang="en">${esc(inv.title.en)}</b><em>${esc(inv.title.ko)}</em></span><i class="go" aria-hidden="true">→</i></button>` : '';
    $('#jnlBody').innerHTML = `<header class="jnl-head"><i class="seal s-${deck.id}"></i><div><h2 lang="en">Tea with ${esc(deck.who)}</h2><p>${esc(deck.ko)}와 나눈 차 · ${list.length} / ${all}잔</p></div></header>` + invCard +
      (list.length ? `<ol class="jnl-toc">${list.map(t => { const lg = (b.teaLog || {})[t.id];
        return `<li><button type="button" data-tea="${t.id}"><span class="no">${+t.id.slice(1)}</span>` +
          `<span class="tt"><b lang="en">${esc(t.title.en)}</b><small>${esc(t.title.ko)}</small></span><span class="dt">${lg ? fmt(lg.d) : ''}</span></button></li>`; }).join('')}</ol>`
        : `<p class="jnl-empty">아직 빈 일지입니다. ${esc(deck.ko)}와 차를 마시면 그날의 대화가 여기 한 쪽씩 적힙니다.</p>`) +
      '';
  }

  function drawPage(){
    const t = bond.teasOf(deck.id).find(x => x.id === page), b = bond.bondOf(deck.id), lg = (b.teaLog || {})[page], list = drunk(deck.id);
    const i = list.findIndex(x => x.id === page), prev = list[i - 1], next = list[i + 1];
    const f = s => esc(bond.fill(s));
    const turns = t.turns.map((tn, k) => { const c = lg ? lg.c[k] : -1, o = tn.options[c];
      return `<div class="jnl-turn"><p class="pf" lang="en">${f(tn.prof.en)}</p><p class="pk">${f(tn.prof.ko)}</p>` +
        (o ? `<p class="me${({1: ' hl', '-1': ' ink'})[bond.tasteOf(o)] || ''}" lang="en"><span>${f(o.en)}</span></p><p class="mk">${f(o.ko)}</p><p class="pf" lang="en">${f(o.reply.en)}</p><p class="pk">${f(o.reply.ko)}</p>` +
          `<details class="jnl-other"><summary>다른 답</summary>${tn.options.map((x, j) => j === c ? '' : `<div><p class="me" lang="en">${f(x.en)}</p><p class="pf" lang="en">${f(x.reply.en)}</p><p class="pk">${f(x.reply.ko)}</p></div>`).join('')}</details>` : '') + '</div>'; }).join('');
    /* the professor's own colour for the highlighter: an answer they liked is marked, one they disliked gets a blot */
    $('#jnlBook').style.setProperty('--hl', deck.glow);
    $('#jnlBody').innerHTML = stain(deck.id, page) +
      `<div class="jnl-bar"><button type="button" data-toc>← 목차</button><span>${i + 1} / ${list.length}</span></div>` +
      `<header class="jnl-phead"><i class="seal s-${deck.id}"></i><div><small>${lg ? fmt(lg.d) : '날짜 기록 없음'}</small><h2 lang="en" id="jnlTtl">${esc(t.title.en)}</h2><p>${esc(t.title.ko)}</p></div></header>` +
      `<p class="jnl-scene">${esc(t.scene.ko)}</p>` +
      (lg ? '' : '<p class="jnl-note">이 차는 일지를 쓰기 전에 마셔서, 내가 고른 답은 남아 있지 않습니다.</p>') + turns +
      `<div class="jnl-turn close"><p class="pf" lang="en">${f(t.close.en)}</p><p class="pk">${f(t.close.ko)}</p></div>` +
      `<nav class="jnl-nav">${prev ? `<button type="button" data-tea="${prev.id}">← ${esc(prev.title.en)}</button>` : '<span></span>'}${next ? `<button type="button" data-tea="${next.id}">${esc(next.title.en)} →</button>` : '<span></span>'}</nav>`;
    $('#jnl').scrollTop = 0;
  }

  function mode(m){
    cabinet = m !== 'room';
    view = m;
    $('#meCard').hidden = cabinet;
    $('#cab').hidden = m !== 'cabinet';
    $('#jnl').hidden = m !== 'journal';
    $('#wnd').hidden = m !== 'wand';
    $('#spl').hidden = m !== 'spells';
    sec.classList.toggle('cabinet', cabinet);
    $('#meTtl').textContent = {cabinet: 'The Specimen Drawers', journal: 'The Tea Journal', wand: 'The Wand Box', spells: 'The Spellbook'}[m] || 'The Guest Room';
  }

  /* ---------- events */
  $('#meMail').addEventListener('click', () => app.go('#/letters'));
  $('#meCab').addEventListener('click', () => app.go('#/me/cabinet'));
  $('#cabWho').addEventListener('click', e => { const b = e.target.closest('[data-who]'); if (b && b.dataset.who !== deck.id) app.go('#/me/cabinet/' + b.dataset.who, true); });
  $('#cabGrid').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) openGift(b.dataset.k); });
  $('#meJnl').addEventListener('click', () => app.go('#/me/journal'));
  $('#meWand').addEventListener('click', () => app.go('#/me/wand'));
  $('#meSpl').addEventListener('click', () => app.go('#/me/spells'));
  $('#splBody').addEventListener('click', e => { const b = e.target.closest('[data-spell]'); if (b) app.go('#/spell/' + b.dataset.spell); });
  $('#wndBody').addEventListener('click', e => {
    const x = e.target.closest('[data-gl]'); if (x){ gloss(x.dataset.gl); return; }
    if (e.target.closest('[data-shop]')) app.go('#/ollivander');
    if (e.target.closest('[data-again]')) app.go('#/ollivander/again');
  });
  $('#jnlWho').addEventListener('click', e => { const b = e.target.closest('[data-who]'); if (b && b.dataset.who !== deck.id){ page = null; app.go('#/me/journal/' + b.dataset.who, true); } });
  $('#jnlBody').addEventListener('click', e => {
    const g = e.target.closest('[data-teago]'); if (g){ app.go(`#/letters/${g.dataset.teago}/tea`); return; }
    const t = e.target.closest('[data-tea]'); if (t){ page = t.dataset.tea; drawPage(); return; }
    if (e.target.closest('[data-toc]')){ page = null; drawJournal(); $('#jnl').scrollTop = 0; }
  });
  const back = () => { if (view === 'journal' && page){ page = null; drawJournal(); } else if (cabinet) app.go('#/me'); else { app.leftRoom = 'me'; app.go('#/'); } };
  $('#meBack').addEventListener('click', back);
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else back(); } });

  async function show({id, sub}){
    await Promise.all([...DECKS.map(d => bond.load(d.id)), spells.load()]).catch(() => {});
    if (id === 'cabinet'){
      deck = byId(sub) || DECKS.find(d => gifts(d.id).length) || DECKS[0];
      mode('cabinet');
      drawCabinet();
      $('#cab').scrollTop = 0;
    } else if (id === 'wand'){
      mode('wand');
      fitPaper($('#wndBook'));
      drawWand();
      $('#wnd').scrollTop = 0;
    } else if (id === 'spells'){
      mode('spells');
      fitPaper($('#splBook'));
      drawSpells();
      $('#spl').scrollTop = 0;
    } else if (id === 'journal'){
      deck = byId(sub) || DECKS.find(d => drunk(d.id).length) || DECKS[0];
      page = null;
      mode('journal');
      fitPaper($('#jnlBook'));
      drawJournal();
      $('#jnl').scrollTop = 0;
    } else {
      mode('room');
      drawRoom();
    }
  }
  return {show, refresh: () => { if (sec.hidden) return; if (view === 'cabinet') drawCabinet(); else if (view === 'journal') drawJournal(); else if (view === 'wand') drawWand(); else if (view === 'spells') drawSpells(); else drawRoom(); }};
}
