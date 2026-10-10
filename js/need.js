/* The Room of Requirement (#/need, 2026-10-09 user decision, docs/plan-need.md). A blank stretch of wall at the end of
   the corridor, there once two classroom doors are open (Lupin writes about it, without a button). Walk past it three
   times (home.js) and a door comes out of the stone. Inside, the room has become whatever is most needed today — it
   chooses, the guest does not:
     catch  — reviews piled up in every classroom (over 20): the oldest first, as normal reviews
     hidden — five or more hidden things: every review line missed anywhere lies here as an object until it is
              answered right again IN THIS ROOM (2026-10-10 user decision — before, a right answer in its own
              classroom found it too, so things reached the shelf without the room ever being visited);
              found things go to the shelf in your room
     expr   — an expression missed twice or more: its example sentences
     reply / shelf — otherwise, by turns: the line before (someone else's words) and which reply the professor gave;
              or lines mastered long ago, to see if they are still there
   Ten at a time, in the classroom screen (room.js, #/room/need). No bond with the professors; the register stamps
   the day with the room's own seal. state.need = {ready, open, hidden:{"deck/id": {d, o}}, found:{o: n}, round}. */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as doors from './doors.js';
import {DECKS, byId, SPEAKERS} from './decks.js';
import {$, esc, toast, openSheet, reduced} from './ui.js';

/* ---------- the twenty hidden things */
export const OBJECTS = [
  {en: 'A Stopped Alarm Clock', ko: '멈춘 자명종', s: ['It went off in the middle of a History of Magic lesson and was hidden here in disgrace. It has not ticked since.', '마법의 역사 수업 한가운데서 울려 버려 망신 속에 이곳에 숨겨졌다. 그 뒤로 한 번도 째깍거리지 않았다.']},
  {en: 'A Tarnished Tiara', ko: '빛바랜 작은 왕관', s: ['Someone very clever wore it once. These days it mostly gathers cobwebs.', '아주 영리한 누군가가 한때 썼다. 요즘은 주로 거미줄을 모은다.']},
  {en: 'A Single Roller Skate', ko: '한 짝뿐인 롤러스케이트', s: ['Brought in by a first-year who planned to race down the Grand Staircase. Mercifully, the plan was never tested.', '대계단을 타고 내려가려던 1학년이 가져왔다. 다행히 계획은 한 번도 시험되지 않았다.']},
  {en: 'A Snapped Broomstick', ko: '두 동강 난 빗자루', s: ['Its owner swore it was the wind. Nobody ever asked the wind.', '주인은 바람 탓이라고 맹세했다. 바람에게 물어본 사람은 없었다.']},
  {en: 'An Empty Birdcage', ko: '빈 새장', s: ['Whatever lived in it left without a forwarding address.', '안에 살던 무언가는 새 주소도 남기지 않고 떠났다.']},
  {en: 'A Bundle of Chewed Quills', ko: '씹힌 깃펜 꾸러미', s: ['Evidence of a great many difficult essays.', '수많은 어려운 과제의 증거.']},
  {en: 'A Textbook with Its Pages Glued Shut', ko: '책장이 붙어 버린 교과서', s: ['Someone did not want to read chapter nine, or anyone else to.', '누군가는 9장을 읽고 싶지 않았다. 남이 읽는 것도.']},
  {en: 'A Cracked Crystal Ball', ko: '금 간 수정 구슬', s: ['It foretold its own fall from the table. Nobody believed it.', '탁자에서 떨어질 자기 운명을 예언했다. 아무도 믿지 않았다.']},
  {en: 'A Bludger in Chains', ko: '사슬에 묶인 블러저', s: ['Locked away after it developed a personal grudge.', '개인적인 원한을 품게 된 뒤로 갇혔다.']},
  {en: 'A Jar of Something Pickled', ko: '뭔지 모를 절임 단지', s: ['Nobody remembers what it is. Nobody has been brave enough to open it.', '무엇인지 기억하는 사람이 없다. 열어 볼 만큼 용감한 사람도 없었다.']},
  {en: 'A Moth-Eaten Cloak', ko: '좀먹은 망토', s: ["It was somebody's best once. Now it is mostly holes, held together by habit.", '한때는 누군가의 가장 좋은 옷이었다. 지금은 거의 구멍이고, 습관으로 겨우 붙어 있다.']},
  {en: 'A Squashed Pointed Hat', ko: '찌그러진 고깔모자', s: ['Sat on by a troll, according to the label. Sat on by a sixth-year, according to everyone else.', '꼬리표에 따르면 트롤이 깔고 앉았다. 다른 모든 사람 말로는 6학년이 깔고 앉았다.']},
  {en: "A Dented Knight's Helmet", ko: '찌그러진 기사 투구', s: ['Borrowed from a suit of armour on the third floor. The armour still clanks about, looking for it.', '4층 갑옷에게서 빌려 왔다. 그 갑옷은 아직도 철컹거리며 투구를 찾아다닌다.']},
  {en: 'A Box of Damp Fireworks', ko: '눅눅해진 폭죽 상자', s: ['Smuggled in for a party that never happened. They still fizz a little, out of hope.', '열리지 못한 파티를 위해 몰래 들여왔다. 아직도 희망에 차 조금씩 지지직거린다.']},
  {en: 'A Bundle of Unsent Letters', ko: '부치지 못한 편지 다발', s: ['Tied with string and never posted. Some things are easier to write than to send.', '끈으로 묶인 채 끝내 부치지 못했다. 어떤 말은 보내기보다 쓰기가 쉽다.']},
  {en: 'An Enchanted Paper Bird', ko: '마법 걸린 종이새', s: ['Folded in a dull lesson and charmed to fly. It is still looking for the window.', '지루한 수업 시간에 접혀 날도록 마법이 걸렸다. 아직도 창문을 찾고 있다.']},
  {en: 'A Rocking Horse with One Ear', ko: '귀 한 짝 없는 흔들목마', s: ['Nobody knows how it got up here. It rocks, very slowly, when no one is looking.', '어떻게 여기까지 올라왔는지 아무도 모른다. 아무도 보지 않을 때 아주 천천히 흔들린다.']},
  {en: "A Tin Dragon That Won't Wind", ko: '태엽이 안 감기는 양철 용', s: ['It breathed real sparks once and set fire to a curtain, which is why it is here.', '한때 진짜 불꽃을 뿜다가 커튼에 불을 냈다. 그래서 여기 있다.']},
  {en: 'A Battered School Trunk', ko: '낡아 빠진 학교 트렁크', s: ['Its owner left school forty years ago. The trunk, it seems, decided to stay.', '주인은 40년 전에 졸업했다. 트렁크는 남기로 한 모양이다.']},
  {en: 'A Single Shoe from the Yule Ball', ko: '크리스마스 무도회의 구두 한 짝', s: ['Left on the stairs at midnight, like something out of a story.', '자정에 계단에 남겨졌다. 동화 속 이야기처럼.']}
];
const objImg = o => `assets/need/obj-${String(o + 1).padStart(2, '0')}.webp`;
/* where each thing stands in the open cupboard (assets/need/shelf.webp): compartment 0–3 (PLANK index), centre % of the width, height % —
   not in a row, so the shelf never looks like a cabinet of compartments */
const SPOT = [[0,40.6,6.8], [0,68.8,3], [1,59.4,5.4], [3,59.9,3.2], [1,28.9,8.4], [0,49.4,7.6], [2,41.3,4], [0,57.5,6.2], [1,39.3,5.8], [3,40.8,7], [2,29.9,6.2], [2,70.9,4], [0,29.9,7.4], [2,51.6,5.2], [3,49.9,4], [1,49.8,5], [1,70,6.4], [2,61.2,4.4], [3,30.3,4.4], [3,70.5,3.6]];
const PLANK = [.2444, .3516, .4542, .5517];   // the floor of each of the four compartments, as a fraction of the picture height (measured, assets/need/shelf.webp)

/* ---------- words (approved 2026-10-09) */
export const RITUAL = [['I need…', ''], ['…where I can practise…', ''], ['…whatever I need most today.', '']];
export const RITUAL_FULL = [['I need a place…', '나에게 필요한 곳은…'], ['…where I can practise…', '…연습할 수 있는…'], ['…whatever I need most today.', '…오늘 가장 필요한 걸.']];
const SAYS = {
  hidden: [["Everything hidden here is something you once stumbled over. Shall we dig?", '여기 숨겨진 건 전부 네가 한 번 걸려 넘어졌던 것들이다. 파 볼까?'],
    ["The piles have grown since you were last here. Some of them look familiar.", '지난번보다 더미가 커졌다. 몇 개는 낯이 익다.'],
    ["Somewhere under all this is a line you nearly knew.", '이 더미 어딘가에 거의 알았던 대사가 있다.']],
  catch: [["The room has made itself small and quiet, with a great deal of unfinished work on the desk.", '방이 작고 조용해졌다. 책상 위엔 밀린 일이 잔뜩이다.'],
    ["A single lamp, a long table, and a clock that will not stop reminding you of the time.", '램프 하나, 긴 책상, 그리고 시간을 자꾸 일깨우는 시계 하나.'],
    ["Nothing here but you and the work you have been putting off.", '여기엔 너와 미뤄 둔 일뿐이다.']],
  expr: [["Notes cover every wall, all in different hands, all about the same small trouble.", '벽마다 쪽지가 가득하다. 글씨는 제각각이지만 모두 같은 작은 골칫거리에 관한 것이다.'],
    ["The room has turned into a study, and it seems to have something particular in mind.", '방이 서재로 바뀌었다. 무언가 콕 집어 둔 게 있는 모양이다.'],
    ["One phrase keeps slipping away from you. The room would like a word with it.", '표현 하나가 자꾸 빠져나간다. 방이 그 표현과 얘기 좀 하고 싶은 모양이다.']],
  shelf: [["Nothing is hidden and nothing is waiting. Only old books, and the dust on them.", '숨겨진 것도 밀린 것도 없다. 오래된 책과 그 위의 먼지뿐.'],
    ["Moonlight, a ladder, and lines you learnt a long time ago.", '달빛, 사다리 하나, 그리고 오래전에 익힌 대사들.'],
    ["The room has gone quiet. Perhaps it only wants to see what you still remember.", '방이 조용해졌다. 네가 아직 무엇을 기억하는지 보고 싶은 것뿐인지도.']],
  reply: [["Two armchairs by the fire, facing each other. Someone has just finished speaking.", '벽난로 앞, 마주 놓인 안락의자 두 개. 누군가 방금 말을 마쳤다.'],
    ["The room has set out two cups of tea and is waiting for a reply.", '방이 찻잔 두 개를 내놓고 대답을 기다린다.'],
    ["Every line is an answer to something. Here, you hear the something first.", '모든 대사는 무언가에 대한 대답이다. 여기선 그 무언가를 먼저 듣는다.']]
};
const BYE = {
  hidden: [['{n} things found. The room seems lighter already.', '{n}개를 찾았다. 방이 벌써 가벼워진 것 같다.'], ['{n} things found. The rest will keep. They always do.', '{n}개를 찾았다. 나머지는 기다려 줄 것이다. 늘 그렇듯.'], ['Not much found today, but you know where to dig now.', '오늘은 많이 못 찾았지만, 이제 어디를 파야 할지는 안다.']],
  catch: [['The desk is clearer than it has been for days.', '책상이 며칠 만에 가장 깨끗하다.'], ['A dent in the pile. A respectable dent.', '더미가 좀 줄었다. 꽤 그럴듯하게.'], ['The work will still be here tomorrow. So will the room.', '일은 내일도 여기 있을 것이다. 방도 그렇다.']],
  expr: [['The notes are coming down from the walls, one by one.', '쪽지가 하나씩 벽에서 내려온다.'], ['Better. The phrase is starting to stay where you put it.', '나아졌다. 표현이 둔 자리에 머물기 시작했다.'], ['It is a slippery one. The room will keep it pinned up for you.', '미끄러운 녀석이다. 방이 벽에 꽂아 둘 것이다.']],
  shelf: [['Old lines, still sharp. The dust was only on the books.', '오래된 대사들이 아직 또렷하다. 먼지는 책 위에만 있었다.'], ['Most of it is still there. A little dusting will see to the rest.', '대부분 그대로 남아 있다. 나머지는 먼지만 털면 된다.'], ['More has faded than you hoped. It will come back to you, in its classroom.', '생각보다 많이 바랬다. 제 교실에서 다시 돌아올 것이다.']],
  reply: [['You knew exactly what was coming. The fire seems pleased.', '무슨 말이 올지 정확히 알았다. 벽난로가 흐뭇해 보인다.'], ['A fair conversation. Some replies took you by surprise.', '괜찮은 대화였다. 몇몇 대답은 뜻밖이었다.'], ['The professors had the last word today. They usually do.', '오늘은 교수들이 마지막 말을 가져갔다. 대개 그렇다.']]
};
const LUPIN = {
  en: "{name}, there is something I have wanted to tell you since you opened your second door. At the very end of your corridor there is a stretch of wall where, as far as I know, there has never been a door. My friends and I walked past it for seven years, map and all, and never once found what was behind it. I found out later that we had simply never needed it badly enough.\nIf you ever do, walk past it three times and think hard about what you need. Then see what happens.",
  ko: '{name}, 네가 두 번째 문을 연 뒤로 꼭 말해 주고 싶은 게 있었단다. 네 복도 맨 끝에, 내가 아는 한 한 번도 문이 있었던 적 없는 벽이 있어. 내 친구들과 나는 칠 년 동안, 그 지도를 들고도, 그 앞을 지나다니면서 뒤에 뭐가 있는지 끝내 찾지 못했지. 나중에 알았는데, 그저 우리가 그게 그만큼 절실하지 않았던 거더구나.\n혹시 네게 절실해지면, 그 앞을 세 번 지나가며 필요한 걸 깊이 생각해 보렴. 그리고 무슨 일이 일어나는지 보렴.'
};
/* the room answers instead of a professor (2026-10-09 user decision: no one else is in here): not a voice, only
   something that happens in that day's room — one of two lines for each result (approved 2026-10-09) */
export const REACT = {
  hidden: {
    good: [['Something in the pile shifts, as if it heard you.', '더미 속 무언가가 그 말을 들은 듯 움찔한다.'], ['A tower of forgotten things leans aside, just a little.', '잊힌 물건 더미 하나가 아주 조금 비켜선다.']],
    hard: [['The pile creaks, but holds on to what it has.', '더미가 삐걱이지만, 쥔 것을 놓지 않는다.'], ['Dust drifts down through the light and settles nowhere in particular.', '먼지가 빛줄기를 지나 어디라 할 것 없이 내려앉는다.']],
    again: [['Somewhere in the pile, something slides out of sight.', '더미 어딘가에서 무언가가 미끄러지듯 숨는다.'], ['The towers of things seem a little taller than before.', '물건 더미가 조금 전보다 더 높아 보인다.']]},
  catch: {
    good: [['The clock on the wall ticks a little more slowly.', '벽시계가 조금 더 느긋하게 똑딱인다.'], ['A sheet lifts itself off the stack on the desk and is gone.', '책상 위 종이 한 장이 스스로 떠올라 사라진다.']],
    hard: [['The clock hesitates between one tick and the next.', '시계가 똑딱과 똑딱 사이에서 머뭇거린다.'], ['The candle on the desk leans, then straightens.', '책상 위 촛불이 기울었다가 다시 선다.']],
    again: [['The clock ticks on, a little louder.', '시계가 조금 더 크게 똑딱인다.'], ['Another sheet slips onto the stack on the desk.', '책상 위 더미에 종이 한 장이 또 얹힌다.']]},
  expr: {
    good: [['A note peels itself off the wall and drifts to the floor.', '쪽지 하나가 벽에서 저절로 떨어져 바닥으로 내려앉는다.'], ['The scrawl on one note settles into neat, steady letters.', '한 쪽지의 휘갈긴 글씨가 단정한 글자로 가라앉는다.']],
    hard: [['One note flutters, as if unsure whether to stay.', '쪽지 하나가 남을지 말지 망설이듯 팔랑인다.'], ['The ink on a note blurs, then sharpens again.', '쪽지의 잉크가 번졌다가 다시 또렷해진다.']],
    again: [['The notes on the wall rustle all at once.', '벽의 쪽지들이 한꺼번에 바스락거린다.'], ['A new note pins itself to the wall, in a hurried hand.', '급히 휘갈긴 새 쪽지 하나가 벽에 저절로 붙는다.']]},
  shelf: {
    good: [['The dust lifts from the spine of a book.', '책등 하나에서 먼지가 걷힌다.'], ['A book slides back into its place with a soft knock.', '책 한 권이 톡 소리를 내며 제자리로 들어간다.']],
    hard: [['A book tilts forward on its shelf, then thinks better of it.', '책 한 권이 앞으로 기울었다가 마음을 바꾼다.'], ['The ladder rolls a few inches along the shelves, then stops.', '사다리가 서가를 따라 몇 뼘 굴러가다 멈춘다.']],
    again: [['The dust settles a little thicker.', '먼지가 조금 더 두껍게 내려앉는다.'], ['A book eases out of its row, waiting to be read again.', '책 한 권이 다시 읽히기를 기다리며 줄에서 슬며시 빠져나온다.']]},
  reply: {
    good: [['The fire answers with a bright crackle.', '벽난로 불이 탁 소리를 내며 밝게 대답한다.'], ['For a moment, the empty chair across from you seems less empty.', '잠시, 맞은편 빈 의자가 덜 비어 보인다.']],
    hard: [['The fire flickers, not quite convinced.', '불길이 흔들린다. 아직 다 믿지는 않는 듯.'], ['The chair opposite creaks, as if someone had shifted in it.', '맞은편 의자가 누가 고쳐 앉은 듯 삐걱인다.']],
    again: [['The fire sinks low for a moment.', '불길이 잠시 낮게 가라앉는다.'], ['The room goes quiet, waiting for a better answer.', '방이 조용해진다. 더 나은 대답을 기다리며.']]}
};
export function textOf(prof, key){ return prof === 'lupin' && key === 'NEED' ? {kind: '편지', ...LUPIN} : null; }

/* ---------- state */
const st = () => { const s = store.get(); return s.need || (s.need = {hidden: {}, found: {}}); };
export const isOpen = () => !!st().open;
const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const objOf = key => hash(key) % OBJECTS.length;
export const hiddenCount = () => Object.keys(st().hidden || {}).length;
export const foundKinds = () => Object.keys(st().found || {}).length;
const openDecks = () => DECKS.filter(d => d.file && doors.isOpen(d.id));

/* opens the day after the second classroom door: Lupin's letter, and the first pile from the lines missed so far.
   Someone who already studied in two classrooms before today (e.g. doors opened before the room existed) need not
   wait. Called at start-up and each time the corridor shows (an app left open overnight); true when it opened. */
export function daily(app){
  const s = st();
  if (s.open || !store.get().settings.named) return false;
  if (((store.get().doors || {}).open || []).length < 2) return false;
  const t = srs.today(), log = store.get().log || {}, before = new Set();
  Object.keys(log).forEach(d => { if (d < t) Object.keys(log[d] || {}).forEach(k => before.add(k)); });
  const early = openDecks().filter(d => before.has(d.id)).length >= 2;
  if (!s.ready){ s.ready = t; store.save(); }
  if (s.ready >= t && !early) return false;
  if (openDecks().some(d => !app.data[d.id])) return false;   // the classrooms' lines are still loading
  s.open = t; s.hidden = s.hidden || {}; s.found = s.found || {};
  for (const d of openDecks()){
    const cards = app.data[d.id]; if (!cards) continue;
    srs.wrongLines(d.id, cards).slice(0, 12).forEach(c => { const k = `${d.id}/${c.id}`; s.hidden[k] = {d: t, o: objOf(k)}; });
  }
  bond.postItem('lupin', 'NEED');
  store.save();
  return true;
}

/* every answer anywhere: a review line missed is hidden here. It is found only by answering it right in this room
   (any form that asks the line itself or its expression: hidden, catch, shelf) — a right answer in the classroom
   moves its review on as usual and leaves the thing where it lies. */
srs.hooks.push(ev => {
  if (!isOpen() || (ev.kind === 'need' && (ev.form === 'expr' || ev.form === 'reply'))) return;
  const s = st(), k = `${ev.deckId}/${ev.cardId}`;
  if (ev.g === 'again'){ if (!s.hidden[k]){ s.hidden[k] = {d: srs.today(), o: objOf(k)}; store.save(); } return; }
  if (ev.g === 'good' && ev.kind === 'need' && s.hidden[k]){
    const o = s.hidden[k].o; delete s.hidden[k];
    s.found[o] = (s.found[o] || 0) + 1; store.save();
    const r = s.round; if (r && r.date === srs.today()) (r.found = r.found || []).push(o);
    toast(`<span class="q" lang="en">Found: ${esc(OBJECTS[o].en)}</span><span class="k">숨겨진 물건을 찾았다 · ${esc(OBJECTS[o].ko)} → 내 방 선반</span>`, 2600, true);
  }
});

/* ---------- what the room becomes today */
async function load(app){
  const ds = openDecks();
  await Promise.all(ds.map(d => Promise.all([app.loadDeck(d.id), app.loadPractice(d.id), app.loadExamples(d.id)]).catch(() => null)));
  return ds.filter(d => app.data[d.id]);
}
const usable = c => c.card !== false;
async function survey(app){
  const ds = await load(app), t = srs.today(), due = [], weak = [], mastered = [], cues = [];
  let learnt = 0;
  for (const d of ds){
    const cs = store.deck(d.id).cards, ex = app.examples[d.id] || {};
    for (const c of app.data[d.id]){
      const x = cs[c.id]; if (!usable(c) || !x) continue;
      learnt++;
      if (x.d <= t) due.push({d, c, x});
      if ((x.m || 0) >= 2 && c.bre.some((b, k) => ex[`${c.id}#${k}`] && ex[`${c.id}#${k}`].items && ex[`${c.id}#${k}`].items.length)) weak.push({d, c, x});
      if (x.i > srs.MASTERED) mastered.push({d, c, x});
      if (c.cue && c.cue_speaker && !c.prev_line && !c.minimal) cues.push({d, c, x});
    }
  }
  return {due, weak, mastered, cues, learnt};
}
export function chooseForm(sv){
  if (sv.due.length > 20) return 'catch';
  if (hiddenCount() >= 5) return 'hidden';
  if (sv.weak.length) return 'expr';
  const turn = hash(srs.today()) % 2;
  if (sv.learnt >= 30 && sv.cues.length >= 4 && (turn || !sv.mastered.length)) return 'reply';
  if (sv.mastered.length) return 'shelf';
  if (sv.cues.length >= 4) return 'reply';
  if (hiddenCount()) return 'hidden';
  return sv.due.length ? 'catch' : 'shelf';
}
const shuffled = (arr, seed) => { let s = hash(seed); const R = () => ((s = (s * 1103515245 + 12345) | 0) >>> 0) / 4294967296; const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/* one round: up to ten lines (or one, when a hidden thing is picked from the pile) */
export function startRound(app, sv, form, only){
  const s = st(), t = srs.today(), n = (s.rounds && s.rounds.date === t ? s.rounds.n : 0) + 1;
  s.rounds = {date: t, n};
  let queue = [], ex = {};
  if (form === 'hidden') queue = only ? [only] : Object.entries(s.hidden).sort((a, b) => a[1].d < b[1].d ? -1 : 1).map(e => e[0]).filter(k => { const [d, id] = k.split('/'); return app.data[d] && app.data[d].some(c => c.id === id); }).slice(0, 10);
  else if (form === 'catch') queue = sv.due.sort((a, b) => a.x.d < b.x.d ? -1 : a.x.d > b.x.d ? 1 : 0).slice(0, 10).map(e => `${e.d.id}/${e.c.id}`);
  else if (form === 'shelf'){
    const pool = sv.mastered.length >= 5 ? sv.mastered : sv.mastered.concat(shuffled(sv.due, t)).concat([]);
    const picked = shuffled(pool.length ? pool : sv.cues, t + '#' + n).slice(0, 10);
    queue = picked.map(e => `${e.d.id}/${e.c.id}`);
    /* keeping a mastered line alive (2026-10-09 user decision): where the line has an expression with example
       sentences, the question is that expression in a sentence not seen in its note (items 3–10; 1–2 are the note's
       own) instead of the line itself — can it still be used, not just recited. A miss sends the line back to be
       learnt, as before. */
    picked.forEach(({d, c}) => {
      const exs = app.examples[d.id] || {}, ks = c.bre.map((b, k) => k).filter(k => { const e = exs[`${c.id}#${k}`]; return e && e.items && e.items.length; });
      if (!ks.length) return;
      const k = ks[hash(t + c.id + 'k') % ks.length], e = exs[`${c.id}#${k}`], fresh = e.items.length > 2 ? e.items.slice(2) : e.items;
      ex[`${d.id}/${c.id}`] = {...fresh[hash(t + c.id + n) % fresh.length], expr: e.expr};
    });
  }
  else if (form === 'reply') queue = shuffled(sv.cues, t + '#r' + n).slice(0, 10).map(e => `${e.d.id}/${e.c.id}`);
  else if (form === 'expr'){
    const weak = sv.weak.sort((a, b) => (b.x.m || 0) - (a.x.m || 0));
    for (const {d, c} of weak){
      const exs = app.examples[d.id] || {};
      c.bre.forEach((b, k) => { const e = exs[`${c.id}#${k}`]; if (!e || !e.items) return;
        shuffled(e.items, t + c.id + k).slice(0, 3).forEach((it, j) => { if (queue.length >= 10) return; const q = `${d.id}/${c.id}/${k}.${j}`; queue.push(q); ex[q] = {...it, expr: e.expr}; }); });
      if (queue.length >= 10) break;
    }
  }
  s.round = {date: t, form, queue, ex, pos: 0, results: {}, found: []};
  store.save();
  return s.round;
}
export const round = () => { const r = st().round; return r && r.date === srs.today() ? r : null; };
const pickLine = (list, seed) => list[hash(seed) % list.length];

/* ---------- the screen: the room in its form of the day · the end of a round · the shelf in your room */
export function initNeed(app){
  const sec = $('#need'), body = $('#ndBody'), bg = $('#ndPhoto');
  let sv = null, form = '';
  const setPhoto = f => {
    bg.style.setProperty('--p', `url("${new URL(`assets/need/room${{hidden: 1, catch: 2, expr: 3, shelf: 4, reply: 7}[f]}-portrait.webp`, location.href).href}")`);
    bg.style.setProperty('--w', `url("${new URL(`assets/need/room${{hidden: 1, catch: 2, expr: 3, shelf: 4, reply: 7}[f]}-wide.webp`, location.href).href}")`);
    sec.classList.remove('shelf-view');
  };

  function reason(f){
    if (f === 'catch') return `모든 교실에 밀린 복습이 ${sv.due.length}개 있습니다. 가장 오래 밀린 것부터 10개.`;
    if (f === 'hidden'){ const by = {}; Object.keys(st().hidden).forEach(k => { const d = k.split('/')[0]; by[d] = (by[d] || 0) + 1; });
      return `숨겨진 물건 ${hiddenCount()}개 · ` + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${byId(d) ? byId(d).ko.replace(/ 교수$/, '') : d} ${n}`).join(' · '); }
    if (f === 'expr'){ const w = sv.weak[0], b = w.c.bre[0]; return `자꾸 틀리는 표현 <em lang="en">${esc(b.expr)}</em> · ${esc(w.d.ko)} 교실에서 ${w.x.m}번`; }
    if (f === 'shelf') return '숨겨진 것도 밀린 것도 없습니다. 오래전에 익힌 대사의 표현을 처음 보는 문장에서도 쓸 수 있는지 봅니다.';
    return '상대의 말을 보고, 교수가 뭐라고 받았는지 고르세요.';
  }
  /* the pile: the hidden things scattered over the floor of the hall */
  function pile(){
    const list = Object.entries(st().hidden).sort((a, b) => a[1].d < b[1].d ? -1 : 1).slice(0, 14);
    /* loose rows of four, each thing nudged a little off its place, so none hides another */
    const rows = Math.ceil(list.length / 4);
    return `<div class="nd-pile" style="--rows:${rows}" aria-label="숨겨진 물건">${list.map(([k, v], i) => {
      const h = hash(k), row = Math.floor(i / 4), inRow = Math.min(4, list.length - row * 4), col = i % 4;
      const x = (col + .5) * (100 / inRow) + ((h % 9) - 4), y = (row + .5) * (100 / rows) + (((h >> 5) % 9) - 4), r = ((h >> 3) % 22) - 11, d = byId(k.split('/')[0]);
      return `<button type="button" class="nd-obj" data-k="${esc(k)}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--r:${r}deg;z-index:${10 + row}" aria-label="${esc(OBJECTS[v.o].ko)} · ${d ? esc(d.ko) : ''}의 대사"><img src="${objImg(v.o)}" alt=""></button>`;
    }).join('')}</div>`;
  }
  async function drawRoom(){
    body.innerHTML = '<p class="nd-wait">문이 열리는 중…</p>';
    sv = await survey(app);
    form = chooseForm(sv);
    setPhoto(form);
    const [en, ko] = pickLine(SAYS[form], srs.today() + (st().rounds ? st().rounds.n : 0));
    const n = form === 'hidden' ? hiddenCount() : 0;
    body.innerHTML = (form === 'hidden' ? pile() : '') +
      `<div class="nd-card"><div class="paperbox parch"></div>` +
      `<p class="nd-kind" lang="en">The Room of Requirement</p>` +
      `<p class="nd-says" lang="en">“${esc(en)}”</p><p class="nd-ko">${esc(ko)}</p>` +
      `<p class="nd-why">${reason(form)}</p>` +
      `<button type="button" class="sh-drill" data-go="round">${form === 'hidden' ? `<span lang="en">Dig</span> · ${Math.min(10, n)}개 찾아보기` : '<span lang="en">Begin</span> · 10문제'}</button>` +
      (form === 'hidden' ? '<p class="nd-tip">물건 하나를 누르면 그 대사 한 문제만 풉니다.</p>' : '') + `</div>`;
  }
  function go(only){
    const r = startRound(app, sv, form, only);
    if (!r.queue.length){ toast('지금은 방이 내줄 것이 없습니다. 교실에서 조금 더 공부하고 오세요.', 2800); return; }
    app.go('#/room/need');
  }

  function drawEnd(){
    const r = st().round; if (!r){ app.go('#/', true); return; }
    setPhoto(r.form);
    const good = Object.values(r.results).filter(g => g === 'good').length, total = r.queue.length;
    const found = (r.found || []).length;
    /* how it went, as a share of the round (a round can be shorter than ten) */
    const score = r.form === 'hidden' ? found : good, ratio = total ? score / total : 0;
    const [en, ko] = BYE[r.form][ratio >= .7 ? 0 : ratio >= .3 ? 1 : 2];
    const f = s => s.replace('{n} things', score === 1 ? 'One thing' : '{n} things').replace('{n}', score);
    body.innerHTML = `<div class="nd-card end"><div class="paperbox parch"></div>` +
      `<p class="nd-kind" lang="en">The Room of Requirement</p>` +
      `<p class="nd-says" lang="en">“${esc(f(en))}”</p><p class="nd-ko">${esc(f(ko))}</p>` +
      (found ? `<div class="nd-found">${(r.found || []).map(o => `<figure><img src="${objImg(o)}" alt=""><figcaption>${esc(OBJECTS[o].ko)}</figcaption></figure>`).join('')}</div><p class="nd-tip">찾은 물건은 내 방 선반으로 갔습니다.</p>` : '') +
      `<p class="nd-sink" lang="en">The door sinks back into the stone.</p><p class="nd-ko">문이 다시 돌 속으로 가라앉는다.</p>` +
      `<button type="button" class="sh-drill" data-go="out">복도로 나가기</button></div>`;
  }

  /* the shelf in your own room: what has been found, at its own place on the planks, no compartments */
  function drawShelf(){
    sec.classList.add('shelf-view');
    const f = st().found || {}, kinds = Object.keys(f).length;
    /* the open cupboard fills the screen; things stand where they were put on its shelves, no compartments */
    body.innerHTML = `<div class="nd-shelfwrap"><div class="nd-shelf">` +
      OBJECTS.map((o, i) => { if (!f[i]) return ''; const [p, x, h] = SPOT[i];
        return `<button type="button" class="nd-on" data-o="${i}" style="--x:${x};bottom:${((1 - PLANK[p]) * 100 - .6).toFixed(1)}%;height:${h}%;" aria-label="${esc(o.ko)}"><img src="${objImg(i)}" alt="">${f[i] > 1 ? `<i class="nd-tag">×${f[i]}</i>` : ''}</button>`; }).join('') +
      `</div></div><p class="nd-shelfcap">${kinds ? `찾은 물건 ${kinds}종` : '아직 찾은 물건이 없습니다. 필요의 방은 네가 걸려 넘어진 것들을 간직한다.'}</p>`;
  }

  body.addEventListener('click', e => {
    const o = e.target.closest('[data-k]'); if (o){ go(o.dataset.k); return; }
    const g = e.target.closest('[data-go]');
    if (g){ if (g.dataset.go === 'round') go(); else { app.leftRoom = 'need'; app.go('#/'); } return; }
    const s = e.target.closest('[data-o]');
    if (s){ const i = +s.dataset.o, ob = OBJECTS[i];
      openSheet(`<div class="sh-kind"><span>선반 · 찾은 물건${st().found[i] > 1 ? ` ×${st().found[i]}` : ''}</span></div>` +
        `<figure class="lt-gift"><img src="${objImg(i)}" alt=""><figcaption><b lang="en">${esc(ob.en)}</b><span>${esc(ob.ko)}</span></figcaption></figure>` +
        `<div class="lt-letter" lang="en" id="shTitle"><p>${esc(ob.s[0])}</p></div><div class="lt-ko"><p>${esc(ob.s[1])}</p></div>`); }
  });
  $('#ndBack').addEventListener('click', () => { if (sec.classList.contains('shelf-view')) app.go('#/me'); else { app.leftRoom = 'need'; app.go('#/'); } });

  async function show({id}){
    if (id === 'shelf'){ $('#ndTtl').textContent = 'The Shelf'; drawShelf(); return; }
    $('#ndTtl').textContent = 'The Room of Requirement';
    if (!isOpen()){ app.go('#/', true); return; }
    if (id === 'end') drawEnd(); else await drawRoom();
  }
  return {show};
}
