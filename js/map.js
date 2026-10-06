/* The Marauder's Map (#/map, 2026-10-06 user decision, docs/plan-map.md). On the fifth day of study Lupin sends it
   (one letter if the learner has studied with him, another if they have not met). It opens as a blank parchment:
   the learner writes or says "I solemnly swear that I am up to no good." and ink spreads into the castle plan (a clip,
   assets/map/reveal.mp4); a wrong sentence is answered by one of the four makers, in turn. On the plan: the places
   in use are clear and named in English, the rest lies under a blur of ink (rooms to come are revealed by taking the
   fog off there — the picture never needs redrawing); other places are folds of the map (the first: Diagon Alley,
   with Ollivanders, once there is a wand). Ink footprints walk from the Guest Tower through the classrooms each friend
   studied in today, in order, and stop with their name at the last; a friend who has not studied today sleeps in the
   tower. Mine too. "Mischief managed." wipes it.
   state.map = {got: date, v: 'met'|'new'} · each friend's day comes from their seal (post.js: day {d, rooms}). */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as post from './post.js';
import * as speech from './speech.js';
import * as wand from './wand.js';
import {byId} from './decks.js';
import {$, esc, toast, reduced, wait} from './ui.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const OPEN = 'I solemnly swear that I am up to no good.', CLOSE = 'Mischief managed.';
const STUDY_DAYS = 5;

/* the letters (Lupin's voice: warm 반말 with -렴/-단다) */
export const LETTERS = {
  met: {en: "{name}, five days of study. I confess I have been counting. I have something for you: I once had to take it from a student, and I gave it back in the end. It looks like a blank piece of parchment. Tap it with your wand and tell it, honestly, what you are up to. The words, if I remember them rightly, are: I solemnly swear that I am up to no good.\nDo keep it out of Severus's way.",
    ko: '{name}, 공부한 지 닷새째구나. 사실 나도 세고 있었단다. 너에게 줄 게 하나 있어. 예전에 한 학생에게서 빼앗았다가 결국 돌려준 물건이야. 보기엔 그냥 빈 양피지지. 지팡이로 톡 건드리고, 네가 무슨 꿍꿍이인지 솔직하게 말해 보렴. 내 기억이 맞다면 그 말은 이렇단다. I solemnly swear that I am up to no good.\n세베루스 눈에는 띄지 않게 하렴.'},
  new: {en: "Dear {name},\nWe have not met yet, though I hope we shall. Word travels in this castle, and word has it you have studied for five days. I enclose something I helped to make a long time ago, with three friends, when we were younger and a good deal less sensible. It looks like an old piece of parchment. It is not. Say to it: I solemnly swear that I am up to no good.\nUse it kindly.\nRemus Lupin",
    ko: '{name}에게.\n우리는 아직 만난 적이 없지만, 언젠가 만나길 바란단다. 이 성에서는 소문이 빨라서, 네가 닷새째 공부하고 있다는 얘기가 내 귀에도 들어왔어. 아주 오래전 친구 셋과 함께 만든 물건을 하나 보낸다. 그때 우리는 어렸고, 지금보다 훨씬 철이 없었지. 보기엔 낡은 양피지 같지만 그렇지 않단다. 이렇게 말해 보렴. I solemnly swear that I am up to no good.\n다정하게 써 주렴.\n리머스 루핀'}
};
/* the makers, when the sentence is wrong — in turn, one line each time */
const TEASE = [
  {en: 'Mr Moony regrets to inform the reader that this is not the password, and suggests a second attempt.', ko: '무니 씨는 안타깝게도 그건 암호가 아님을 알려 드리며, 한 번 더 해 보시길 권합니다.'},
  {en: 'Mr Wormtail agrees with Mr Moony, and would like it noted that he agreed first.', ko: '웜테일 씨는 무니 씨 말에 동의하며, 자기가 먼저 동의했다는 걸 적어 두고 싶어 합니다.'},
  {en: 'Mr Padfoot is unimpressed, and wonders whether the reader has ever broken a single rule.', ko: '패드풋 씨는 감흥이 없으며, 읽는 분이 규칙을 하나라도 어겨 본 적이 있는지 궁금해합니다.'},
  {en: 'Mr Prongs is willing to overlook that attempt, but only just.', ko: '프롱스 씨는 방금 시도를 눈감아 줄 생각이 있습니다. 아슬아슬하게요.'},
  {en: 'Mr Moony notes that the reader seems a decent sort, which is precisely the problem.', ko: '무니 씨는 읽는 분이 꽤 착실한 사람 같다고 적어 둡니다. 바로 그게 문제입니다.'},
  {en: 'Mr Wormtail suspects the reader of being thoroughly well-behaved, and finds it rather alarming.', ko: '웜테일 씨는 읽는 분이 아주 얌전한 사람이 아닐까 의심하며, 그게 꽤 무섭다고 합니다.'},
  {en: 'Mr Padfoot has been more convinced by a wet sock.', ko: '패드풋 씨는 젖은 양말에게 더 설득된 적이 있습니다.'},
  {en: 'Mr Prongs observes that solemn swearing requires, at the very least, the correct words.', ko: '프롱스 씨는 엄숙한 맹세에는 적어도 정확한 말이 필요하다고 지적합니다.'},
  {en: 'Mr Moony would remind the reader that this parchment answers only to those with mischief in mind.', ko: '무니 씨는 이 양피지가 장난칠 마음이 있는 사람에게만 응한다는 걸 일깨워 드립니다.'},
  {en: 'Mr Wormtail would simply like to know who is asking.', ko: '웜테일 씨는 그저 누가 묻는 건지 알고 싶을 뿐입니다.'},
  {en: 'Mr Padfoot advises the reader to try again, with rather more feeling and a great deal less virtue.', ko: '패드풋 씨는 감정은 좀 더 싣고 착한 척은 훨씬 덜 해서 다시 해 보라고 권합니다.'},
  {en: "Mr Prongs suggests the reader ask a professor. No, on second thoughts, please don't.", ko: '프롱스 씨는 교수님께 여쭤보라고 권합니다. 아니, 다시 생각해 보니 제발 그러지 마십시오.'}
];
/* the places, in fractions of the picture (assets/map/castle.webp, 1520 × 2688); the clear ones keep the fog away */
const CASTLE = {
  guest: {x: .48, y: .082, en: 'The Guest Tower', ko: '손님 탑 · 각자의 방'},
  dumbledore: {x: .79, y: .182, en: "The Headmaster's Study", ko: '교장실 · 덤블도어'},
  mcgonagall: {x: .70, y: .305, en: 'Transfiguration', ko: '변신술 교실 · 맥고나걸'},
  moody: {x: .12, y: .145, en: "Professor Moody's Office", ko: '무디 교수 연구실'},
  umbridge: {x: .67, y: .455, en: "Professor Umbridge's Office", ko: '엄브리지 교수 사무실'},
  hall: {x: .45, y: .52, en: 'The Great Hall', ko: '대연회장'},
  lupin: {x: .17, y: .575, en: 'Defence Against the Dark Arts', ko: '어둠의 마법 방어술 교실 · 루핀'},
  owlery: {x: .93, y: .655, en: 'The Owlery', ko: '부엉이장'},
  slughorn: {x: .735, y: .815, en: "Professor Slughorn's Office", ko: '슬러그혼 교수 연구실'},
  snape: {x: .45, y: .935, en: 'The Potions Dungeon', ko: '지하 마법약 교실 · 스네이프'}
};
/* the Painted Gallery: the hidden room the Daily Prophet's serial finds (prophet.js, issue 12) — its fog lifts once the
   twelfth paper has come; tapping it opens that issue */
const GALLERY = {x: .33, y: .335, en: 'The Painted Gallery', ko: '그림 화랑 · 예언자 일보 12호'};
const galleryOpen = () => ((store.get().prophet || {}).got || []).some(i => i.n === 12);
const placesOf = f => f.id === 'castle' && galleryOpen() ? {...f.places, gallery: GALLERY} : f.places;
const DIAGON = {ollivander: {x: .55, y: .085, en: 'Ollivanders', ko: '올리밴더 가게'}};
const FOLDS = [{id: 'castle', en: 'Hogwarts', ko: '호그와트', img: 'assets/map/castle.webp', places: CASTLE},
  {id: 'diagon', en: 'Diagon Alley', ko: '다이애건 앨리', img: 'assets/map/diagon.webp', places: DIAGON, need: () => !!wand.get()}];

/* ---------- when it comes */
const st = () => { const s = store.get(); return s.map || (s.map = {}); };
export const have = () => !!st().got;
export const got = () => st().got || '';
const studyDays = () => Object.keys(store.get().log || {}).filter(d => Object.keys(store.get().log[d] || {}).length).length;
export async function daily(){
  if (have() || studyDays() < STUDY_DAYS) return false;
  await bond.load('lupin');
  const s = st(); s.v = bond.bondOf('lupin').days > 0 ? 'met' : 'new';
  if (!bond.postItem('lupin', 'MAP')) return false;
  s.got = srs.today();
  store.save();
  return true;
}
export function textOf(prof, key){
  if (prof !== 'lupin' || key !== 'MAP') return null;
  return {kind: '편지 · 지도', ...LETTERS[st().v || 'met'], map: true};
}

/* ---------- today's rooms: mine from the register (the order lessons were first opened in), friends' from their seals */
export const myRooms = () => Object.keys((store.get().log || {})[srs.today()] || {}).filter(id => byId(id));
/* told to the group whenever today's list changes (post.js keeps it on my seal) */
let told = '';
export function share(){ const r = srs.today() + myRooms().join(); if (r === told) return; told = r; post.shareDay(myRooms()); }
/* every answer: a classroom opened for the first time today goes onto my seal */
srs.hooks.push(() => { if (have()) share(); });

/* the sentence, compared leniently: letters only, a slip or two allowed (speech is not perfect) */
const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
function close(a, b){
  a = norm(a); b = norm(b); if (a === b) return true;
  if (Math.abs(a.length - b.length) > 3) return false;
  const d = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] <= 3;
}

/* ---------- the screen */
export function initMap(app){
  const sec = $('#map'), sheet = $('#mpSheet'), img = $('#mpImg'), fog = $('#mpFog'), steps = $('#mpSteps'), tags = $('#mpTags');
  let fold = FOLDS[0], tease = 0, wrong = 0, raf = 0, rec = null, opened = false, people = [];

  /* the blank parchment and the sentence that wakes it */
  function sealed(){
    opened = false; cancelAnimationFrame(raf);
    sec.classList.remove('open', 'closing');
    img.src = 'assets/map/blank.webp'; fog.hidden = true; steps.hidden = true; tags.innerHTML = '';
    $('#mpFolds').hidden = true;
    $('#mpWords').innerHTML = '';
    ask('open');
  }
  function ask(which){
    const open = which === 'open';
    $('#mpForm').dataset.want = which;
    $('#mpHint').textContent = open ? '지도를 깨우는 문장을 쓰거나 말하세요' : '지도를 닫는 말을 쓰거나 말하세요';
    $('#mpIn').value = ''; $('#mpIn').placeholder = open ? 'I solemnly swear…' : 'Mischief…';
    $('#mpPeek').hidden = !(open && wrong >= 2);
    $('#mpBar').classList.toggle('closing', !open);
  }
  function answer(text){
    const want = $('#mpForm').dataset.want;
    if (want === 'open'){
      if (close(text, OPEN)){ reveal(); return; }
      wrong++;
      const t = TEASE[tease++ % TEASE.length];
      write(`<p class="en" lang="en">${esc(t.en)}</p><p class="ko">${esc(t.ko)}</p>`);
      $('#mpPeek').hidden = wrong < 2;
    } else {
      if (close(text, CLOSE)){ wipe(); return; }
      toast('<span class="q" lang="en">Mischief managed.</span><span class="k">이 말을 쓰거나 말하면 지도가 닫힙니다.</span>', 2600, true);
    }
  }
  /* the makers' words appear in ink on the parchment */
  function write(html){
    const w = $('#mpWords'); w.innerHTML = html; w.classList.remove('in'); void w.offsetWidth; w.classList.add('in');
  }
  async function reveal(){
    $('#mpWords').innerHTML = ''; wrong = 0;
    speech.speak(OPEN, store.get().settings.voice, null, .9);
    share();
    if (!reduced()){
      const v = $('#mpVid'); v.hidden = false; v.currentTime = 0;
      await new Promise(res => { v.onended = res; v.onerror = res; v.play().catch(res); setTimeout(res, 6500); });
    }
    showFold(FOLDS[0]);
    $('#mpVid').hidden = true;
  }
  async function wipe(){
    sec.classList.add('closing');
    speech.speak(CLOSE, store.get().settings.voice, null, .9);
    await wait(reduced() ? 0 : 1600);
    sealed();
  }

  /* a fold of the map: the picture, the fog with its clear places, the names, and the footprints */
  function showFold(f){
    fold = f; opened = true;
    sec.classList.add('open'); sec.classList.remove('closing');
    img.src = f.img;
    $('#mpFolds').hidden = false;
    $('#mpFolds').innerHTML = FOLDS.filter(x => !x.need || x.need()).map(x => `<button type="button" data-fold="${x.id}" class="${x.id === f.id ? 'on' : ''}"><span lang="en">${x.en}</span><small>${x.ko}</small></button>`).join('');
    ask('close');
    const ready = () => { drawFog(); placeTags(); startSteps(); };
    if (img.complete && img.naturalWidth) ready(); else img.onload = ready;
  }
  function box(){ const r = sheet.getBoundingClientRect(); return {w: r.width, h: r.height}; }
  function drawFog(){
    const {w, h} = box(), dpr = Math.min(2, devicePixelRatio || 1), x = fog.getContext('2d');
    fog.hidden = false; fog.width = w * dpr; fog.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* the plan itself, blurred and washed over with paper colour and a few blots of ink */
    x.filter = 'blur(5px) sepia(.35)'; x.drawImage(img, 0, 0, w, h); x.filter = 'none';
    x.fillStyle = 'rgba(214,186,138,.5)'; x.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++){ const cx = rnd() * w, cy = rnd() * h, r = 30 + rnd() * 90, g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(70,45,22,${.08 + rnd() * .1})`); g.addColorStop(1, 'rgba(70,45,22,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
    /* the places in use: soft clear holes */
    x.globalCompositeOperation = 'destination-out';
    const r0 = Math.min(w, h) * .16;
    Object.values(placesOf(fold)).forEach(p => { const cx = p.x * w, cy = p.y * h, g = x.createRadialGradient(cx, cy, r0 * .35, cx, cy, r0);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r0, cy - r0, r0 * 2, r0 * 2); });
    x.globalCompositeOperation = 'source-over';
  }
  function placeTags(){
    tags.innerHTML = Object.entries(placesOf(fold)).map(([id, p]) =>
      `<button type="button" class="mp-tag${p.x < .22 ? ' l' : p.x > .78 ? ' r' : ''}" data-place="${id}" style="left:${p.x * 100}%;top:${p.y * 100}%"><span lang="en">${esc(p.en)}</span></button>`).join('') +
      (galleryOpen() ? '' : '<span class="mp-unrevealed" style="left:30%;top:33%" lang="en">Not yet revealed</span>') + '<span class="mp-unrevealed" style="left:64%;top:72%" lang="en">Not yet revealed</span>';
    if (fold.id !== 'castle') return;
    tags.insertAdjacentHTML('beforeend', people.map((p, i) => `<button type="button" class="mp-who${p.rooms.length ? '' : ' asleep'}" data-who="${i}" id="mpWho${i}"><span lang="en">${esc(p.name)}</span>${p.rooms.length ? '' : '<i aria-hidden="true">zzz</i>'}</button>`).join(''));
  }

  /* ---------- the people and their footprints */
  function gather(){
    const me = {name: store.get().settings.firstName || 'You', rooms: myRooms(), me: true};
    const friends = post.inGroup() ? post.members().map(m => ({name: m.name, rooms: m.day && m.day.d === srs.today() ? (m.day.rooms || []).filter(id => CASTLE[id]) : []})) : [];
    if (post.isPractice() || post.practiceMode()){
      const demo = [['snape', 'mcgonagall'], [], ['lupin', 'dumbledore', 'slughorn']];
      friends.forEach((f, i) => { if (!f.rooms.length) f.rooms = demo[i % demo.length]; });
    }
    people = [me, ...friends];
  }
  /* the corridors (2026-10-06: straight lines walked through walls): points along the passages, courtyards, halls and
     stairs of the picture, joined where one can walk; a walk goes the shortest way along them. A new room only needs
     its door joined to the nearest point. */
  const NODES = {
    gt: [.47, .13], top: [.47, .21], topL: [.30, .21], mdy: [.18, .185], topR: [.62, .21], dd: [.74, .205],
    ctr: [.47, .30], tf: [.60, .30], ctrS: [.46, .385], hallN: [.45, .435], hall: [.44, .52], hallS: [.45, .625],
    hallW: [.31, .52], L1: [.225, .23], L2: [.225, .38], L3: [.225, .52], L4: [.225, .575],
    R1: [.585, .385], R2: [.585, .455], R3: [.585, .63], um: [.60, .455], E1: [.76, .64], br: [.85, .665],
    low: [.45, .70], gate: [.45, .795], stair: [.45, .86], sw: [.58, .81], se: [.66, .815]
  };
  const EDGES = 'gt-top top-topL topL-mdy top-topR topR-dd top-ctr ctr-tf topR-tf ctr-ctrS ctrS-hallN hallN-hall hall-hallS hall-hallW hallW-L3 ' +
    'topL-L1 L1-L2 L2-L3 L3-L4 L2-ctrS ctrS-R1 R1-R2 R2-um R2-R3 R3-hallS R3-E1 E1-br hallS-low low-gate gate-stair gate-sw sw-se';
  /* which point each place is reached from */
  const DOOR = {guest: 'gt', moody: 'mdy', dumbledore: 'dd', mcgonagall: 'tf', hall: 'hall', lupin: 'L4', umbridge: 'um', owlery: 'br', slughorn: 'se', snape: 'stair'};
  const ADJ = {};
  EDGES.split(' ').forEach(e => { const [a, b] = e.split('-'); (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a); });
  const far = (a, b) => Math.hypot(NODES[a][0] - NODES[b][0], (NODES[a][1] - NODES[b][1]) * 1.77);
  function shortest(a, b){
    const d = {[a]: 0}, prev = {}, todo = new Set(Object.keys(NODES));
    while (todo.size){
      let u = null; todo.forEach(n => { if (d[n] !== undefined && (u === null || d[n] < d[u])) u = n; });
      if (u === null || u === b) break;
      todo.delete(u);
      (ADJ[u] || []).forEach(v => { const nd = d[u] + far(u, v); if (d[v] === undefined || nd < d[v]){ d[v] = nd; prev[v] = u; } });
    }
    const path = [b]; while (path[0] !== a && prev[path[0]]) path.unshift(prev[path[0]]);
    return path[0] === a ? path : [a, b];
  }
  /* the walk of the day: out of the Guest Tower, through each classroom in turn, ending in the last */
  function route(p){
    const stops = ['guest', ...p.rooms];
    const pts = [[CASTLE.guest.x, CASTLE.guest.y]];
    for (let k = 1; k < stops.length; k++){
      const path = shortest(DOOR[stops[k - 1]], DOOR[stops[k]]);
      path.forEach(n => pts.push(NODES[n]));
      pts.push([CASTLE[stops[k]].x, CASTLE[stops[k]].y]);
    }
    return pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
  }
  /* footprints: each friend walks the day once, the prints fading behind, and stops at the last classroom with a
     few prints left at the door; tapping the name walks it again */
  let walkers = [];
  function startSteps(){
    cancelAnimationFrame(raf);
    if (fold.id !== 'castle'){ steps.hidden = true; return; }
    const {w, h} = box(), dpr = Math.min(2, devicePixelRatio || 1), x = steps.getContext('2d');
    steps.hidden = false; steps.width = w * dpr; steps.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const STEP = Math.max(8, w * .022), PACE = .34, LIFE = 4.5, KEEP = 3;   // an unhurried walk (2026-10-06)
    walkers = people.map((p, i) => {
      const off = [(i % 3 - 1) * 5, (i % 2 ? 4 : -4)];
      const pts = route(p).map(q => [q[0] * w + off[0], q[1] * h + off[1]]);
      const fs = [];
      for (let k = 1; k < pts.length; k++){
        const [ax, ay] = pts[k - 1], [bx, by] = pts[k], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / STEP)), ang = Math.atan2(by - ay, bx - ax);
        for (let j = 0; j < n; j++){ const t = j / n, side = fs.length % 2 ? 1 : -1;
          fs.push({x: ax + (bx - ax) * t - Math.sin(ang) * side * STEP * .22, y: ay + (by - ay) * t + Math.cos(ang) * side * STEP * .22, a: ang}); }
      }
      /* everyone walks at their own pace, the same each time (from the name): from brisk to dawdling */
      let hsh = 7; for (const ch of p.name) hsh = (hsh * 31 + ch.charCodeAt(0)) % 997;
      return {p, pts, fs, el: $('#mpWho' + i), start: performance.now() + i * 900, pace: PACE * (.78 + (hsh % 100) / 100 * .5)};
    });
    const foot = (f, alpha) => {
      x.save(); x.translate(f.x, f.y); x.rotate(f.a + Math.PI / 2); x.globalAlpha = alpha; x.fillStyle = '#3B2414';
      const s = STEP / 12;
      x.beginPath(); x.ellipse(0, 1.5 * s, 2.1 * s, 3.4 * s, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(0, -3.6 * s, 1.5 * s, 1.5 * s, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    };
    const place = (el, [px, py]) => { if (el){ el.style.left = px + 'px'; el.style.top = py + 'px'; } };
    const end = wk => wk.pts[wk.pts.length - 1];
    /* ?mapdebug: the corridor points and joins, in red, for placing them */
    if (/[?&]mapdebug/.test(location.search)){ steps.style.zIndex = 5; x.strokeStyle = 'rgba(220,0,0,.7)'; x.fillStyle = 'red'; x.lineWidth = 2;
      EDGES.split(' ').forEach(e => { const [p, q] = e.split('-'); x.beginPath(); x.moveTo(NODES[p][0] * w, NODES[p][1] * h); x.lineTo(NODES[q][0] * w, NODES[q][1] * h); x.stroke(); });
      Object.entries(NODES).forEach(([k, v]) => { x.fillRect(v[0] * w - 2, v[1] * h - 2, 4, 4); x.fillText(k, v[0] * w + 3, v[1] * h - 3); }); return; }
    if (reduced()){ walkers.forEach(wk => { place(wk.el, end(wk)); wk.fs.slice(-KEEP).forEach(f => foot(f, .8)); }); return; }
    const frame = now => {
      x.clearRect(0, 0, w, h);
      let moving = false;
      walkers.forEach(wk => {
        if (!wk.fs.length){ place(wk.el, wk.pts[0]); return; }   // asleep in the tower
        const t = (now - wk.start) / 1000, n = wk.fs.length, walked = t / wk.pace;
        if (t < 0){ place(wk.el, wk.pts[0]); moving = true; return; }
        wk.fs.forEach((f, k) => {
          const age = t - k * wk.pace; if (age < 0) return;
          /* the last few prints stay at the door; the rest fade */
          const stay = k >= n - KEEP && walked >= n;
          const a = stay ? .85 : age < LIFE ? Math.min(1, age * 5) * (1 - age / LIFE) : 0;
          if (a > 0) foot(f, a);
        });
        if (walked < n){ moving = true; const f = wk.fs[Math.floor(walked)]; place(wk.el, [f.x, f.y]); }
        else { place(wk.el, end(wk)); if (t < n * wk.pace + LIFE) moving = true; }
      });
      if (moving) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  /* tap a name: that walk again */
  function replay(i){
    const wk = walkers[i]; if (!wk || !wk.fs.length || reduced()) return;
    startSteps(); walkers.forEach((w2, k) => { w2.start = k === i ? performance.now() : -1e9; });
  }

  /* ---------- talking to the parchment */
  function listen(){
    if (!SR) return; if (rec){ rec.stop(); return; }
    let text = ''; const m = $('#mpMic'); m.classList.add('on');
    rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = false;
    rec.onresult = e => { text = [...e.results].map(r => r[0].transcript).join(' '); };
    rec.onerror = () => {};
    rec.onend = () => { rec = null; m.classList.remove('on'); if (text){ $('#mpIn').value = text; answer(text); } else toast('들리지 않았습니다. 다시 말하거나 써 주세요.'); };
    try { rec.start(); } catch (e){ rec = null; m.classList.remove('on'); }
  }

  /* ---------- events */
  $('#mpForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#mpIn').value.trim(); if (v) answer(v); });
  $('#mpMic').hidden = !SR;
  $('#mpMic').addEventListener('click', listen);
  $('#mpPeek').addEventListener('click', () => write(`<p class="en" lang="en">${esc(OPEN)}</p><p class="ko">루핀의 편지에 적힌 문장 · 나는 못된 짓을 꾸미고 있음을 엄숙히 맹세한다.</p>`));
  $('#mpFolds').addEventListener('click', e => { const b = e.target.closest('[data-fold]'); if (b) showFold(FOLDS.find(f => f.id === b.dataset.fold)); });
  tags.addEventListener('click', e => {
    const t = e.target.closest('[data-place]');
    if (t){ const p = placesOf(fold)[t.dataset.place]; if (t.dataset.place === 'ollivander'){ app.go('#/me/wand'); return; } if (t.dataset.place === 'gallery'){ app.go('#/prophet/12'); return; } toast(`<span class="q" lang="en">${esc(p.en)}</span><span class="k">${esc(p.ko)}</span>`, 2400, true); return; }
    const w = e.target.closest('[data-who]');
    if (w){ const p = people[+w.dataset.who];
      const en = p.rooms.length ? `${p.name} · Today: ${p.rooms.map(id => byId(id).who.replace(/^Professor /, '').replace(/^Alastor /, '')).join(' → ')}` : `${p.name} · Asleep in the Guest Tower`;
      const ko = p.rooms.length ? `오늘: ${p.rooms.map(id => byId(id).ko.replace(/ 교수$/, '')).join(' → ')}` : '손님 탑에서 자는 중';
      toast(`<span class="q" lang="en">${esc(en)}</span><span class="k">${esc(ko)}</span>`, 3200, true); replay(+w.dataset.who); }
  });
  $('#mpBack').addEventListener('click', () => { speech.stop(); history.length > 1 ? history.back() : app.go('#/me'); });

  function show(){
    if (!have()){ app.go('#/me', true); return; }
    gather();
    tease = 0; wrong = 0;
    sealed();
    setTimeout(() => $('#mpIn').focus({preventScroll: true}), 300);
  }
  return {show, hide: () => { cancelAnimationFrame(raf); if (rec){ try { rec.abort(); } catch (e){} rec = null; } speech.stop(); },
    resize: () => { if (opened){ drawFog(); placeTags(); startSteps(); } }};
}
