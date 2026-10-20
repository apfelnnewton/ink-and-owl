/* Example-sentence questions (2026-10-20 user, after "So, ___ Nolan, …" with Mrs · Madam · I thought I'd just · Blasted):
   ① a form of address is not asked — the example of "Mr Potter" asked Mrs or Madam (both say the same) and never the point of the
     expression (no full stop after Mr); the expression stays in the notebook, its examples to read;
   ② the choices borrowed from other expressions must fit the same place in the sentence, so that grammar alone does not give the
     answer away ("I thought I'd just" before a surname). Used by the manor's example work (copywork.js), the notebook's example
     practice (notes.js), the Room of Requirement (need.js) and the printable sheet. */

/* ---------- ① forms of address */
const ADDRESS = /^(?:(?:the|my|our|dear|young|good|old|her|his|your)\s+)*(?:mr|mrs|miss|ms|madam|ma'am|sir|professor|master|mister|lord|lady|ladyship|lordship|honour|headmaster|headmistress|minister|dr|doctor|boy|girl|fellow|lad|dear|darling|friend)\b/i;
/* kinds that are an address and nothing else (a surname alone, "My dear boy", "my dear"): every example goes */
const PURE = /^호칭(\([^)]*\))?(·(모욕|비꼬기|고어|반어|BrE 어휘))?$/;
export function askable(kind, it, slot){
  if (!it || !it.blank) return false;
  if ((slot || it.slot) === 'ADDR') return false;                    // the gap's role is labelled an address ("Mrs" Nolan, "my lord")
  const k = String(kind || '');
  if (!/호칭/.test(k) || /서약/.test(k)) return true;                 // an oath with a name in it is about the oath
  if (PURE.test(k)) return false;
  return !ADDRESS.test(it.blank.trim()) && !/^[A-Z][a-z'-]+$/.test(it.blank.trim());   // mixed kinds: keep the gaps that are the real point ("Good evening", "excuse me")
}

/* ---------- ② the place a phrase fills, from its first word and its form */
const SETS = {
  prep: 'about above across after against along among around as at before behind below beneath beside besides between beyond by despite during for from in inside into like near of off on onto out outside over past per since than through throughout till to toward towards under underneath unlike until up upon via with within without',
  det: 'a an the this that these those my your his her its our their no every each some any another such what whatever which whose',
  subj: "i you he she we they it there i'd i'll i'm i've you'd you'll you're you've he'd he'll he's she'd she'll she's we'd we'll we're we've they'd they'll they're they've it's it'll there's",
  modal: "would could should might may must shall will can wouldn't couldn't shouldn't mightn't mustn't shan't won't can't cannot ought",
  aux: "am is are was were be been being have has had having do does did isn't aren't wasn't weren't haven't hasn't hadn't don't doesn't didn't",
  conj: 'and but or nor so yet if unless though although because whereas while whilst once lest whether',
  wh: 'how why when where who whom',
  neg: 'not never hardly scarcely barely seldom rarely',
  pron: 'me him us them myself yourself himself herself itself ourselves yourselves themselves one',
  excl: 'oh ah well good dear indeed really heavens goodness alas'
};
const IN = Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, new Set(v.split(' '))]));
const words = s => String(s).toLowerCase().replace(/[.,;:!?"]+/g, ' ').trim().split(/\s+/).filter(Boolean);
export function placeOf(blank){
  const w = words(blank); if (!w.length) return 'none';
  const a = w[0], n = w.length;
  head = Object.keys(IN).find(k => IN[k].has(a));
  if (!head){
    if (a === 'to' || IN.prep.has(a)) head = 'prep';
    else if (/ly$/.test(a) && a.length > 4) head = 'adv';
    else if (/ing$/.test(a) && a.length > 4) head = 'ing';
    else if (/ed$/.test(a) && a.length > 4) head = 'ed';
    else if (/(tion|sion|ment|ness|ity|ence|ance|ship|hood|dom)s?$/.test(a)) head = 'noun';
    else if (/(ous|ful|ive|able|ible|less|ish|ic|al)$/.test(a) && n === 1) head = 'adj';
    else head = 'word';
  }
  if (a === 'to' && n > 1 && !IN.det.has(w[1]) && !IN.pron.has(w[1])) head = 'toinf';   // "to delegate" (an infinitive), not "to the council"
  return head + ':' + (n === 1 ? 1 : n === 2 ? 2 : 3);
}
/* two places that could stand for each other: the same kind of first word and about the same length;
   a plain content word ('word') only with another plain word of the same length */
export function samePlace(a, b){
  if (a[0] === '#' || b[0] === '#') return a === b;   // labelled roles (slotOf) only match each other exactly
  const [ha, na] = a.split(':'), [hb, nb] = b.split(':');
  if (ha !== hb) return false;
  return ha === 'word' || ha === 'adj' || ha === 'noun' ? na === nb : Math.abs(+na - +nb) <= 1;
}
/* With the role labelled for the expression (practice/<deck>-examples.json "slot", 2026-10-20 — docs/newfaces-work/SLOTS.md):
   N noun phrase · V verb phrase · AUX auxiliaries before a verb · ADJ · ADV · LINK connector · CL clause frame · DISC interjection ·
   ADDR address. A verb phrase also keeps its form (-ing, -ed, -s, plain); a noun phrase whether it starts with an article;
   adjectives and adverbs about their length. Without a label, the first-word guess (placeOf). */
/* irregular past forms and participles (not the ones spelt like the plain form: put, set, read …) count with -ed ("found its way into" is not "escort"); forms of be stand apart from
   do / have / modals ("do not ___ lightly" takes "do so", never "is indeed"); a verb gap that opens with a subject is not a verb
   phrase to swap ("we do not take" after "waited for him to") */
const PAST = new Set(('arose awoke was were bore beat became began bent bound bit bled blew broke bred brought built burnt bought ' +
  'caught chose clung came crept dealt dug did drew dreamt drank drove ate fell fed felt fought found fled flung flew forbade forgot ' +
  'forgave froze got gave went ground grew hung had heard hid held kept knelt knew laid led leant leapt learnt left lent lit ' +
  'lost made meant met paid rode rang rose ran said saw sought sold sent shook shone shot showed sang sank sat slept ' +
  'slid spoke spent spilt spat sprang stood stole stuck stung stank struck swore swept swam swung took taught tore told thought ' +
  'threw understood woke wore wept won wound wrote been born done gone seen taken given known shown written spoken broken chosen forgotten ' +
  'fallen frozen hidden ridden risen shaken stolen sworn torn worn woken eaten beaten bitten driven forgiven grown thrown drawn flown').split(' '));
const BE = new Set("am is are was were be been being isn't aren't wasn't weren't".split(' '));
const NUM = new Set('all both half one two three four five six seven eight nine ten eleven twelve twenty hundred thousand several many much few'.split(' '));
/* "have" and "do" are helpers only before a participle / a negative ("haven't come", "did not"); otherwise main verbs
   ("have everyone's attention", "do so"); "need" is not a past form */
const NOT_ED = new Set('need feed bleed breed speed proceed succeed exceed heed weed seed indeed shed wed bed red'.split(' '));
const NOT_ING = new Set('bring sing ring sting swing spring fling cling wring king thing'.split(' '));
const HAVE = {have: 'base', has: 's', had: 'ed', having: 'ing'}, DO = {do: 'base', does: 's', did: 'ed', doing: 'ing'};
function verbForm(w){
  const a = w[0] || '', b = w[1] || '';
  if (IN.subj.has(a)) return 'subj';
  if (BE.has(a)) return 'be';
  if (HAVE[a]) return b === 'to' || b === 'got' || PAST.has(b) || (/ed$/.test(b) && !NOT_ED.has(b)) ? 'aux' : HAVE[a];
  if (DO[a]) return b === 'not' || b === 'never' ? 'aux' : DO[a];
  if (IN.aux.has(a) || IN.modal.has(a)) return 'aux';
  if (PAST.has(a) || (/ed$/.test(a) && !NOT_ED.has(a))) return 'ed';
  if (/ing$/.test(a) && a.length > 4 && !NOT_ING.has(a)) return 'ing';
  return /[^s]s$/.test(a) ? 's' : 'base';
}
export function slotOf(blank, slot){
  if (!slot) return placeOf(blank);
  const w = words(blank), a = w[0] || '', n = w.length;
  if (slot === 'V') return '#V:' + verbForm(w);
  if (slot === 'N') return '#N:' + (IN.det.has(a) || NUM.has(a) ? 'det' : 'bare');
  if (slot === 'ADJ' || slot === 'ADV') return '#' + slot + ':' + (n === 1 ? 1 : 2);
  return '#' + slot;
}

/* the four choices: the answer, one near miss of its form (written with the example), and two other expressions learnt that fit
   the same place — from the groups in order (a day's own expressions first, then the rest), each in a form one of its examples
   uses, in the answer's first-letter case. If too few fit, the near misses written with the example fill the rest. */
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export function choices(it, groups){
  const low = s => s.toLowerCase().trim(), taken = new Set([low(it.blank)]);
  const near = shuffle(it.options || []).find(o => !taken.has(low(o))); if (near) taken.add(low(near));
  const out = [it.blank, ...(near ? [near] : [])];
  const cap = /^[A-Z]/.test(it.blank), fit = b => cap ? b[0].toUpperCase() + b.slice(1) : /^[A-Z]/.test(b) ? '' : b;
  const here = slotOf(it.blank, it.slot);
  for (const group of groups){
    for (const e of shuffle(group)){
      if (out.length >= 4) break;
      const f = shuffle(e.items).filter(x => askable(e.kind, x)).map(x => fit(x.blank)).find(b => b && !taken.has(low(b)) && samePlace(here, slotOf(b, e.slot)));
      if (f){ out.push(f); taken.add(low(f)); }
    }
    if (out.length >= 4) break;
  }
  for (const o of it.options || []) if (out.length < 4 && !taken.has(low(o))){ out.push(o); taken.add(low(o)); }
  return shuffle(out);
}

/* ---------- after the answer: the expression in red; a tap unfolds its explanation in place (2026-10-20 user) — the round stays
   where it is (a new sheet would replace the question). Used by copywork.js and notes.js */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export function exprLine(expr, by, note){
  const label = `<span lang="en">${esc(expr)}</span>${by ? ` · ${esc(by)}` : ''}`;
  if (!note) return `<p class="dr-expr" hidden>${label}</p>`;   // nothing to unfold: not a button
  return `<button type="button" class="dr-expr" data-drnote="1" aria-expanded="false" hidden>${label} <small>설명 보기</small></button><p class="dr-note" hidden>${esc(note)}</p>`;
}
export function toggleNote(btn){
  const n = btn.nextElementSibling; if (!n || !n.classList.contains('dr-note')) return;
  n.hidden = !n.hidden; btn.setAttribute('aria-expanded', String(!n.hidden));
  const sm = btn.querySelector('small'); if (sm) sm.textContent = n.hidden ? '설명 보기' : '접기';
}
