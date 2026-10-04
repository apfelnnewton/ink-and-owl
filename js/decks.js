/* Deck list. Door look (wood, stone, metal, glow, seed, …) is copied from design/reference-c.html.
   To open a deck: put its data file name in `file`. `practice` names the fill-the-blank file in practice/ (optional;
   without it the ladder skips that rung). A deck without its own room art yet borrows Snape's room
   (see ROOMS in room.js) until one is drawn for it. */
export const DECKS = [
  {id:'snape', file:'snape.json', practice:'snape.json', examples:'snape-examples.json', who:'Professor Snape', ko:'스네이프 교수', room:'Potions, with Professor Snape', where:'마법약 교실, 지하', plateName:'Prof. S. Snape', plateSub:'마법약', tag:'S. Snape', wood:'#24332B', stone:'#27302B', metal:'iron', glow:'#3FA66B', seed:11},
  {id:'mcgonagall', file:'mcgonagall.json', practice:'mcgonagall.json', examples:'mcgonagall-examples.json', who:'Professor McGonagall', ko:'맥고나걸 교수', room:'Transfiguration, with Professor McGonagall', where:'변신술 교실, 2층', plateName:'Prof. McGonagall', plateSub:'변신술', tag:'M. McGonagall', wood:'#5E3D22', stone:'#2C312C', metal:'brass', glow:'#E6A23C', seed:23},
  {id:'lupin', file:'lupin.json', practice:'lupin.json', examples:'lupin-examples.json', who:'Professor Lupin', ko:'루핀 교수', room:'Defence, with Professor Lupin', where:'어둠의 마법 방어술, 1993년', plateName:'Prof. R. J. Lupin', plateSub:'방어술', tag:'R. J. Lupin', wood:'#6E563A', stone:'#2B302B', metal:'iron', glow:'#D9A85A', seed:37},
  {id:'moody', file:'moody.json', practice:'moody.json', examples:'moody-examples.json', who:'Alastor Moody', ko:'무디 교수', room:'Defence, with Professor Moody', where:'어둠의 마법 방어술, 1994년', plateName:'A. Moody', plateSub:'방어술', tag:'A. Moody', wood:'#3A3C3B', stone:'#2A2F2B', metal:'iron', glow:'#8FB4C9', seed:41, noStraps:true, noKeyhole:true, noRing:true},
  {id:'umbridge', file:'umbridge.json', practice:'umbridge.json', examples:'umbridge-examples.json', who:'Professor Umbridge', ko:'엄브리지 교수', room:'Defence, with Professor Umbridge', where:'어둠의 마법 방어술, 1995년', plateName:'D. J. Umbridge', plateSub:'고등 조사관', tag:'D. J. Umbridge', wood:'#D592A9', stone:'#2E302D', metal:'brass', plate:'enamel', trim:'#FBEFF2', glow:'#F3A9C0', seed:53},
  {id:'dumbledore', file:'dumbledore.json', practice:'dumbledore.json', examples:'dumbledore-examples.json', who:'Professor Dumbledore', ko:'덤블도어 교수', room:'The Headmaster’s Study', where:'교장실', plateName:'The Headmaster', plateSub:'교장실', tag:'A. Dumbledore', wood:'#80602E', stone:'#30322B', metal:'brass', curl:true, glow:'#F2C45A', seed:67},
  {id:'slughorn', file:'slughorn.json', practice:'slughorn.json', examples:'slughorn-examples.json', who:'Professor Slughorn', ko:'슬러그혼 교수', room:'Potions, with Professor Slughorn', where:'마법약 교실, 1996년', plateName:'Prof. H. Slughorn', plateSub:'마법약', tag:'H. Slughorn', wood:'#56375A', stone:'#2B2F2B', metal:'brass', glow:'#B98AD6', seed:79}
];

export const byId = id => DECKS.find(d => d.id === id);

/* Who spoke the cue line, in Korean. Unknown names fall back to the English name. */
export const SPEAKERS = {
  Harry:'해리', Hermione:'헤르미온느', Ron:'론', Draco:'드레이코', Malfoy:'말포이', Filch:'필치', Quirrell:'퀴렐',
  Lockhart:'록하트', Dumbledore:'덤블도어', Lupin:'루핀', Sirius:'시리우스', McGonagall:'맥고나걸', Karkaroff:'카르카로프',
  James:'제임스', Umbridge:'엄브리지', Narcissa:'나르시사', Bellatrix:'벨라트릭스', Voldemort:'볼드모트', Yaxley:'약슬리',
  Snape:'스네이프', Neville:'네빌', Ginny:'지니', Fred:'프레드', George:'조지', Hagrid:'해그리드', Slughorn:'슬러그혼',
  Moody:'무디', Trelawney:'트릴로니', Fudge:'퍼지', Cho:'초', Luna:'루나', Seamus:'시머스', Dean:'딘', Lavender:'라벤더',
  Crabbe:'크래브', Goyle:'고일', Lucius:'루시우스', Wormtail:'웜테일', Pettigrew:'페티그루', Cedric:'세드릭', Krum:'크룸'
};

/* What the professors say about your work, each in their own voice (English, with a smaller Korean line).
   REACT: after every answer, by result (good = 맞음, hard = 비슷, again = 틀림).
   REMARKS: end of the day's lesson, by share of 맞음 (`min`), plus `learned` (only new lines today) and `empty`.
   EXTRA: end of the extra round ("더 도전"), by share of 맞음. */
export const REACT = {
  snape: {
    good: [{en: "Correct. Try not to look so surprised.", ko: "맞았다. 그렇게 놀란 얼굴은 하지 마라."}, {en: "Acceptable.", ko: "용인할 만하군."}, {en: "Even you managed that.", ko: "너도 이 정도는 해내는군."}],
    hard: [{en: "Close. Close is not correct.", ko: "비슷하군. 비슷한 건 정답이 아니다."}, {en: "Sloppy. But recognisable.", ko: "엉성하군. 알아볼 수는 있지만."}, {en: "Almost. I expect better.", ko: "거의 맞았군. 이보다는 잘해야지."}],
    again: [{en: "Wrong. Unsurprisingly.", ko: "틀렸다. 놀랍지도 않군."}, {en: "Did you even read it?", ko: "읽기는 했나?"}, {en: "No. Again, tomorrow.", ko: "아니다. 내일 다시."}]
  },
  mcgonagall: {
    good: [{en: "Precisely right. Well done.", ko: "정확하다. 잘했어."}, {en: "Good. That is how it is done.", ko: "좋아. 바로 그렇게 하는 거다."}, {en: "Correct. I am pleased.", ko: "맞았다. 흡족하구나."}],
    hard: [{en: "Nearly. Mind the details.", ko: "거의 됐다. 세부까지 신경 써라."}, {en: "Close, but precision matters in my classroom.", ko: "비슷하지만, 내 교실에선 정확함이 중요하다."}, {en: "Not quite. Again, more carefully.", ko: "조금 모자라. 다시, 더 신중하게 해라."}],
    again: [{en: "No. Pay attention.", ko: "아니다. 집중해라."}, {en: "Incorrect. I expect you to know this.", ko: "틀렸다. 이건 알고 있어야 해."}, {en: "That will not do.", ko: "그걸로는 안 된다."}]
  },
  lupin: {
    good: [{en: "Excellent. You've got it.", ko: "훌륭해. 제대로 익혔구나."}, {en: "Well done. That was not easy.", ko: "잘했어. 쉽지 않았을 텐데."}, {en: "Very good indeed.", ko: "정말 잘했구나."}],
    hard: [{en: "Nearly there. Don't be discouraged.", ko: "거의 다 왔어. 기죽지 마."}, {en: "Good effort. Just a little more.", ko: "애썼어. 조금만 더."}, {en: "Close. You'll have it next time.", ko: "아깝다. 다음엔 될 거야."}],
    again: [{en: "Not this time. That's perfectly all right.", ko: "이번엔 아니었어. 괜찮아."}, {en: "Everyone stumbles. Let's look at it together.", ko: "누구나 넘어지지. 같이 보자."}, {en: "Have some chocolate, then try again tomorrow.", ko: "초콜릿 좀 먹고, 내일 다시 해 보렴."}]
  },
  moody: {
    good: [{en: "Good. Stay sharp.", ko: "좋아. 정신 바짝 차려."}, {en: "Right. Don't get comfortable.", ko: "맞았다. 방심하지 마."}, {en: "Correct. Now do it again under pressure.", ko: "정답. 이제 압박 속에서도 해 봐."}],
    hard: [{en: "Half right gets you half killed.", ko: "반만 맞으면 반쯤 죽는 거다."}, {en: "Close. Close isn't good enough out there.", ko: "근접했다. 바깥에선 근접으론 부족해."}, {en: "Sloppy! Constant vigilance!", ko: "엉성해! 항상 경계하라!"}],
    again: [{en: "Wrong! You'd be dead by now.", ko: "틀렸어! 지금쯤 죽은 목숨이다."}, {en: "No. Again. And this time, think.", ko: "아니다. 다시. 이번엔 생각을 해."}, {en: "Is that what they teach you? Rubbish.", ko: "그렇게 배웠나? 엉터리야."}]
  },
  umbridge: {
    good: [{en: "Very good, dear. The Ministry approves.", ko: "아주 좋아요, 얘야. 마법부도 흡족해한답니다."}, {en: "Correct. How refreshing.", ko: "정답이네요. 이거 참 드문 일이군요."}, {en: "That is the proper answer. Well done.", ko: "그게 올바른 답이에요. 잘했어요."}],
    hard: [{en: "Hem, hem. Nearly, dear.", ko: "흠, 흠. 거의요, 얘야."}, {en: "Not quite the approved wording.", ko: "승인된 표현과는 조금 다르군요."}, {en: "Close. The Ministry does so like things exact.", ko: "비슷하네요. 마법부는 정확한 걸 아주 좋아한답니다."}],
    again: [{en: "Oh dear. That is not correct.", ko: "어머나. 틀렸어요."}, {en: "I'm afraid that's simply wrong, dear.", ko: "유감이지만 완전히 틀렸네요, 얘야."}, {en: "Then you shall have to write lines, dear.", ko: "그럼 반성문을 좀 써야겠네요, 얘야."}]
  },
  dumbledore: {
    good: [{en: "Splendid. Quite splendid.", ko: "훌륭하군. 정말 훌륭해."}, {en: "Ah, you have it. I thought you might.", ko: "아, 해냈군. 그럴 줄 알았네."}, {en: "Correct, and rather elegantly so.", ko: "맞았네. 그것도 꽤 우아하게."}],
    hard: [{en: "Nearly. The rest will come, as these things do.", ko: "거의 됐네. 나머지는 늘 그렇듯 따라올 걸세."}, {en: "Close. A near miss is still a step forward.", ko: "거의 맞았군. 아깝게 빗나간 것도 한 걸음 나아간 거라네."}, {en: "Almost. Never mind the small slips.", ko: "거의 다 왔네. 작은 실수는 마음에 두지 말게."}],
    again: [{en: "Not quite. It is our mistakes that teach us most.", ko: "조금 빗나갔군. 우리를 가장 많이 가르치는 건 실수라네."}, {en: "Wrong, I'm afraid. Tomorrow is another lesson.", ko: "유감스럽게도 틀렸네. 내일은 또 다른 수업이지."}, {en: "Ah. Well, even I forget a word or two.", ko: "아. 뭐, 나도 한두 단어쯤은 잊는다네."}]
  },
  slughorn: {
    good: [{en: "Marvellous! I knew you had it in you!", ko: "훌륭해! 자네한테 그런 재능이 있는 줄 알았지!"}, {en: "Splendid, my dear! Top marks!", ko: "멋지군! 만점일세!"}, {en: "Excellent! You'll go far, mark my words.", ko: "훌륭해! 크게 될 걸세, 내 말 명심하게."}],
    hard: [{en: "Oh, so close! Nearly there, nearly there.", ko: "아, 아깝군! 거의 다 왔어, 거의."}, {en: "Not bad at all! A touch more polish.", ko: "전혀 나쁘지 않아! 조금만 더 다듬게."}, {en: "Very nearly! I'm still impressed.", ko: "거의 맞았어! 그래도 감탄했다네."}],
    again: [{en: "Ah, never mind, never mind! Happens to the best of us.", ko: "아, 괜찮아, 괜찮아! 아무리 뛰어난 사람도 그럴 때가 있다네."}, {en: "Oh dear. Not your finest moment, eh?", ko: "이런. 자네답지 않았군, 응?"}, {en: "Wrong, I'm afraid. Chin up, try again!", ko: "유감이지만 틀렸네. 기운 내고 다시 해 보게!"}]
  }
};

export const REMARKS = {
  snape: {
    tiers: [
      {min: 1, en: "Adequate. Do not let it go to your head.", ko: "그럭저럭이군. 우쭐해하지는 마라."},
      {min: 0.75, en: "Passable. Barely.", ko: "봐줄 만하군. 간신히."},
      {min: 0.45, en: "Mediocre. Precisely as I expected.", ko: "변변찮군. 예상한 그대로다."},
      {min: 0, en: "Pathetic. You will repeat this tomorrow.", ko: "한심하군. 내일 다시 한다."}
    ],
    learned: {en: "You have read them. Now remember them. You will be tested.", ko: "읽었으면 기억해라. 시험할 테니."},
    empty: {en: "Nothing to mark. How very restful.", ko: "채점할 것이 없군. 퍽 한가하겠어."}
  },
  mcgonagall: {
    tiers: [
      {min: 1, en: "Flawless. I expected nothing less, and I am glad to be right.", ko: "흠잡을 데 없다. 기대한 대로야. 내 판단이 맞아서 기쁘구나."},
      {min: 0.75, en: "Good work. A little more care and it will be excellent.", ko: "잘했다. 조금만 더 신중하면 훌륭할 거야."},
      {min: 0.45, en: "Adequate, but you are capable of more. I shall expect it.", ko: "그럭저럭이지만 넌 더 할 수 있다. 기대하겠어."},
      {min: 0, en: "That was not your best. We shall go over it again tomorrow.", ko: "최선이 아니었다. 내일 다시 짚어 보자."}
    ],
    learned: {en: "New material. Read it twice, then once more.", ko: "새 내용이다. 두 번 읽고, 한 번 더 읽어라."},
    empty: {en: "Nothing due today. Do not mistake that for leisure.", ko: "오늘은 할 게 없다. 그렇다고 놀아도 된다는 뜻은 아니야."}
  },
  lupin: {
    tiers: [
      {min: 1, en: "Every single one. I'm genuinely proud of you.", ko: "하나도 빠짐없이. 진심으로 자랑스럽구나."},
      {min: 0.75, en: "Really good work today. You should be pleased.", ko: "오늘 정말 잘했어. 뿌듯해해도 돼."},
      {min: 0.45, en: "A fair start. We'll build on it, one step at a time.", ko: "괜찮은 시작이야. 한 걸음씩 쌓아 가자."},
      {min: 0, en: "A hard day. They happen. Rest, and we'll try again tomorrow.", ko: "힘든 날이었지. 그런 날도 있어. 쉬고 내일 다시 해 보자."}
    ],
    learned: {en: "New words for you. Don't rush them.", ko: "새 표현들이야. 서두르지 마렴."},
    empty: {en: "Nothing to review. Go and enjoy the evening.", ko: "복습할 게 없구나. 저녁 시간을 즐기렴."}
  },
  moody: {
    tiers: [
      {min: 1, en: "Clean sweep. Don't let it make you careless.", ko: "싹쓸이군. 그렇다고 방심하지 마."},
      {min: 0.75, en: "Decent. Out there, decent might just keep you alive.", ko: "쓸 만하군. 바깥에선 그 정도면 목숨은 건질지도."},
      {min: 0.45, en: "Half your answers would've got you killed. Train harder.", ko: "네 답 절반이면 넌 벌써 죽었어. 더 훈련해."},
      {min: 0, en: "Pathetic defence. Again tomorrow, and this time, focus!", ko: "한심한 방어다. 내일 다시, 이번엔 집중해!"}
    ],
    learned: {en: "New drills. Learn them till you can do them in your sleep.", ko: "새 훈련이다. 자면서도 할 수 있을 때까지 익혀."},
    empty: {en: "Nothing to drill today. Suspicious. Stay alert anyway.", ko: "오늘은 훈련할 게 없군. 수상해. 그래도 경계해."}
  },
  umbridge: {
    tiers: [
      {min: 1, en: "Perfect, dear. Exactly what the Ministry likes to see.", ko: "완벽해요, 얘야. 마법부가 딱 좋아하는 모습이군요."},
      {min: 0.75, en: "Very good. There is, however, always room for improvement.", ko: "아주 좋아요. 하지만 개선의 여지는 언제나 있죠."},
      {min: 0.45, en: "Hem, hem. Rather disappointing, I must say.", ko: "흠, 흠. 솔직히 꽤 실망스럽네요."},
      {min: 0, en: "Oh dear, oh dear. I shall have to make a note of this.", ko: "어머, 어머. 이건 기록해 둬야겠어요."}
    ],
    learned: {en: "New material, approved by the Ministry. Learn it properly.", ko: "마법부가 승인한 새 내용이에요. 제대로 익히세요."},
    empty: {en: "Nothing to inspect today. How unusual.", ko: "오늘은 조사할 게 없군요. 별일이네요."}
  },
  dumbledore: {
    tiers: [
      {min: 1, en: "Remarkable. You have surprised even an old man.", ko: "놀랍군. 늙은이마저 놀라게 했네."},
      {min: 0.75, en: "Very well done. Knowledge, like a good tea, wants time to steep.", ko: "아주 잘했네. 지식은 좋은 차처럼 우러날 시간이 필요하지."},
      {min: 0.45, en: "A respectable effort. Tomorrow will be kinder, I suspect.", ko: "꽤 괜찮은 노력이었네. 내일은 자네에게 좀 더 너그러울 걸세."},
      {min: 0, en: "Not your day, perhaps. But days, happily, are plentiful.", ko: "오늘은 자네 날이 아니었나 보군. 다행히 날은 많다네."}
    ],
    learned: {en: "New words to carry with you. Carry them gently.", ko: "가지고 갈 새 단어들이네. 소중히 지니고 가게."},
    empty: {en: "Nothing to review. Shall we simply enjoy the quiet?", ko: "복습할 것이 없군. 고요함이나 즐겨 볼까?"}
  },
  slughorn: {
    tiers: [
      {min: 1, en: "Perfect! Simply perfect! You must come to one of my suppers.", ko: "완벽해! 그야말로 완벽해! 내 만찬에 꼭 와야겠군."},
      {min: 0.75, en: "Excellent work! I do so enjoy a talented student.", ko: "훌륭해! 재능 있는 학생을 보는 건 언제나 즐겁다네."},
      {min: 0.45, en: "Not bad, not bad! There's promise here, I can tell.", ko: "나쁘지 않아, 나쁘지 않아! 싹수가 보이는군, 내 눈은 못 속이지."},
      {min: 0, en: "Oh, dear me. Well, tomorrow's another brew!", ko: "아이고. 뭐, 내일은 또 새로 끓이면 되지!"}
    ],
    learned: {en: "New ingredients for you, my dear! Savour them.", ko: "새 재료들이네! 음미해 보게."},
    empty: {en: "Nothing on the menu today. A rare treat!", ko: "오늘은 메뉴가 없군. 귀한 날이야!"}
  }
};

export const EXTRA = {
  snape: [
    {min: 1, en: "All of them. Perhaps you were paying attention after all.", ko: "전부 맞혔군. 수업을 듣긴 들었나 보지."},
    {min: 0.6, en: "Some of it stuck. Not enough.", ko: "일부는 남았군. 충분치는 않아."},
    {min: 0, en: "You learnt nothing. The misses return tomorrow.", ko: "아무것도 안 배웠군. 틀린 건 내일 다시 나온다."}
  ],
  mcgonagall: [
    {min: 1, en: "Every one, unprompted. Excellent.", ko: "하나도 빠짐없이, 도움 없이 해냈다. 훌륭해."},
    {min: 0.6, en: "Respectable. Review the ones you missed.", ko: "괜찮다. 틀린 것들은 다시 봐라."},
    {min: 0, en: "You were not ready. Revise, then try again.", ko: "준비가 덜 됐다. 복습하고 다시 해라."}
  ],
  lupin: [
    {min: 1, en: "Perfect. That took real work.", ko: "완벽해. 정말 노력했구나."},
    {min: 0.6, en: "More right than wrong. That's progress.", ko: "틀린 것보다 맞은 게 많아. 그게 발전이야."},
    {min: 0, en: "A tough round. The missed ones will come back gently.", ko: "어려운 판이었지. 틀린 건 다시 천천히 나올 거야."}
  ],
  moody: [
    {min: 1, en: "Not a scratch on you. Good.", ko: "상처 하나 없군. 좋아."},
    {min: 0.6, en: "You survived. Barely.", ko: "살아남았군. 간신히."},
    {min: 0, en: "Ambushed and beaten. Back to training!", ko: "기습당하고 졌다. 훈련으로 복귀!"}
  ],
  umbridge: [
    {min: 1, en: "Flawless, dear. I may even mention it to the Minister.", ko: "흠잡을 데 없네요, 얘야. 장관님께 말씀드릴 수도 있겠어요."},
    {min: 0.6, en: "Satisfactory. For now.", ko: "만족스럽군요. 지금은요."},
    {min: 0, en: "Hem, hem. This will go in my report.", ko: "흠, 흠. 이건 내 보고서에 들어가겠군요."}
  ],
  dumbledore: [
    {min: 1, en: "Every one. I am, I confess, delighted.", ko: "전부 맞혔군. 고백하건대 기쁘네."},
    {min: 0.6, en: "A good showing. The rest will follow.", ko: "잘 해냈네. 나머지는 따라올 걸세."},
    {min: 0, en: "A difficult test. Difficult things are worth returning to.", ko: "어려운 시험이었지. 어려운 것일수록 다시 볼 가치가 있지."}
  ],
  slughorn: [
    {min: 1, en: "Full marks! Outstanding!", ko: "만점! 탁월해!"},
    {min: 0.6, en: "Jolly good show!", ko: "아주 잘했어!"},
    {min: 0, en: "Ah well, can't win them all, eh?", ko: "뭐, 늘 이길 순 없지, 응?"}
  ]
};
/* a line for this deck's professor: decks without their own lines borrow Snape's */
export const voiceOf = id => ({react: REACT[id] || REACT.snape, remarks: REMARKS[id] || REMARKS.snape, extra: EXTRA[id] || EXTRA.snape});

/* First visit: you choose ONE classroom to begin with. Each professor says a word at their door, in their own voice
   (no film, personality or line count shown — 2026-10-04 user decision). */
export const FIRST = {
  snape: {en: "You may choose. Choose carefully. I have little patience for those who change their minds.", ko: "골라도 좋다. 신중하게 골라라. 마음을 바꾸는 자에게 내줄 인내심은 별로 없다."},
  mcgonagall: {en: "There is no shame in beginning somewhere sensible. Mine, for instance.", ko: "분별 있는 곳에서 시작하는 건 부끄러운 일이 아니다. 예를 들면 내 교실이라든가."},
  lupin: {en: "Come in whenever you're ready. There's chocolate, and the kettle is always on.", ko: "준비되면 언제든 들어오렴. 초콜릿도 있고, 주전자는 늘 끓고 있단다."},
  moody: {en: "This door. Or don't. But decide. Standing about in corridors makes you a target.", ko: "이 문이다. 아니면 말고. 하지만 정해라. 복도에서 어슬렁대면 표적이 된다."},
  umbridge: {en: "Hem, hem. I do think you'll find my classroom the most orderly place to begin, dear.", ko: "흠, 흠. 시작하기엔 제 교실이 가장 질서 정연한 곳일 거예요, 얘야."},
  slughorn: {en: "Ah, a new face! Start with me, my dear, and I'll see you meet all the right people.", ko: "아, 새 얼굴이군! 나와 시작하게. 꼭 만나야 할 사람들은 내가 다 소개해 주지."},
  dumbledore: {en: "Every door here leads somewhere worth going. Mine merely has more sweets behind it.", ko: "여기 문은 모두 가 볼 만한 곳으로 이어진다네. 내 문 뒤에는 그저 사탕이 좀 더 많을 뿐이지."}
};

/* What each professor says when you try a door that is not open yet: in character, and plainly "not yet". */
export const LOCKED = {
  snape: [
    {en: "This door is closed. I trust even you can grasp what that means.", ko: "이 문은 닫혀 있다. 그게 무슨 뜻인지쯤은 너도 알아듣겠지."},
    {en: "Not today. Nor, I suspect, tomorrow.", ko: "오늘은 아니다. 내일도 아닐 것 같군."},
    {en: "Knocking louder will not improve your chances.", ko: "더 세게 두드린다고 네 가망이 나아지진 않는다."},
    {en: "Learn what you have already been given. Then we shall see.", ko: "이미 받은 것부터 익혀라. 그다음에 보자."},
    {en: "I am brewing. Go away.", ko: "약을 끓이는 중이다. 가라."}
  ],
  mcgonagall: [
    {en: "You are early. I shall send for you when you are expected.", ko: "너무 이르다. 올 때가 되면 내가 부르겠다."},
    {en: "Patience is a discipline, not a suggestion.", ko: "인내는 권고가 아니라 규율이다."},
    {en: "Twenty lines, then a key. That is the arrangement, and it is not open to debate.", ko: "대사 스무 개, 그다음에 열쇠. 그게 정해진 방식이고, 따질 일이 아니다."},
    {en: "Rattling the handle will not get you in. Earning a key will.", ko: "손잡이를 흔든다고 들어올 수 있는 게 아니다. 열쇠를 얻어야지."},
    {en: "I have a stack of essays to mark. Off you go.", ko: "채점할 과제가 산더미다. 가 봐라."}
  ],
  lupin: [
    {en: "Not tonight, I'm afraid. Come back when the moon is kinder.", ko: "오늘 밤은 안 되겠구나. 달이 좀 순해지면 다시 오렴."},
    {en: "Have some chocolate. The lesson can wait a little longer.", ko: "초콜릿이나 좀 먹으렴. 수업은 조금 더 기다려 줄 테니."},
    {en: "I'm still tidying up after the Grindylows. Give me a little while.", ko: "그린딜로들이 어질러 놓은 걸 아직 치우는 중이란다. 조금만 기다려 주렴."},
    {en: "There's no hurry. The best things are worth waiting for.", ko: "서두를 것 없단다. 좋은 건 기다릴 만한 가치가 있으니까."},
    {en: "Learn a few more lines in the other classrooms, then come back. I'll have the kettle on.", ko: "다른 교실에서 대사를 조금 더 익히고 다시 오렴. 주전자 올려 두고 기다리마."}
  ],
  moody: [
    {en: "Who sent you? Nobody comes through this door until I say so.", ko: "누가 보냈지? 내가 허락하기 전엔 아무도 이 문으로 못 들어와."},
    {en: "Not yet. Constant vigilance!", ko: "아직 아니다. 항상 경계하라!"},
    {en: "Step away from the door. Slowly.", ko: "문에서 떨어져. 천천히."},
    {en: "Earn a key. Then I'll check it for curses.", ko: "열쇠를 얻어 와. 그럼 저주 걸렸나 검사해 주지."},
    {en: "The eye can see you. Still no.", ko: "이 눈으로 다 보인다. 그래도 안 된다."}
  ],
  umbridge: [
    {en: "Hem, hem. I don't believe you have an appointment, dear.", ko: "흠, 흠. 약속을 잡은 기억은 없는데요, 얘야."},
    {en: "All in good time. The Ministry will decide when.", ko: "때가 되면요. 그때가 언제인지는 마법부가 정한답니다."},
    {en: "Do you have a signed permission slip, dear? No? What a pity.", ko: "서명된 허가증 있나요, 얘야? 없어요? 참 안됐네요."},
    {en: "Rules are rules. Twenty lines, then a key. I didn't write them, but I do enjoy them.", ko: "규칙은 규칙이에요. 대사 스무 개, 그다음에 열쇠. 내가 만든 건 아니지만, 아주 마음에 든답니다."},
    {en: "Knocking is rather rude, isn't it? We'll say no more about it. This time.", ko: "문을 두드리는 건 좀 무례하지 않나요? 이번엔 그냥 넘어가지요. 이번만요."}
  ],
  dumbledore: [
    {en: "Ah. I'm afraid the password has changed again. Do come back later.", ko: "아, 암호가 또 바뀌었나 보군. 나중에 다시 오게."},
    {en: "It is not yet time. But the right time, I find, always comes.", ko: "아직 때가 아니라네. 하지만 알맞은 때는 늘 오기 마련이지."},
    {en: "I'm in the middle of knitting a rather absorbing sock. Another time.", ko: "아주 빠져드는 양말을 뜨는 중이라네. 다음에 오게."},
    {en: "Even Fawkes waits for the right moment to burst into flame.", ko: "폭스조차 불꽃으로 타오를 알맞은 때를 기다린다네."},
    {en: "Keys have a habit of turning up when one is busy learning. Do try it.", ko: "열쇠란 열심히 배우고 있을 때 불쑥 나타나는 버릇이 있다네. 한번 해 보게."}
  ],
  slughorn: [
    {en: "Not yet, my dear, not yet! The invitations go out soon enough.", ko: "아직일세, 아직! 초대장은 곧 나갈 걸세."},
    {en: "Patience! Even crystallised pineapple takes its time.", ko: "참게나! 파인애플 설탕절임도 시간이 걸린다네."},
    {en: "The guest list is full this week, I'm afraid! Learn a few more lines and I'll squeeze you in.", ko: "이번 주는 손님 명단이 꽉 찼다네! 대사를 몇 개 더 익혀 오면 끼워 주지."},
    {en: "Every great talent waits for a proper introduction. Twenty lines, and I'll make room for you.", ko: "위대한 재능은 다 제대로 소개받을 때를 기다리는 법이지. 대사 스무 개면, 자네 자리를 마련해 두겠네."},
    {en: "I'm just putting my feet up. Do come back when there's a key in your pocket.", ko: "잠깐 발 좀 올리고 쉬는 중이라네. 주머니에 열쇠가 생기면 꼭 다시 오게."}
  ]
};
