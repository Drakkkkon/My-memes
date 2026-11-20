// Мое_мемы — локальная база сайта (IndexedDB) + избранное (localStorage)
const DB = (() => {
  const NAME = 'moe_memy', VER = 2, STORE = 'saved', FEEDS = 'feeds';
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(FEEDS)) db.createObjectStore(FEEDS, { keyPath: 'key' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn, store) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store || STORE, mode);
      const st = t.objectStore(store || STORE);
      const out = fn(st);
      t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  }
  return {
    put: (item) => tx('readwrite', st => st.put(item)),
    del: (id) => tx('readwrite', st => st.delete(id)),
    get: (id) => tx('readonly', st => st.get(id)),
    all: async () => {
      const list = await tx('readonly', st => st.getAll());
      return (list || []).sort((a, b) => b.created - a.created);
    },
    // кеш лент мемов
    feedGet: (key) => tx('readonly', st => st.get(key), FEEDS),
    feedPut: (f) => tx('readwrite', st => st.put(f), FEEDS),
    feedClear: () => tx('readwrite', st => st.clear(), FEEDS),
    async feedStats() {
      const all = await tx('readonly', st => st.getAll(), FEEDS) || [];
      return { feeds: all.length, memes: all.reduce((n, f) => n + (f.items ? f.items.length : 0), 0) };
    },
    async feedTrim(max) {
      const all = await tx('readonly', st => st.getAll(), FEEDS) || [];
      if (all.length <= max) return;
      all.sort((a, b) => (b.updated || 0) - (a.updated || 0));
      const old = all.slice(max).map(f => f.key);
      await tx('readwrite', st => old.forEach(k => st.delete(k)), FEEDS);
    }
  };
})();

const Favs = {
  KEY: 'mm_favs',
  list() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; } },
  has(id) { return this.list().some(t => t.id === id); },
  toggle(t) {
    let l = this.list();
    if (l.some(x => x.id === t.id)) l = l.filter(x => x.id !== t.id);
    else l.unshift({ id: t.id, name: t.name, url: t.url, thumb: t.thumb || '', src: t.src || '', link: t.link || '' });
    try { localStorage.setItem(this.KEY, JSON.stringify(l)); } catch (e) {}
    return l.some(x => x.id === t.id);
  }
};
