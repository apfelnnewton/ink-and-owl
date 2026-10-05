/* The learner's wand (2026-10-05 user decision, docs/plan-wand.md). Made once at Ollivander's (ollivander.js) from five
   answers: Q1 → core, Q2 × Q3 → one of nine woods, Q4 → length range, Q5 → flexibility. It can be made again from
   the wand box in my room; later, once spells exist, a new wand must first pass a short test of the spells learnt.
   state.wand = {note: date the owl brought Ollivander's note, wood, core, len, flex, d: date made, old: [earlier wands]}
   Also here: the words of the shop, the result card, the professors' letters about the wood (bond.js posts them the
   day after), and the small sparks a right answer makes in the classroom, coloured by the core. */
import * as store from './store.js';
import * as srs from './srs.js';

export const WOODS = {
  fir:    {en: 'Fir', ko: '전나무'},
  oak:    {en: 'English oak', ko: '영국 참나무'},
  cypress:{en: 'Cypress', ko: '사이프러스'},
  rowan:  {en: 'Rowan', ko: '마가목'},
  willow: {en: 'Willow', ko: '버드나무'},
  cedar:  {en: 'Cedar', ko: '시더'},
  walnut: {en: 'Walnut', ko: '호두나무'},
  larch:  {en: 'Larch', ko: '낙엽송'},
  hazel:  {en: 'Hazel', ko: '개암나무'}
};
/* Q2 (key / knock / another way) × Q3 (library / lake / friends) */
const GRID = [['fir', 'oak', 'cypress'], ['rowan', 'willow', 'cedar'], ['walnut', 'larch', 'hazel']];
export const CORES = {
  unicorn: {en: 'unicorn hair', ko: '유니콘 털', spark: '#E4ECF4'},
  dragon:  {en: 'dragon heartstring', ko: '용의 심금', spark: '#F0583E'},
  phoenix: {en: 'phoenix feather', ko: '불사조 깃털', spark: '#F4C55A'}
};
const CORE_OF = ['unicorn', 'dragon', 'phoenix'];
/* Q5: two words each; which one is the learner's comes from their name */
export const FLEX = {
  a: [{en: 'unyielding', ko: '단단함'}, {en: 'rather rigid', ko: '꽤 뻣뻣함'}],
  b: [{en: 'slightly yielding', ko: '조금 휘어짐'}, {en: 'fairly flexible', ko: '꽤 유연함'}],
  c: [{en: 'reasonably supple', ko: '적당히 유연함'}, {en: 'quite pliant', ko: '잘 휘어짐'}]
};
/* Q4: quarter-inch steps within each range */
const LENGTHS = [[9.25, 10.75], [11, 12.5], [12.75, 14.25]];

/* ---------- the shop's words */
export const NOTE = {
  en: 'I understand you have begun your studies. A student without a wand is, if you will forgive me, rather like a quill without ink. Do call at the shop at your earliest convenience.',
  ko: '공부를 시작했다고 들었습니다. 이런 말을 용서하신다면, 지팡이 없는 학생은 잉크 없는 깃펜과 같지요. 편하실 때 가게에 들러 주십시오.',
  sign: 'G. Ollivander'
};
export const LINES = {
  hello: {en: 'Ah. I wondered when you would come. Before I fetch a single box, I must ask you a few questions. Answer honestly — the wands will know if you do not.',
    ko: '아. 언제 오시나 했습니다. 상자를 하나라도 꺼내기 전에 몇 가지 여쭤야겠군요. 솔직하게 답하십시오. 그러지 않으면 지팡이들이 압니다.'},
  again: {en: 'Back so soon? A new wand must learn your hand afresh, and every spell with it. Are you quite sure?',
    ko: '벌써 다시 오셨군요? 새 지팡이는 당신 손을 처음부터 다시 익혀야 합니다. 주문도 전부요. 정말 괜찮으시겠습니까?'},
  try1: {en: 'Try this one. Maple and dragon heartstring, ten inches. Give it a wave.',
    ko: '이걸 쥐어 보십시오. 단풍나무에 용의 심금, 10인치. 한번 휘둘러 보세요.'},
  no1: {en: 'No, no. Most decidedly not.', ko: '아니, 아니. 절대로 아니군요.'},
  try2: {en: 'Then perhaps this one.', ko: '그렇다면 이것을.'},
  curious: {en: 'Ah. Now that is curious. Say it with me: Lumos.', ko: '아. 이거 흥미롭군요. 저를 따라 말해 보십시오. 루모스.'},
  chose: {en: 'There. You did not choose it, you understand. It chose you, and in my experience, wands are seldom wrong.',
    ko: '됐습니다. 아시겠지만, 당신이 고른 게 아닙니다. 지팡이가 당신을 고른 거지요. 제 경험상 지팡이는 좀처럼 틀리지 않습니다.'}
};
export const QUESTIONS = [
  {en: 'Tell me — which would you rather be remembered for?', ko: '말해 보십시오. 무엇으로 기억되고 싶습니까?', options: [
    {en: 'Never once breaking my word.', ko: '한 번도 약속을 어기지 않은 사람으로요.', re: {en: 'Constancy. A rarer gift than people suppose.', ko: '한결같음이라. 사람들 생각보다 귀한 재능이지요.'}},
    {en: 'Daring to do what others would not.', ko: '남들이 못 하는 일을 해낸 사람으로요.', re: {en: 'Boldness. I shall have to choose carefully, then.', ko: '대담함이라. 그렇다면 신중하게 골라야겠군요.'}},
    {en: 'Noticing what everyone else had missed.', ko: '남들이 다 놓친 걸 알아챈 사람으로요.', re: {en: 'Ah. An observer. Those are the interesting ones.', ko: '아. 관찰하는 쪽이군요. 그런 분들이 흥미롭지요.'}}]},
  {en: 'A locked door stands between you and something you need. What do you do?', ko: '필요한 것과 당신 사이에 잠긴 문이 있습니다. 어떻게 하겠습니까?', options: [
    {en: 'Look for the key. There is always a key.', ko: '열쇠를 찾아요. 열쇠는 어딘가 꼭 있으니까요.', re: {en: 'Patience. Sorely underrated.', ko: '인내라. 지나치게 과소평가되는 덕목이지요.'}},
    {en: 'Knock, and ask politely to be let in.', ko: '문을 두드리고 들여보내 달라고 정중히 부탁해요.', re: {en: 'Courtesy opens more doors than charms do.', ko: '예의는 주문보다 더 많은 문을 엽니다.'}},
    {en: 'Find another way round. Doors are not the only way in.', ko: '돌아갈 길을 찾아요. 문만 입구는 아니니까요.', re: {en: 'Hm. I shall keep an eye on my windows.', ko: '흠. 제 가게 창문을 잘 지켜봐야겠군요.'}}]},
  {en: 'It is a free afternoon, and the castle is yours. Where shall I find you?', ko: '한가한 오후, 성 전체가 당신 것입니다. 어디에 가면 당신을 찾을 수 있겠습니까?', options: [
    {en: 'In the library, somewhere near the back.', ko: '도서관이요, 안쪽 구석 어딘가에요.', re: {en: 'Quiet places keep good company.', ko: '조용한 곳에는 좋은 벗이 있지요.'}},
    {en: 'Out by the lake, whatever the weather.', ko: '호숫가요, 날씨가 어떻든요.', re: {en: 'Whatever the weather. Spoken like a true islander.', ko: '날씨가 어떻든이라. 섬사람다운 말씀이군요.'}},
    {en: 'Wherever my friends happen to be.', ko: '친구들이 있는 곳이면 어디든요.', re: {en: 'Then the wand must be generous, too.', ko: '그렇다면 지팡이도 너그러워야겠군요.'}}]},
  {en: 'You walk into a room full of strangers. What happens next?', ko: '낯선 사람으로 가득한 방에 들어갑니다. 그다음엔 어떻게 됩니까?', options: [
    {en: 'I find a quiet corner and watch for a while.', ko: '조용한 구석을 찾아 한동안 지켜봐요.', re: {en: 'Watching first. Very wise.', ko: '먼저 지켜본다. 아주 현명하군요.'}},
    {en: 'I look for one face that seems kind.', ko: '친절해 보이는 얼굴 하나를 찾아요.', re: {en: 'One kind face is usually enough.', ko: '친절한 얼굴 하나면 대개 충분하지요.'}},
    {en: 'I introduce myself before I have taken off my coat.', ko: '외투를 벗기도 전에 제 소개부터 해요.', re: {en: 'Ha! Then you will want a little reach.', ko: '하! 그렇다면 조금 긴 쪽이 좋겠군요.'}}]},
  {en: 'Your plans for the day fall apart before breakfast. How do you take it?', ko: '하루 계획이 아침 먹기도 전에 무너졌습니다. 어떻게 받아들입니까?', options: [
    {en: 'Badly, I confess. I like things as I arranged them.', ko: '솔직히 잘 못 받아들여요. 정해 둔 대로가 좋거든요.', re: {en: 'Firm. There is no shame in firm.', ko: '단단하군요. 단단한 건 부끄러운 게 아닙니다.'}},
    {en: 'I grumble, and then I make new plans.', ko: '투덜대고 나서 새 계획을 세워요.', re: {en: 'The most sensible answer I have heard all week.', ko: '이번 주에 들은 대답 중 가장 분별 있군요.'}},
    {en: 'Rather well. Unplanned days are often the best.', ko: '꽤 잘 받아들여요. 계획 없는 날이 오히려 좋을 때가 많거든요.', re: {en: 'Supple. Good. Wands of that sort forgive a great deal.', ko: '유연하군요. 좋습니다. 그런 지팡이는 많은 걸 용서하지요.'}}]}
];

/* ---------- the result card: [[words|key]] marks an expression that opens its meaning when tapped */
export const SAYS = {
  fir: {en: 'Fir does not [[care for]] the easily distracted; it will serve you best on the days when everyone else has given up.',
    ko: '전나무는 쉽게 한눈파는 사람을 좋아하지 않습니다. 남들이 다 포기한 날에 가장 잘 따라 줄 겁니다.',
    aside: {en: 'I sold fir to a young witch once. She teaches Transfiguration now, and I gather she has yet to lose an argument.',
      ko: '전에 한 젊은 마녀에게 전나무를 판 적이 있지요. 지금은 변신술을 가르치는데, 아직 말싸움에서 져 본 적이 없다더군요.'}},
  oak: {en: 'English oak is a [[fair-weather friend]] to no one; it asks for a steady hand, and in return it will see you through any storm.',
    ko: '영국 참나무는 좋을 때만 곁에 있는 친구가 아닙니다. 흔들리지 않는 손을 원하고, 그 대가로 어떤 폭풍도 함께 견뎌 줄 겁니다.'},
  cypress: {en: 'Cypress chooses those who [[would sooner|sooner]] stand behind their friends [[than|sooner]] in front of them, and it never forgets a kindness.',
    ko: '사이프러스는 친구들 앞에 나서기보다 뒤에서 받쳐 주는 쪽을 택하는 사람을 고릅니다. 그리고 받은 친절은 절대 잊지 않지요.',
    aside: {en: 'There was a quiet boy once, cypress and unicorn hair. He became a teacher of Defence, and a rather good one.',
      ko: '전에 조용한 소년이 하나 있었지요. 사이프러스에 유니콘 털. 어둠의 마법 방어술 선생이 되었는데, 꽤 훌륭했습니다.'}},
  rowan: {en: 'Rowan has long been planted by cottage doors to [[keep harm away]]; it suits a clear head and an honest tongue, and it is rather good at shielding charms.',
    ko: '마가목은 오래전부터 해를 막으려고 오두막 문가에 심던 나무지요. 맑은 머리와 정직한 혀에 어울리고, 막는 주문에 꽤 능합니다.'},
  willow: {en: 'Willow grows best by water and bends where other woods would break; it is a wand for healers, and for those who are [[kinder than they let on]].',
    ko: '버드나무는 물가에서 가장 잘 자라고, 다른 나무라면 부러질 곳에서 휘어집니다. 치유하는 사람, 그리고 겉으로 보이는 것보다 다정한 사람의 지팡이지요.'},
  cedar: {en: 'Cedar belongs to those who are [[good judges of character]]; you will rarely be taken in, and the people you keep close are lucky to have you.',
    ko: '시더는 사람 보는 눈이 있는 이에게 갑니다. 당신은 좀처럼 속지 않을 것이고, 당신 곁에 둔 사람들은 운이 좋은 겁니다.',
    aside: {en: 'A cedar wand once went to a young man who went on to collect people the way others collect stamps. He teaches Potions now.',
      ko: '시더 지팡이를 받아 간 청년이 있었는데, 남들이 우표를 모으듯 사람을 모으더군요. 지금은 마법약을 가르칩니다.'}},
  walnut: {en: 'Walnut [[is drawn to]] inventive minds: people who read the instructions only to find out where they might be improved.',
    ko: '호두나무는 창의적인 머리에 끌립니다. 설명서를 읽어도 어디를 고칠 수 있을지 보려고 읽는 사람들이지요.'},
  larch: {en: 'Larch [[tends to]] choose people who are braver than they believe themselves to be, and it has a habit of revealing talents its owner never suspected.',
    ko: '낙엽송은 스스로 생각하는 것보다 용감한 사람을 고르는 경향이 있고, 주인도 몰랐던 재능을 드러내는 버릇이 있습니다.'},
  hazel: {en: 'Hazel is a sensitive wood that takes its mood from its owner, so [[keep good company]] and good humour, and it will find you water in a desert.',
    ko: '개암나무는 예민한 나무라 주인의 기분을 그대로 닮습니다. 좋은 사람들과 좋은 기분을 곁에 두십시오. 그러면 사막에서도 물을 찾아 줄 겁니다.'},
  unicorn: {en: 'Unicorn hair is the most faithful of the cores. It does not change its loyalty lightly, and [[neither|neither]], I suspect, [[do you|neither]].',
    ko: '유니콘 털은 심 가운데 가장 충직합니다. 쉽게 마음을 바꾸지 않지요. 당신도 그렇지 않을까 싶군요.'},
  dragon: {en: 'Dragon heartstring learns quickly and gives a great deal of power, though it will test you [[now and then]] to see whether you deserve it.',
    ko: '용의 심금은 빨리 배우고 큰 힘을 줍니다. 다만 당신이 그럴 자격이 있는지 가끔 시험해 볼 겁니다.'},
  phoenix: {en: 'Phoenix feather is the rarest core I use, and the most particular. It is slow to [[warm to]] anyone, but once it has, it will go further than any other.',
    ko: '불사조 깃털은 제가 쓰는 심 중 가장 귀하고 가장 까다롭습니다. 누구에게든 마음을 여는 데 시간이 걸리지만, 한번 열면 어떤 심보다 멀리 갑니다.'},
  a: {en: '{T}, as you are. Do not ask it to change its mind halfway through a spell.', ko: '당신처럼 단단하군요. 주문 도중에 마음을 바꾸라고 하지는 마십시오.'},
  b: {en: '{T}. It will grumble at a change of plan, and then [[make the best of it]].', ko: '조금 휘어지는군요. 계획이 바뀌면 투덜대겠지만, 그래도 최선을 다할 겁니다.'},
  c: {en: '{T}. It forgives clumsy wrists, and [[rather enjoys]] a surprise.', ko: '꽤 유연하군요. 서툰 손목도 너그럽게 봐주고, 뜻밖의 일을 꽤 즐깁니다.'}
};
export const GLOSS = {
  'care for': {en: 'not care for sth', ko: '~을 좋아하지 않다. care for는 주로 부정문·의문문에서 "좋아하다"라는 뜻으로 쓰는 격식 있는 말.'},
  'fair-weather friend': {en: 'a fair-weather friend', ko: '좋을 때만 곁에 있고 어려울 때는 떠나는 친구.'},
  sooner: {en: 'would sooner A than B', ko: 'B하느니 차라리 A하겠다. would rather보다 조금 예스럽고 영국적인 말.'},
  'keep harm away': {en: 'keep harm away', ko: '해를 막다, 액운을 물리치다.'},
  'kinder than they let on': {en: 'let on', ko: '내색하다, 드러내다. kinder than they let on = 겉으로 드러내는 것보다 더 다정한.'},
  'good judges of character': {en: 'a good judge of character', ko: '사람 보는 눈이 있는 사람.'},
  'is drawn to': {en: 'be drawn to sth', ko: '~에 마음이 끌리다.'},
  'tends to': {en: 'tend to do', ko: '~하는 경향이 있다.'},
  'keep good company': {en: 'keep good company', ko: '좋은 사람들과 어울리다.'},
  neither: {en: 'neither … do you', ko: '앞의 부정문을 받아 "당신도 그렇지 않다". 예: It does not change lightly, and neither do you.'},
  'now and then': {en: 'now and then', ko: '가끔, 이따금.'},
  'warm to': {en: 'warm to sb', ko: '~에게 마음을 열다, 정이 들다.'},
  'make the best of it': {en: 'make the best of it', ko: '(마음에 들지 않는 상황에서도) 그 안에서 최선을 다하다.'},
  'rather enjoys': {en: 'rather', ko: '꽤, 상당히. 영국 영어에서 즐겨 쓰는 부드러운 강조.'}
};

/* ---------- the wand from five answers */
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
export function lengthEn(n){
  const w = Math.floor(n), f = n - w;
  return NUM[w] + (f === .25 ? ' and a quarter' : f === .5 ? ' and a half' : f === .75 ? ' and three-quarter' : '') + ' inches';
}
export const lengthKo = n => { const w = Math.floor(n), f = n - w; return `${w}${f === .25 ? '¼' : f === .5 ? '½' : f === .75 ? '¾' : ''}인치`; };

export function make(ans){
  const st = store.get().settings, who = (st.firstName || '') + '|' + (st.surname || '');
  const [lo, hi] = LENGTHS[ans[3]], steps = Math.round((hi - lo) / .25) + 1;
  return {
    wood: GRID[ans[1]][ans[2]],
    core: CORE_OF[ans[0]],
    len: lo + (hash(who + '|len') % steps) * .25,
    flex: 'abc'[ans[4]] + (hash(who + '|flex') % 2),
    ans: ans.slice()
  };
}
export const flexOf = w => FLEX[w.flex[0]][+w.flex[1] || 0];
export const titleEn = w => `${WOODS[w.wood].en}, ${CORES[w.core].en}, ${lengthEn(w.len)}, ${flexOf(w).en}.`;
export const titleKo = w => `${WOODS[w.wood].ko} · ${CORES[w.core].ko} · ${lengthKo(w.len)} · ${flexOf(w).ko}`;
/* the three sentences (plus Ollivander's aside about a professor, for fir, cypress and cedar) */
export function sayings(w){
  const T = flexOf(w).en, f = SAYS[w.flex[0]];
  return [SAYS[w.wood], SAYS[w.core], {en: f.en.replace('{T}', T[0].toUpperCase() + T.slice(1)), ko: f.ko}];
}

/* ---------- state */
export function get(){ const s = store.get(); return s.wand && s.wand.wood ? s.wand : null; }
export const noteArrived = () => !!(store.get().wand || {}).note;
/* the note comes by owl the day after the first lesson (a lesson on any earlier day), once a name is set */
export function noteDue(){
  const s = store.get(); if (!s.settings.named || (s.wand && (s.wand.note || s.wand.wood))) return false;
  const t = srs.today();
  return Object.keys(s.log || {}).some(d => d < t && Object.keys(s.log[d] || {}).length);
}
export function markNote(){ const s = store.get(); s.wand = {...(s.wand || {}), note: s.wand && s.wand.note || srs.today()}; store.save(); }
export function keep(w){
  const s = store.get(), prev = s.wand || {};
  const old = (prev.old || []).slice();
  if (prev.wood) old.unshift({wood: prev.wood, core: prev.core, len: prev.len, flex: prev.flex, d: prev.d});
  s.wand = {note: prev.note || srs.today(), wood: w.wood, core: w.core, len: w.len, flex: w.flex, ans: w.ans, d: srs.today(), old};
  store.save();
  return s.wand;
}
export const img = wood => `assets/wand/${wood}.webp`;

/* ---------- the professors' letters about the wood, the day after (bond.js posts them as WD-<wood>):
   fir, cypress and cedar are McGonagall's, Lupin's and Slughorn's own woods; if that door is still shut Dumbledore passes
   it on. The other six woods: Dumbledore on the wood itself. */
export const OWNER = {fir: 'mcgonagall', cypress: 'lupin', cedar: 'slughorn'};
export const LETTERS = {
  own: {
    fir: {en: "{name},\nMr Ollivander tells me you left his shop with fir. I am not in the habit of gossiping about wands, but I will say this much: mine is fir too. Nine and a half inches, dragon heartstring, and it has not once let me down, in a duel or in an argument.\nFir is a stubborn wood. It does not do its best work on easy days. It does it on the days when everyone else has gone to bed. Look after it, and it will look after you.\nM. McGonagall",
      ko: "{name},\n올리밴더 씨 말로는 네가 전나무 지팡이를 들고 가게를 나섰다더구나. 지팡이 얘기로 수다 떠는 버릇은 없다만, 이것만은 말해 두마. 내 것도 전나무다. 9½인치에 용의 심금. 결투에서든 말싸움에서든 한 번도 나를 실망시킨 적이 없지.\n전나무는 고집 센 나무다. 쉬운 날엔 제 실력을 다 내지 않아. 다들 잠자리에 든 뒤에야 내지. 잘 돌봐라. 그러면 그 지팡이도 너를 돌봐 줄 거란다.\nM. 맥고나걸"},
    cypress: {en: "Dear {name},\nWord travels quickly in this castle, and I hear you have a cypress wand. I hope you won't think me sentimental if I say that pleased me more than it ought to. Mine is cypress too: ten and a quarter inches, unicorn hair.\nMr Ollivander once told me that cypress belongs to people who would put themselves between their friends and harm. I have never been sure I deserved mine. I suspect you deserve yours.\nR. J. Lupin",
      ko: "{name}에게,\n이 성에선 소문이 빨리 돌지. 네가 사이프러스 지팡이를 받았다고 들었단다. 감상적이라고 생각하지 않았으면 좋겠구나만, 그 얘기가 생각보다 훨씬 기뻤어. 내 것도 사이프러스란다. 10¼인치, 유니콘 털.\n올리밴더 씨가 예전에 그러시더구나. 사이프러스는 친구와 위험 사이에 스스로 서는 사람의 나무라고. 나는 내가 그럴 자격이 있는지 늘 자신이 없었단다. 너는 네 지팡이를 받을 자격이 있을 것 같구나.\nR. J. 루핀"},
    cedar: {en: "My dear {name},\nCedar! Ollivander let it slip. Between ourselves, he is a dreadful gossip over a glass of sherry. Cedar and dragon heartstring, ten and a quarter inches: that is my own wand, and I have never once regretted it.\nThey say cedar goes to people who can see straight through a person. I have always found it a most useful gift at dinner parties. Do come and compare wands one evening. I shall have the crystallised pineapple ready.\nH. E. F. Slughorn",
      ko: "친애하는 {name},\n시더라니! 올리밴더가 슬쩍 흘리더군. 우리끼리 얘기지만, 그 친구는 셰리주 한 잔만 들어가면 소문을 못 참는다네. 시더에 용의 심금, 10¼인치. 바로 내 지팡이일세. 한 번도 후회한 적이 없지.\n시더는 사람 속을 꿰뚫어 보는 이에게 간다더군. 만찬 자리에서 그만큼 쓸모 있는 재주도 없다네. 언제 저녁에 와서 지팡이 자랑이나 나눠 보세. 파인애플 설탕 절임을 준비해 두겠네.\nH. E. F. 슬러그혼"}
  },
  relay: {
    fir: {en: "Dear {name},\nFir! I happen to know that Professor McGonagall carries a fir wand herself, and I have never once seen it, or her, give up on anything. She would tell you so herself, briskly, if you had met. Until then, consider it passed on.\nFir wands are at their best when the hour is late and the task is hard, so you may find it does its finest work on your most difficult days.\nAlbus Dumbledore",
      ko: "{name}에게,\n전나무라니! 마침 맥고나걸 교수도 전나무 지팡이를 지니고 있다네. 그 지팡이도, 그 사람도 무언가를 포기하는 걸 나는 한 번도 본 적이 없지. 만났더라면 그가 직접, 짧고 단호하게 말해 주었을 걸세. 그때까지는 내가 대신 전해 두네.\n전나무 지팡이는 밤이 깊고 일이 어려울 때 가장 빛나니, 자네의 가장 힘든 날에 가장 좋은 솜씨를 보여 줄 걸세.\n알버스 덤블도어"},
    cypress: {en: "Dear {name},\nCypress. Our Professor Lupin carries a cypress wand, and I can think of no one who wears his kindness more quietly. He would be far too modest to tell you so, so I shall.\nWhen you meet him, you might mention your wand. I suspect it would make his day.\nAlbus Dumbledore",
      ko: "{name}에게,\n사이프러스로군. 우리 루핀 교수가 사이프러스 지팡이를 지니고 있다네. 그 사람만큼 친절을 조용히 지니고 다니는 이를 나는 알지 못하네. 너무 겸손해서 스스로는 말하지 않을 테니 내가 대신 말해 두지.\n그를 만나거든 자네 지팡이 얘기를 꺼내 보게. 그의 하루가 환해질 걸세.\n알버스 덤블도어"},
    cedar: {en: "Dear {name},\nCedar! You share it with Professor Slughorn, who will be delighted, and will tell everyone. Cedar wands are said to go to good judges of character, and Horace has been collecting interesting people for longer than you have been alive, at any rate.\nWhen you meet him, expect to be invited to supper.\nAlbus Dumbledore",
      ko: "{name}에게,\n시더라니! 슬러그혼 교수와 같은 나무일세. 그가 알면 무척 기뻐하고, 모두에게 떠들고 다닐 걸세. 시더 지팡이는 사람 보는 눈이 있는 이에게 간다고들 하지. 호러스는 흥미로운 사람들을 모아 온 지가 적어도 자네가 살아온 세월보다는 길다네.\n그를 만나면 저녁 초대를 받을 각오를 하게.\n알버스 덤블도어"}
  },
  wood: {
    oak: {en: "Dear {name},\nAn English oak wand! The oaks of this country have stood through more storms than any of us, and there are oaks in the grounds that were already old when the castle was young. Our gamekeeper carried an oak wand once, though I am not sure he would want me to mention it.\nA wand like yours is not showy. It is simply there when you need it, which, in my experience, is the rarest kind of magic.\nAlbus Dumbledore",
      ko: "{name}에게,\n영국 참나무 지팡이라니! 이 나라의 참나무들은 우리 누구보다 많은 폭풍을 견뎌 왔다네. 이 성 마당에는 성이 아직 젊을 때 이미 늙어 있던 참나무도 있지. 우리 사냥터지기도 한때 참나무 지팡이를 지녔다네. 내가 이 얘길 했다는 걸 그가 반길지는 모르겠네만.\n자네 같은 지팡이는 화려하지 않네. 그저 필요할 때 늘 그 자리에 있지. 내 경험으로는 그게 가장 드문 마법이라네.\n알버스 덤블도어"},
    rowan: {en: "Dear {name},\nRowan! In the villages of this island, people once planted a rowan by the cottage door, and hung a sprig of it over the cradle, to keep ill luck away. Some still do.\nI have always liked that a wood so famous for protection should be so modest to look at. Rowan wands are rarely found on the wrong side of a quarrel. I am glad one has chosen you.\nAlbus Dumbledore",
      ko: "{name}에게,\n마가목이라니! 이 섬의 마을 사람들은 예전에 오두막 문가에 마가목을 심고, 요람 위에 그 잔가지를 매달아 액운을 막았다네. 지금도 그러는 집이 있지.\n지키는 힘으로 그렇게 이름난 나무가 생김새는 그리 수수하다는 게 나는 늘 마음에 들었네. 마가목 지팡이가 다툼의 나쁜 쪽에 서 있는 일은 좀처럼 없다네. 그런 지팡이가 자네를 골랐다니 기쁘군.\n알버스 덤블도어"},
    willow: {en: "Dear {name},\nWillow. There is a rather ill-tempered willow in our grounds, as you may have heard, and it has given willows a worse name than they deserve. Most willows are gentle things that lean over rivers and mend quickly when they are cut. Healers have always been fond of the wood.\nIf yours ever bends when you expected it to stand firm, do not worry. That is simply how willows survive storms.\nAlbus Dumbledore",
      ko: "{name}에게,\n버드나무로군. 들었을지도 모르겠네만 우리 성 마당에는 성질 고약한 버드나무가 한 그루 있어서, 버드나무들에게 실제보다 나쁜 평판을 씌웠지. 대부분의 버드나무는 강 위로 몸을 기울이고, 베여도 금세 아무는 순한 나무라네. 치유하는 이들은 예로부터 이 나무를 좋아했지.\n혹시 자네 지팡이가 버틸 줄 알았던 순간에 휘어지더라도 걱정 말게. 버드나무는 그렇게 폭풍을 견딘다네.\n알버스 덤블도어"},
    walnut: {en: "Dear {name},\nWalnut, I hear. The walnut is a curious tree: it keeps its best part inside a shell that must be cracked, and it does not care to share its patch of ground with other plants.\nWalnut wands go to clever, inventive people, and they will do almost anything their owners ask, which is why their owners must be careful what they ask. I have no doubt you will ask well.\nAlbus Dumbledore",
      ko: "{name}에게,\n호두나무라고 들었네. 호두나무는 묘한 나무지. 가장 좋은 부분을 깨뜨려야 하는 껍데기 속에 감춰 두고, 제 땅을 다른 식물과 나눠 쓰길 싫어한다네.\n호두나무 지팡이는 영리하고 창의적인 사람에게 가고, 주인이 바라는 일이면 거의 무엇이든 해낸다더군. 그래서 주인은 무엇을 바랄지 조심해야 하지. 자네는 잘 바랄 거라 믿어 의심치 않네.\n알버스 덤블도어"},
    larch: {en: "Dear {name},\nLarch! It is one of the very few conifers that drop their needles in winter, which tells you it is not afraid to be different from its neighbours. In spring it turns a green so bright you would think someone had charmed it.\nLarch wands have a way of finding courage in people who did not know they had any. I shall be most interested to see what yours finds in you.\nAlbus Dumbledore",
      ko: "{name}에게,\n낙엽송이라니! 겨울에 바늘잎을 떨구는 몇 안 되는 침엽수 가운데 하나지. 이웃과 달라지는 걸 두려워하지 않는 나무라는 뜻일세. 봄이 오면 누가 마법이라도 건 듯 눈부신 초록으로 물든다네.\n낙엽송 지팡이는 스스로도 몰랐던 용기를 사람에게서 찾아내곤 하지. 자네 지팡이가 자네에게서 무엇을 찾아낼지 무척 궁금하군.\n알버스 덤블도어"},
    hazel: {en: "Dear {name},\nHazel. In the countryside, people once walked the fields holding a forked hazel twig loosely in both hands, waiting for it to dip towards hidden water. Whether it worked I cannot say, but I have always liked a wood that people trusted to find what was hidden.\nHazel wands are said to feel their owner's moods rather keenly, so be kind to yourself on your bad days. It will notice.\nAlbus Dumbledore",
      ko: "{name}에게,\n개암나무로군. 시골에서는 예전에 Y자로 갈라진 개암나무 가지를 두 손에 가볍게 쥐고 들판을 걸으며, 가지가 숨은 물 쪽으로 기울기를 기다렸다네. 정말 통했는지는 모르겠네만, 사람들이 숨은 것을 찾아 주리라 믿었던 나무라는 게 나는 늘 좋았지.\n개암나무 지팡이는 주인의 기분을 꽤 예민하게 느낀다고들 하니, 기분이 안 좋은 날엔 자신에게 너그럽게 대하게. 지팡이가 알아챌 테니까.\n알버스 덤블도어"}
  }
};
/* which professor writes about this wood, and with which letter */
export function letterFor(wood, isOpen){
  const own = OWNER[wood];
  if (own && isOpen(own)) return {deck: own, text: LETTERS.own[wood]};
  if (own) return {deck: 'dumbledore', text: LETTERS.relay[wood]};
  return {deck: 'dumbledore', text: LETTERS.wood[wood]};
}

/* ---------- a right answer in the classroom: a few sparks from where it was given, in the core's colour */
export function spark(el){
  const w = get(); if (!w || !el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect(); if (!r.width) return;
  const box = document.createElement('div');
  box.className = 'wspark';
  box.style.cssText = `left:${Math.round(r.left + Math.min(r.width, 60) * .5)}px;top:${Math.round(r.top + r.height / 2)}px;--c:${CORES[w.core].spark}`;
  box.innerHTML = Array.from({length: 12}, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + Math.random() * .5, d = 22 + Math.random() * 30;
    return `<i style="--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d - 10).toFixed(1)}px;--t:${(.5 + Math.random() * .35).toFixed(2)}s"></i>`;
  }).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1000);
}
