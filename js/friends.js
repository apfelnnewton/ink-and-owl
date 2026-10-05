/* Friends (2026-10-04 user decisions). There is no separate room for them: everything lives in the post, under the
   first tab "친구" (letters.js) — making or joining a group, choosing a seal, writing (English only), and the letters
   received, by date. The group code, who is in it and leaving are in settings. Wax only on what is still sealed:
   the owl's envelope and unread letters (plus the seal chooser and the "to whom" list, where the seal is the point).
   Data: post.js. */
import * as post from './post.js';
import * as wand from './wand.js';
import {$, esc, toast, openSheet, closeSheet} from './ui.js';

const fmt = t => { const [, m, d] = t.split('-').map(Number); return `${m}월 ${d}일`; };
/* a friend's wand (once their letter has been read), drawn small across the corner where the wax was */
export const wandTag = wood => wand.WOODS[wood] ? `<img class="fr-wand" src="${wand.img(wood)}" alt="" aria-hidden="true">` : '';
export const sealTag = (seal, cls = '') => seal ? `<i class="seal p-${esc(seal)} ${cls}" aria-hidden="true"></i>` : '';
export const paras = s => esc(s).split(/\n+/).map(p => `<p>${p}</p>`).join('');
const practiceNote = cls => post.isPractice() || (post.practiceMode() && !post.joined()) ? `<p class="${cls}">연습용 우체국 · 가짜 친구 3명(Clara, Theo, Iris)이 답장합니다. 진짜 친구에게는 가지 않습니다.</p>` : '';

/* the top of the "친구" tab in the post */
export function friendBar(){
  if (!post.joined()) return `<p class="fr-lead">친구들과 같은 그룹 코드를 쓰면 서로 영어 편지를 주고받을 수 있습니다. 한 그룹은 8명까지입니다.</p>` +
    `<button type="button" class="cgo fr-go" data-fr="create"><span>새 그룹 만들기</span><i aria-hidden="true">→</i></button>` +
    `<form class="fr-join" id="frJoin" autocomplete="off"><input id="frCode" maxlength="6" placeholder="받은 그룹 코드" aria-label="그룹 코드" autocapitalize="characters" spellcheck="false" lang="en"><button type="submit">들어가기</button></form>` +
    practiceNote('fr-practice');
  if (!post.inGroup()) return `<p class="fr-lead">그룹 <b lang="en">${esc(post.code())}</b>에 들어왔습니다. 편지를 봉할 도장을 고르세요.</p>` +
    `<button type="button" class="cgo fr-go" data-fr="seal"><span>도장 고르기</span><i aria-hidden="true">→</i></button>`;
  return `<button type="button" class="cgo fr-go" data-fr="write"><span>편지 쓰기</span><i aria-hidden="true">→</i></button>` + practiceNote('fr-practice');
}

export function openSeals(){
  const taken = post.takenSeals();
  openSheet(`<div class="sh-kind"><span>그룹 <b lang="en">${esc(post.code())}</b></span></div>` +
    `<h2 class="sh-expr" id="shTitle" lang="en">Choose your seal</h2><p class="w-lead">편지를 봉할 밀랍 도장입니다. 그룹 안에서 겹칠 수 없습니다.</p>` +
    `<div class="ow-seals">${post.SEALS.map(s => { const who = taken.get(s.id);
      return `<button type="button" class="ow-seal${who ? ' taken' : ''}" data-seal="${s.id}"${who ? ' disabled' : ''}>${sealTag(s.id)}<b lang="en">${s.en}</b><small>${who ? `${esc(who)}의 도장` : s.ko}</small></button>`; }).join('')}</div>`);
}

export function pickFriend(){
  openSheet(`<div class="sh-kind"><span>부엉이 편지</span></div><h2 class="sh-expr" id="shTitle" lang="en">To whom?</h2>` +
    `<ul class="fr-to">${post.members().map(m => `<li><button type="button" data-write="${esc(m.uid)}">${sealTag(m.seal)}<b lang="en">${esc(m.name)}</b><i aria-hidden="true">→</i></button></li>`).join('')}</ul>`);
}

export function readLetter(id, app){
  const x = post.letterOf(id); if (!x) return;
  const inbound = x.to === post.myUid(), other = post.memberOf(inbound ? x.from : x.to);
  openSheet(`<div class="sh-kind"><span>${inbound ? `<span lang="en">${esc(other.name)}</span>의 편지` : `<span lang="en">${esc(other.name)}</span>에게 보낸 편지`} · ${fmt(x.t)}</span></div>` +
    `<div class="lt-letter ow-letter" lang="en" id="shTitle">${paras(x.text)}</div>` +
    (inbound && post.inGroup() ? `<button type="button" class="sh-drill" data-write="${esc(other.uid)}">답장 쓰기</button>` : ''));
  if (inbound) post.markRead(id);
  app.refreshMail && app.refreshMail();
}

export function compose(uid, app){
  const m = post.memberOf(uid);
  openSheet(`<div class="sh-kind"><span><span lang="en">${esc(m.name)}</span>에게 · 부엉이 편지</span></div>` +
    `<h2 class="sh-expr" id="shTitle" lang="en">Dear ${esc(m.name)},</h2>` +
    `<form class="ow-pen" id="owPen" autocomplete="off"><textarea id="owText" lang="en" maxlength="${post.LIMIT}" rows="8" spellcheck="true" aria-label="편지 내용 (영어)" placeholder="Write in English…"></textarea>` +
    `<p class="ow-meta"><span id="owWarn"></span><span id="owCount">0 / ${post.LIMIT}</span></p>` +
    `<button type="submit" class="sh-drill" id="owSend" disabled>부엉이에게 맡기기</button></form>`);
  const ta = $('#owText'), go = $('#owSend');
  const check = () => {
    const v = ta.value, bad = post.foreign(v);
    $('#owCount').textContent = `${v.length} / ${post.LIMIT}`;
    $('#owWarn').textContent = bad ? '부엉이는 영어 편지만 나릅니다. 한글을 지워 주세요.' : '';
    go.disabled = !v.trim() || bad;
  };
  ta.addEventListener('input', check);
  $('#owPen').addEventListener('submit', async e => {
    e.preventDefault(); if (go.disabled) return;
    go.disabled = true;
    const err = await post.send(uid, ta.value);
    if (err){ toast(err); go.disabled = false; return; }
    closeSheet();
    toast(`<span class="q" lang="en">The owl is off.</span><span class="k">${esc(m.name)}에게 편지가 날아갑니다.</span>`, 2600, true);
    app.refreshMail && app.refreshMail();
    if (post.isPractice()) setTimeout(() => app.owlCheck(), 26000);
  });
  setTimeout(() => ta.focus({preventScroll: true}), 350);
}

/* settings → 친구 그룹: the code to hand round, who holds which seal, and the way out */
export function groupBox(){
  if (!post.joined()) return '<p class="note-s">아직 그룹이 없습니다. 편지함의 <b>친구</b> 칸에서 새로 만들거나 받은 코드로 들어갈 수 있습니다.</p>';
  const all = [{uid: post.myUid(), name: post.myName(), seal: post.mySeal(), me: true}, ...post.members()];
  return `<div class="row fg-row"><span>그룹 코드</span><b class="fg-code" lang="en">${esc(post.code())}</b><button type="button" class="brass sm" data-fg="copy">복사</button></div>` +
    `<ul class="fg-members">${all.map(m => `<li>${sealTag(m.seal)}<span lang="en">${esc(m.name)}</span>${m.me ? '<small>나</small>' : ''}</li>`).join('')}</ul>` +
    `<p class="note-s">${all.length} / ${post.MAX_MEMBERS}명${post.isPractice() ? ' · 연습용 우체국(가짜 친구)' : ''}</p>` +
    `<div class="row btns"><button type="button" class="wax" data-fg="leave">그룹에서 나가기</button></div>`;
}

export function wireFriends(app){
  const after = () => { app.refreshMail && app.refreshMail(); const g = $('#fGroup'); if (g) g.innerHTML = groupBox(); };
  /* a button that talks to the post office: dimmed until the answer comes back */
  const busy = async (el, job) => { if (!el || el.disabled) return; el.disabled = true; el.classList.add('wait'); try { return await job(); } finally { el.disabled = false; el.classList.remove('wait'); } };
  $('#ltRel').addEventListener('click', async e => {
    const a = e.target.closest('[data-fr]'); if (!a) return;
    if (a.dataset.fr === 'create') await busy(a, async () => { const err = await post.create(); if (err){ toast(err); return; } after(); openSeals(); });
    else if (a.dataset.fr === 'seal') await busy(a, async () => { await post.refreshSeals(); openSeals(); });
    else if (a.dataset.fr === 'write') pickFriend();
  });
  $('#ltRel').addEventListener('submit', async e => {
    if (e.target.id !== 'frJoin') return;
    e.preventDefault();
    await busy(e.target.querySelector('button'), async () => {
      const err = await post.join($('#frCode').value);
      if (err){ toast(err); return; }
      after(); openSeals();
    });
  });
  $('#sheetBody').addEventListener('click', async e => {
    const s = e.target.closest('[data-seal]');
    if (s && !s.disabled){
      await busy(s, async () => {
        const err = await post.pickSeal(s.dataset.seal);
        if (err){ toast(err); openSeals(); return; }
        closeSheet(); after();
        toast(`<span class="q" lang="en">Welcome to the group.</span><span class="k">이제 친구들에게 편지를 보낼 수 있습니다.</span>`, 2600, true);
        if (post.isPractice()) setTimeout(() => app.owlCheck(), 9000);
      });
      return;
    }
    const w = e.target.closest('[data-write]'); if (w){ compose(w.dataset.write, app); return; }
    const l = e.target.closest('[data-leave]');
    if (l) await busy(l, async () => { await post.leave(); closeSheet(); after(); toast('그룹에서 나왔습니다. 주고받은 편지도 지웠습니다.'); });
  });
  $('#fGroup').addEventListener('click', async e => {
    const b = e.target.closest('[data-fg]'); if (!b) return;
    if (b.dataset.fg === 'copy'){
      try { await navigator.clipboard.writeText(`Ink & Owl 그룹 코드: ${post.code()}`); toast('코드를 복사했습니다. 친구에게 붙여 넣어 보내세요.'); }
      catch (err){ toast(`그룹 코드: <b>${esc(post.code())}</b>`, 4000, true); }
    } else if (b.dataset.fg === 'leave'){
      openSheet(`<div class="sh-kind"><span>친구 그룹</span></div><h2 class="sh-expr" id="shTitle">이 그룹에서 나갈까요?</h2>` +
        `<p class="w-lead">나가면 이 폰의 친구 편지가 모두 지워지고, 친구들의 폰에서도 나와 주고받은 편지가 사라집니다. 같은 코드로 다시 들어올 수 있지만, 도장은 그때 다시 골라야 합니다.</p>` +
        `<button type="button" class="sh-drill" data-leave>나가기</button>`);
    }
  });
}
