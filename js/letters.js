/* The owl post (#/letters/<deck|friends>): everything a professor has sent — milestone letters, seasonal cards,
   requests and their answers, gifts — newest first, unread ones sealed. The first tab holds the friends' letters
   (friends.js). Tea (reached from an invitation) is a short conversation: the professor speaks, you
   choose one of three answers, the professor replies; three exchanges, then the professor ends it. */
import {DECKS, byId} from './decks.js';
import * as bond from './bond.js';
import * as store from './store.js';
import {$, esc, toast, openSheet, closeSheet, isSheetOpen} from './ui.js';
import * as post from './post.js';
import {sealTag, readLetter, friendBar, wireFriends} from './friends.js';
import {hint} from './hints.js';

const fmt = t => { const [, m, d] = t.split('-').map(Number); return `${m}월 ${d}일`; };
const para = s => esc(bond.fill(s)).split(/\n+/).map(p => `<p>${p}</p>`).join('');
/* the three answers at tea in a fixed but shuffled order per turn, so the professor's favourite is not always first */
const order = (key, n) => { let h = 2166136261; for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--){ h = Math.imul(h ^ i, 16777619); const j = (h >>> 0) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const giftImg = (id, k) => new URL(`assets/keepsakes/${id}-${k}.webp`, location.href).href;

export function initLetters(app){
  const sec = $('#letters'), list = $('#ltList');
  let deck = null, friends = false, tea = null, turn = 0, score = 0, picks = [];

  /* the first tab, "친구": the friends in your group (friends.js, post.js) — joining, writing, letters received */
  function tabs(){
    const n = post.unread(), on = friends;
    $('#ltWho').innerHTML = `<button type="button" data-who="friends" class="${on ? 'on' : ''}" aria-pressed="${on}">친구${n ? `<i class="dot" aria-label="안 읽은 편지 ${n}통">${n}</i>` : ''}</button>` +
      DECKS.map(d => { const n = bond.unread(d.id), on = !friends && d.id === deck.id; return `<button type="button" data-who="${d.id}" class="${on ? 'on' : ''}" aria-pressed="${on}">${esc(d.ko.replace(/ 교수$/, ''))}${n ? `<i class="dot" aria-label="안 읽은 편지 ${n}통">${n}</i>` : ''}</button>`; }).join('');
  }
  /* wax only on a letter still sealed (2026-10-04 user decision): once read, a row is just the name and its first line */
  function drawFriends(){
    tabs();
    $('#ltRel').innerHTML = friendBar();
    /* received letters only, newest first, under the day they came — not grouped by friend */
    const mail = post.letters().filter(m => m.to === post.myUid());
    list.innerHTML = mail.length ? mail.map((m, i) => {
      const who = post.memberOf(m.from), unread = !m.read, day = i === 0 || mail[i - 1].t !== m.t;
      return (day ? `<li class="lt-day">${fmt(m.t)}</li>` : '') +
        `<li class="${unread ? 'new' : ''}"><button type="button" data-fmail="${esc(m.id)}"${unread ? ' aria-label="새 편지"' : ''}>${unread ? sealTag(who.seal) : ''}` +
        `<span class="lt-meta" lang="en">${esc(who.name)}</span>` +
        `<span class="lt-first" lang="en">${esc(m.text.replace(/\s+/g, ' ').slice(0, 70))}${m.text.length > 70 ? '…' : ''}</span></button></li>`;
    }).join('') : (post.inGroup() ? `<li class="lt-none"><p>아직 친구에게서 온 편지가 없습니다.</p></li>` : '');
  }

  function draw(){
    if (friends){ drawFriends(); return; }
    const b = bond.bondOf(deck.id);
    tabs();
    /* nothing above a professor's letters any more: the relationship stage is in the register, a request on the door */
    $('#ltRel').innerHTML = '';
    const mail = b.mail.slice().reverse();
    list.innerHTML = mail.length ? mail.map(m => {
      const it = bond.itemOf(deck.id, m.id); if (!it) return '';
      const first = bond.fill(it.en).replace(/\s+/g, ' ').slice(0, 70);
      return `<li class="${m.read ? '' : 'new'}"><button type="button" data-mail="${esc(m.id)}">${m.read ? '' : `<i class="seal s-${deck.id}"></i>`}` +
        `<span class="lt-meta">${esc(it.kind)} · ${fmt(m.t)}</span><span class="lt-first" lang="en">${esc(first)}…</span></button></li>`;
    }).join('') : `<li class="lt-none"><p>아직 받은 편지가 없습니다. ${esc(deck.ko)}와(과) 공부하면 부엉이가 옵니다.</p></li>`;
  }

  function openMail(key){
    const it = bond.itemOf(deck.id, key); if (!it) return;
    const m = bond.bondOf(deck.id).mail.find(x => x.id === key); if (m && !m.read){ m.read = true; store.save(); }
    if (it.gift) bond.bondOf(deck.id).keep[it.gift.id] = bond.bondOf(deck.id).keep[it.gift.id] || m.t;
    openSheet(`<div class="sh-kind"><span>${esc(it.kind)}${m ? ' · ' + fmt(m.t) : ''}</span></div>` +
      (it.gift ? `<figure class="lt-gift"><img src="${giftImg(deck.id, it.gift.id)}" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()"><figcaption><b lang="en">${esc(it.gift.name.en)}</b><span>${esc(it.gift.name.ko)}</span></figcaption></figure>` : '') +
      `<div class="lt-letter" lang="en" id="shTitle">${para(it.en)}</div>` +
      `<div class="lt-ko">${para(it.ko)}</div>` + reqBlock(key));
    draw();
  }

  /* a request still in hand: the lines it names, and a way to practise them now */
  function reqBlock(key){
    const a = bond.activeRequest(deck.id); if (!a || key !== a.id + '-ask') return '';
    const cards = app.data[deck.id] || [], lines = a.cards.map(id => cards.find(c => c.id === id)).filter(Boolean);
    return `<div class="lt-reqbox"><p class="lt-reqtxt">${esc(bond.requestText(deck.id))}</p>` +
      (lines.length ? `<ol>${lines.map(c => `<li class="${a.hit.includes(c.id) ? 'ok' : ''}"><span lang="en">${esc(c.line)}</span></li>`).join('')}</ol>` +
        '<button type="button" class="sh-drill" data-reqgo="1">이 대사들 연습하기</button>' : '') + '</div>';
  }

  /* ---------- tea */
  function teaStart(){
    if (!bond.teaReady(deck.id)) return;
    /* the first tea ever: Dumbledore's note on answers and tastes, then the cup */
    hint('tea', () => {
      tea = bond.teaReady(deck.id); if (!tea || sec.hidden) return;
      turn = 0; score = 0; picks = [];
      teaTurn('');
    });
  }
  function teaTurn(before){
    const tn = tea.turns[turn];
    openSheet(`<div class="sh-kind"><span>차 한 잔 · ${turn + 1} / ${tea.turns.length}</span></div>` +
      `<h2 class="sh-expr" id="shTitle" lang="en">${esc(tea.title.en)}</h2>${turn === 0 ? `<p class="tea-scene">${esc(tea.scene.ko)}</p>` : ''}` + before +
      `<div class="tea-say"><p class="en" lang="en">${esc(bond.fill(tn.prof.en))}</p><p class="ko">${esc(bond.fill(tn.prof.ko))}</p></div>` +
      `<div class="tea-opts">${order(tea.id + '|' + turn, tn.options.length).map(i => { const o = tn.options[i]; return `<button type="button" data-tea="${i}"><span lang="en">${esc(bond.fill(o.en))}</span><small>${esc(bond.fill(o.ko))}</small></button>`; }).join('')}</div>`);
  }
  function teaPick(i){
    const tn = tea.turns[turn], o = tn.options[i]; if (!o) return;
    score += o.delta | 0; picks.push(i);
    const said = `<div class="tea-me"><p class="en" lang="en">${esc(bond.fill(o.en))}</p></div><div class="tea-say"><p class="en" lang="en">${esc(bond.fill(o.reply.en))}</p><p class="ko">${esc(bond.fill(o.reply.ko))}</p></div>`;
    turn++;
    if (turn < tea.turns.length){ teaTurn(said); return; }
    bond.finishTea(deck.id, tea, score, picks);
    openSheet(`<div class="sh-kind"><span>차 한 잔</span></div><h2 class="sh-expr" id="shTitle" lang="en">${esc(tea.title.en)}</h2>${said}` +
      `<div class="tea-say close"><p class="en" lang="en">${esc(bond.fill(tea.close.en))}</p><p class="ko">${esc(bond.fill(tea.close.ko))}</p></div>` +
      `<p class="tea-noted">오늘의 차는 내 방 <b>차 일지</b>에 적어 두었습니다.</p>` +
      `<button type="button" class="sh-drill" data-close>잔을 내려놓는다</button>`);
    tea = null;
    draw();
  }

  /* ---------- events */
  list.addEventListener('click', e => {
    const f = e.target.closest('[data-fmail]'); if (f){ readLetter(f.dataset.fmail, app); draw(); return; }
    const b = e.target.closest('[data-mail]'); if (b) openMail(b.dataset.mail);
  });
  $('#ltRel').addEventListener('click', e => { if (e.target.closest('#ltTea')) teaStart(); });
  $('#sheetBody').addEventListener('click', e => { if (!sec.hidden && e.target.closest('[data-reqgo]')){ closeSheet(); app.go(`#/room/${deck.id}/req`); } });
  $('#sheetBody').addEventListener('click', e => { if (sec.hidden || !tea) return; const b = e.target.closest('[data-tea]'); if (b) teaPick(+b.dataset.tea); });
  $('#ltWho').addEventListener('click', e => { const b = e.target.closest('[data-who]'); if (b && !b.classList.contains('on')) app.go('#/letters/' + b.dataset.who); });
  wireFriends(app);
  /* the post lies on the desk in your own room: back goes there */
  $('#ltBack').addEventListener('click', () => app.go('#/me'));
  document.addEventListener('keydown', e => { if (!sec.hidden && e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else app.go('#/me'); } });

  async function show({id, sub}){
    /* no professor named: friends' unread letters first, then whichever professor has unread post */
    friends = id === 'friends' || (!byId(id) && post.unread() > 0);
    if (friends){
      deck = deck || DECKS[0];
      $('#ltPhoto').style.backgroundImage = `url("${new URL('assets/rooms/me-portrait.webp', location.href).href}")`;
      draw(); $('#ltScroll').scrollTop = 0; return;
    }
    const want = byId(id) ? byId(id) : (DECKS.find(d => bond.unread(d.id)) || DECKS[0]);
    deck = want;
    await bond.load(deck.id);
    $('#ltPhoto').style.backgroundImage = `url("${new URL(`assets/rooms/${deck.id}-portrait.webp`, location.href).href}")`;
    if (!bond.loaded(deck.id)) toast('편지를 불러오지 못했습니다.');
    draw();
    $('#ltScroll').scrollTop = 0;
    /* arrived by accepting an invitation in the corridor: go straight in to tea */
    if (sub === 'tea'){ history.replaceState(null, '', '#/letters/' + deck.id); if (bond.teaReady(deck.id)) teaStart(); }
    /* arrived by opening an envelope the owl brought: that letter, open */
    else if (sub && bond.itemOf(deck.id, sub)){ history.replaceState(null, '', '#/letters/' + deck.id); openMail(sub); }
  }
  return {show, refresh: () => { if (deck) draw(); }};
}
