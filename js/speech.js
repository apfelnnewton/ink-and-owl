/* Read aloud with the browser's built-in en-GB voices only (no other accents, no outside services). */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
const listeners = new Set();

function refresh(){
  if (!synth) return;
  voices = synth.getVoices().filter(v => /^en[-_]GB/i.test(v.lang));
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
