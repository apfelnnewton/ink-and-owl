/* The caretaker's own devices keep one progress between them (2026-10-12, user decision): the workings, apart from the page
   so that they can be tried without a browser (docs/sync-test.mjs).
   On the server, readable and writable by the caretaker's devices only (firestore.rules):
     sync/head   {rev, n, z, size, at, by, dev}   the copy now held: its mark, how many parts, gzipped or not
     sync/p<i>   {rev, i, d}                      the parts of it (a document holds at most 1 MiB)
   A device, each time it matches (run):
     1. stamps what it has changed itself since it last matched (stars, purse, bag, hidden room — store.mergeData takes the more
        recently stamped copy of those whole, so that money spent or a thing found stays so);
     2. if the server's copy is not the one it last saw, fetches it and folds it into its own (store.mergeData);
     3. if it has changes of its own (or nothing is there yet), writes the folded progress back, under a new mark.
   A device that only received writes nothing, so two devices never bat the same copy back and forth.
   state.sync = {rev: the mark last seen, hash: the progress as it stood then, k: marks of the stamped things, at, size, err} */
const KEYS = ['stars', 'purse', 'shop', 'need'];
export const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v === undefined ? null : v);
export const hash = s => { let a = 0x811c9dc5, b = 0x1b873593; for (let i = 0; i < s.length; i++){ const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b + c, 0x85ebca6b) ^ (b >>> 13); } return (a >>> 0).toString(36) + '.' + (b >>> 0).toString(36) + '.' + s.length.toString(36); };

/* gzip where the browser can (a year of progress is then a fraction of one part); plain text where it cannot */
export async function pack(text){
  if (typeof CompressionStream !== 'function') return {z: 0, body: text};
  const buf = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return {z: 1, body: btoa(bin)};
}
export async function unpack(z, body){
  if (!z) return body;
  if (typeof DecompressionStream !== 'function') throw new Error('unzip');   // an old browser cannot read a gzipped copy
  const bin = atob(body), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

/* A day the register lost, put back: the day stands between two days that were studied and has no entry of its own (a lesson that ran
   past midnight is entered under the next day). It gets a mark and nothing else — no answers are invented for it, so the weekly figures
   stay what they were — and the days in a row are counted again. `at` = where most was studied the day before, for the seal in the
   register (records.js). → true if anything was put back. store: {get, mendStreak} */
const shift = (d, n) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const has = e => !!e && typeof e === 'object' && Object.keys(e).length > 0;
export function mendRegister(store, days, on){
  const s = store.get(), log = s.log || (s.log = {}); let did = false;
  for (const day of days){
    if (has(log[day]) || !has(log[shift(day, -1)]) || !has(log[shift(day, 1)])) continue;
    const top = Object.entries(log[shift(day, -1)]).filter(([k, v]) => k !== 'need' && v && typeof v.n === 'number').sort((a, b) => b[1].n - a[1].n)[0];
    log[day] = {mend: {d: on || '', at: top ? top[0] : ''}}; did = true;
  }
  if (did) store.mendStreak();
  return did;
}

/* store: {get, syncable, mergeData, mergedByJoining, save} · server: async () => {F, db, uid} · device: () => a short name of this device */
export function makeSync({store, server, device = () => '', part = 800000, plain = 250000}){
  const st = () => { const s = store.get(); return s.sync || (s.sync = {}); };
  const marks = () => { const s = store.get(), o = {}; for (const k of KEYS) o[k] = hash(canon(s[k] === undefined ? null : s[k])); return o; };
  const now = () => hash(canon(store.syncable()));
  let busy = false, head = null;
  /* → {ok, pulled, pushed, changed}: changed = what is on this device is no longer what the screens were drawn from */
  async function run(){
    if (busy) return {ok: false, busy: true};
    busy = true;
    const c = st(), out = {ok: false, pulled: false, pushed: false, changed: false};
    try {
      const {F, db, uid} = await server(), s = store.get(), first = !c.k;
      if (!first){ const m = marks(), stamp = s.stamp || (s.stamp = {}); for (const k of KEYS) if (m[k] !== c.k[k]) stamp[k] = Date.now(); }
      const before = now();
      let dirty = before !== c.hash;
      const hs = await F.getDoc(F.doc(db, 'sync', 'head')); head = hs.exists() ? hs.data() : null;
      if (head && head.rev !== c.rev){
        const parts = await Promise.all(Array.from({length: head.n}, (_, i) => F.getDoc(F.doc(db, 'sync', 'p' + i))));
        if (parts.some(p => !p.exists() || p.data().rev !== head.rev)) throw new Error('torn');   // read between another device's writes: next time
        const text = await unpack(head.z, parts.map(p => p.data().d).join(''));
        store.mergeData(text);   // an empty copy is refused there and changes nothing
        if (store.mergedByJoining()) dirty = true;   // two copies of something were joined: the other device has not seen the result
        c.rev = head.rev; out.pulled = true; out.changed = now() !== before;
      }
      if (first){ const stamp = s.stamp || (s.stamp = {}); for (const k of KEYS) if (!stamp[k]) stamp[k] = 1; }   // from here on, changes are told apart by their stamps
      if (dirty || !head || first){
        const text = JSON.stringify(store.syncable()), p = await pack(text), size = p.z ? part : plain, n = Math.max(1, Math.ceil(p.body.length / size));
        const rev = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), batch = F.writeBatch(db);
        for (let i = 0; i < n; i++) batch.set(F.doc(db, 'sync', 'p' + i), {rev, i, d: p.body.slice(i * size, (i + 1) * size)});
        for (let i = n; i < (head ? head.n : 0); i++) batch.delete(F.doc(db, 'sync', 'p' + i));
        const h = {rev, n, z: p.z, size: p.body.length, at: F.serverTimestamp(), by: uid, dev: String(device() || '').slice(0, 20)};
        batch.set(F.doc(db, 'sync', 'head'), h);
        await batch.commit();
        c.rev = rev; c.size = p.body.length; head = {...h, at: null, mine: true}; out.pushed = true;
      }
      c.hash = now(); c.k = marks(); c.at = Date.now(); delete c.err;
      store.save();
      out.ok = true;
    } catch (e){
      c.err = /permission|insufficient/i.test(String(e && e.code || '') + String(e && e.message || '')) ? 'denied' : e && e.message === 'unzip' ? 'unzip' : 'net';
      try { store.save(); } catch (x){}
    } finally { busy = false; }
    return out;
  }
  return {run, state: st, head: () => head, busy: () => busy};
}
