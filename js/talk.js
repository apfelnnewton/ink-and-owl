/* A talk with someone who is not a professor, in the frame of a tea (letters.js): they speak, the learner chooses one of
   three replies, they answer; three exchanges, then a closing line. The bond keeps the result (bond.finishTea) and the
   journal in the guest room writes it down. Used in the drawing room (manor.js); the fireside keeps its own (fire.js).
   makeTalk(section, deckId, words) → start(onDone): words = {label, noted, close} */
import * as bond from './bond.js';
import {hint} from './hints.js';
import {order} from './letters.js';
import {$, esc, openSheet} from './ui.js';

export function makeTalk(sec, id, words){
  let tea = null, turn = 0, score = 0, picks = [], done = null;
  const f = s => esc(bond.fill(s)), attr = 'data-talk-' + id;
  const say = t => `<div class="tea-say"><p class="en" lang="en">${f(t.en)}</p><p class="ko">${f(t.ko)}</p></div>`;
  function ask(before){
    const tn = tea.turns[turn];
    openSheet(`<div class="sh-kind"><span>${words.label} · ${turn + 1} / ${tea.turns.length}</span></div>` +
      `<h2 class="sh-expr" id="shTitle" lang="en">${esc(tea.title.en)}</h2>${turn === 0 ? `<p class="tea-scene">${esc(tea.scene.ko)}</p>` : ''}` + before + say(tn.prof) +
      `<div class="tea-opts">${order(tea.id + '|' + turn, tn.options.length).map(i => { const o = tn.options[i]; return `<button type="button" ${attr}="${i}"><span lang="en">${f(o.en)}</span><small>${f(o.ko)}</small></button>`; }).join('')}</div>`);
  }
  function pick(i){
    const o = tea.turns[turn].options[i]; if (!o) return;
    score += o.delta | 0; picks.push(i);
    const said = `<div class="tea-me"><p class="en" lang="en">${f(o.en)}</p></div>` + say(o.reply);
    turn++;
    if (turn < tea.turns.length){ ask(said); return; }
    bond.finishTea(id, tea, score, picks);
    openSheet(`<div class="sh-kind"><span>${words.label}</span></div><h2 class="sh-expr" id="shTitle" lang="en">${esc(tea.title.en)}</h2>${said}` +
      `<div class="tea-say close"><p class="en" lang="en">${f(tea.close.en)}</p><p class="ko">${f(tea.close.ko)}</p></div>` +
      `<p class="tea-noted">${words.noted}</p><button type="button" class="sh-drill" data-close>${words.close}</button>`);
    tea = null;
    if (done) done();
  }
  $('#sheetBody').addEventListener('click', e => { if (sec.hidden || !tea) return; const b = e.target.closest(`[${attr}]`); if (b) pick(+b.getAttribute(attr)); });
  return {
    running: () => !!tea,
    start(onDone){
      if (!bond.teaReady(id)) return;
      /* the first talk ever: Dumbledore's note on answers and tastes, then the talk */
      hint('tea', () => { tea = bond.teaReady(id); if (!tea || sec.hidden) return; turn = 0; score = 0; picks = []; done = onDone; ask(''); });
    }
  };
}
