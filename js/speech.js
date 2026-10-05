/* Read aloud with the browser's built-in en-GB voices only (no other accents, no outside services). */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
const listeners = new Set();

function refresh(){
  if (!synth) return;
  /* one entry per name: iPhones list the same voice twice (compact and enhanced). Keep the better one. */
  const rank = v => (/enhanced|premium/i.test(v.voiceURI) ? 2 : 0) + (v.localService ? 1 : 0);
  const best = new Map();
  synth.getVoices().filter(v => /^en[-_]GB/i.test(v.lang)).forEach(v => {
    const had = best.get(v.name);
    if (!had || rank(v) > rank(had)) best.set(v.name, v);
  });
  voices = [...best.values()];
  listeners.forEach(f => f(voices));
}
if (synth){
  refresh();
  if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', refresh);
  else synth.onvoiceschanged = refresh;
  setTimeout(refresh, 600);
}

export const supported = () => !!synth;
export const gbVoices = () => voices;
export const onVoices = f => { listeners.add(f); f(voices); };

export function speak(text, voiceName, onEnd, rate = .92){
  if (!synth || !voices.length){ if (onEnd) onEnd(false); return false; }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/--/g, ', '));
  u.voice = voices.find(v => v.name === voiceName) || voices.find(v => v.localService) || voices[0];
  u.lang = u.voice.lang;
  u.rate = rate;
  u.onend = () => onEnd && onEnd(true);
  u.onerror = () => onEnd && onEnd(false);
  synth.speak(u);
  return true;
}
export function stop(){ if (synth) synth.cancel(); }
