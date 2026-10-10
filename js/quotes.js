/* Quotation marks on the page (2026-10-10). The decks, letters and notes are written with the plain typewriter marks
   ' and ", and the English display face (IM Fell English) draws both as closing curls — so "I will not tell lies"
   showed as ”I will not tell lies”, and a line already inside the app's own “ ” ended up with marks back to front.
   Nothing in the data is changed (data/ is read-only, and answers are compared as typed): only what is shown is.
   Every piece of text put on the page has its plain marks turned into the proper curled ones — “ ” ‘ ’ and ’ for
   an apostrophe — by smart(), and one observer does it for the whole page, so no screen has to remember to.
   Attributes (data-say, data-opt …), inputs and textareas are never touched. */

/* words that begin with an apostrophe, not an opening quote: 'em, 'tis, 'Bout time, 'Arry … */
const ELIDED = /^(em|tis|twas|twere|til|till|cause|cos|bout|round|neath|ere|ello|arry|orace|agrid|ermione|ogwarts|ogsmeade|n)(?![A-Za-z])/i;
/* the tail of a contraction whose first half sits in another piece of markup: people<u>'s</u> */
const TAIL = /^(s|d|ll|ve|re|m|t)(?![A-Za-z])/i;
const OPENER = /[\s(\[{—–\-/“‘]/;   // what may stand just before an opening mark

export function smart(text){
  if (text.indexOf("'") < 0 && text.indexOf('"') < 0) return text;
  let out = '';
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (ch !== "'" && ch !== '"'){ out += ch; continue; }
    const prev = i ? text[i - 1] : '', next = text[i + 1] || '';
    const opens = (!prev || OPENER.test(prev)) && next && !/\s/.test(next);
    if (ch === '"'){ out += opens ? '“' : '”'; continue; }
    /* a single mark: an apostrophe inside or after a word, before a figure ('80s) or a clipped word ('em); else it opens */
    const rest = text.slice(i + 1);
    if (opens && !/\d/.test(next) && !ELIDED.test(rest) && !(i === 0 && TAIL.test(rest))) out += '‘';
    else out += '’';
  }
  return out;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE']);
function fix(node){
  if (node.nodeType === 3){
    const p = node.parentNode; if (!p || SKIP.has(p.nodeName)) return;
    const v = node.nodeValue; if (v.indexOf("'") < 0 && v.indexOf('"') < 0) return;
    const s = smart(v); if (s !== v) node.nodeValue = s;
  } else if (node.nodeType === 1 && !SKIP.has(node.nodeName)){
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let t; const list = [];
    while ((t = w.nextNode())) list.push(t);
    list.forEach(fix);
  }
}
/* watch the whole page: whatever is drawn, now or later */
export function install(root = document.body){
  fix(root);
  new MutationObserver(ms => { for (const m of ms){
    if (m.type === 'characterData') fix(m.target);
    else m.addedNodes.forEach(fix);
  } }).observe(root, {childList: true, subtree: true, characterData: true});
}
