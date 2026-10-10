/* Has this expression been used in a piece of English writing? (2026-10-09 user decision, for the friends' letters:
   friends.js suggests two or three learnt expressions while a letter is written and lights each one as it appears;
   a letter received has the expressions it uses underlined.) Everything is decided on the phone by comparing words —
   no server, no judging of meaning: it can tell that the words are there, not that they are used well.

   An expression from the decks (card.bre[k].expr) is often a pattern rather than a phrase — "I assure you (that) ...",
   "keep ... in mind", "try and + 동사", "practise (동사) / practice (명사)" — so it is first turned into fixed pieces:
   Korean and "+" labels dropped, an English bracket made optional (dropped), "/" read as alternatives, and "...", "~",
   X, sb, one's and the like read as gaps. A piece matches by word stems (takes / took / taking = take), the pieces
   in order with at most GAP words between. Expressions that are only grammar or a name (address forms, tag
   questions, uncontracted forms, American contrasts) and those made of nothing but everyday words are left out. */

const IRREG = {};
('be:am,is,are,was,were,been,being|have:has,had,having|do:does,did,done,doing|go:goes,went,gone,going|take:took,taken|give:gave,given|' +
  'make:made|say:said|see:saw,seen|come:came|know:knew,known|think:thought|tell:told|find:found|get:got,gotten|keep:kept|leave:left|' +
  'mean:meant|bring:brought|hold:held|stand:stood|speak:spoke,spoken|write:wrote,written|run:ran|fall:fell,fallen|feel:felt|hear:heard|' +
  'lose:lost|meet:met|pay:paid|send:sent|sit:sat|teach:taught|understand:understood|break:broke,broken|choose:chose,chosen|' +
  'forget:forgot,forgotten|begin:began,begun|catch:caught|buy:bought|wear:wore,worn|draw:drew,drawn|rise:rose,risen|swear:swore,sworn|' +
  'bear:bore,borne|seek:sought|lead:led|lie:lay,lain|lay:laid|set:set|put:put|let:let|shall:should|will:would|can:could|may:might|' +
  'forbid:forbade,forbidden|bid:bade,bidden|strike:struck|throw:threw,thrown|grow:grew,grown|show:shown|spend:spent|win:won|sell:sold|' +
  'drive:drove,driven|ride:rode,ridden|fly:flew,flown|beat:beaten|bite:bit,bitten|hide:hid,hidden|shake:shook,shaken|steal:stole,stolen')
  .split('|').forEach(g => { const [base, forms] = g.split(':'); forms.split(',').forEach(f => { IRREG[f] = base; }); });

/* everyday words: an expression made only of these says nothing by being found */
const STOP = new Set(('a an the i you he she it we they me him her us them my your his its our their this that these those there here who whom whose which what ' +
  'when where why how and or but if so as than then of in on at to for from with by about into over under up down out off not no nor ' +
  'be have do will shall can may must go come get make take say see know think want need like just very too more most much many some any ' +
  'all one two now well yes oh ah please mr mrs miss sir professor').split(' ').map(w => stem(w)));   // as stems, like everything compared here

/* single words taught as expressions but too ordinary to point out in someone's letter (compared as stems) */
const PLAIN = 'however actually naturally provide consider perhaps certainly surely really concern holiday excellent exactly obviously clearly precisely possibly probably quickly careful carefully remember another nothing something everyone anything rather indeed quite bright sorry right'.split(' ');
let plainSet = null;
const plain = () => plainSet || (plainSet = new Set(PLAIN.map(stem)));
const APOS = /[’‘`]/g;
/* words with where they stand: [{w: stem, raw, s, e}] */
export function words(text){
  const out = [], t = String(text || '').replace(APOS, "'"), re = /[A-Za-z]+(?:'[A-Za-z]+)*/g;
  let m;
  while ((m = re.exec(t))) out.push({w: stem(m[0]), raw: m[0], s: m.index, e: m.index + m[0].length});
  return out;
}
export function stem(word){
  let w = word.toLowerCase().replace(/'s$/, '');
  if (IRREG[w]) w = IRREG[w];   // took → take, then cut down like any other word (take → tak)
  if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 4 && /ied$/.test(w)) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
  if (w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|ff)$/.test(w)) w = w.slice(0, -1);   // stopp → stop
  if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);   // hope, hoped, hoping → hop
  return w.replace(/is(e|ation)?$/, 'iz$1').replace(/our$/, 'or');   // realise / realize, honour / honor
}

const SKIP_KIND = /호칭|부가의문|축약|AmE|철자|주어 생략|생략 의문|감탄사|조어/;
const HOLE = /\.{2,}|…|~|\b(?:one's|oneself|someone|somebody|something|sb|sth|X's|X|A|B)\b/g;
const GAP = 6;

/* an expression → its alternatives, each a list of pieces (lists of stems); null when it is not worth looking for */
export function pattern(expr, kind = ''){
  if (SKIP_KIND.test(kind)) return null;
  let e = String(expr || '').replace(APOS, "'");
  e = e.replace(/\([^)]*[가-힣:][^)]*\)/g, ' ')        // (축약 회피), (BrE: have got)
    .replace(/\(\s*\+?[^)]*\)/g, ' ... ')                // (that), (so), (someone): optional or open — a gap that may be empty
    .replace(/\+\s*[^/]*$/, ' ').replace(/\+/g, ' ')     // "+ 동사원형" to the end
    .replace(/[가-힣]+/g, ' ');
  const alts = e.split(/\s\/\s|\/(?=\s)|(?<=\s)\//).map(a => a.split(HOLE).map(p => words(p).map(x => x.w)).filter(p => p.length)).filter(a => a.length);
  const good = alts.filter(a => { const flat = a.flat(), content = flat.filter(w => !STOP.has(w));
    return content.length && (flat.length >= 2 || flat[0].length >= 5); });
  return good.length ? good : null;
}
export const size = pat => Math.max(...pat.map(a => a.flat().length));

function at(ws, i, piece){ for (let k = 0; k < piece.length; k++) if (!ws[i + k] || ws[i + k].w !== piece[k]) return false; return true; }
/* where the expression stands in the words: {s, e} character range of its first use, or null */
export function find(ws, pat){
  let best = null;
  for (const alt of pat){
    for (let i = 0; i + alt[0].length <= ws.length; i++){
      if (!at(ws, i, alt[0])) continue;
      let end = i + alt[0].length, ok = true;
      for (let p = 1; p < alt.length && ok; p++){
        let j = end, hit = -1;
        for (; j <= end + GAP && j + alt[p].length <= ws.length; j++) if (at(ws, j, alt[p])){ hit = j; break; }
        if (hit < 0) ok = false; else end = hit + alt[p].length;
      }
      if (ok){ const r = {s: ws[i].s, e: ws[end - 1].e}; if (!best || r.s < best.s) best = r; break; }
    }
  }
  return best;
}
export const used = (text, pat) => !!find(words(text), pat);

/* ---------- every expression of every deck that can be looked for (built once from the loaded decks) */
let INDEX = null;
export function index(app, decks){
  if (INDEX && INDEX.n === decks.filter(d => app.data[d.id]).length) return INDEX.list;
  const seen = new Set(), list = [];
  for (const d of decks){
    for (const c of app.data[d.id] || []){
      if (c.card === false) continue;
      (c.bre || []).forEach((b, k) => {
        const pat = pattern(b.expr, b.kind); if (!pat) return;
        const id = pat.map(a => a.map(p => p.join(' ')).join(' … ')).join(' / '); if (seen.has(id)) return;
        seen.add(id);
        list.push({key: `${c.id}#${k}`, deck: d.id, card: c, b, pat, n: size(pat)});
      });
    }
  }
  INDEX = {n: decks.filter(d => app.data[d.id]).length, list};
  return list;
}
/* the expressions a text uses, longest first, none overlapping another — for underlining a letter that has arrived */
export function spot(text, list, max = 6){
  const ws = words(text), hits = [];
  for (const x of list){
    if (x.n < 2 && (x.pat[0][0][0].length < 6 || plain().has(x.pat[0][0][0]))) continue;   // a lone short or everyday word is too slight to point at
    const r = find(ws, x.pat); if (r) hits.push({...r, x});
  }
  hits.sort((a, b) => (b.x.n - a.x.n) || (b.e - b.s) - (a.e - a.s));
  const kept = [];
  for (const h of hits){ if (kept.length >= max) break; if (!kept.some(k => h.s < k.e && k.s < h.e)) kept.push(h); }
  return kept.sort((a, b) => a.s - b.s);
}
