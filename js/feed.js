// Мое_мемы — настройки и бесконечная лента с кешем на устройстве

const Settings = (() => {
  const KEY = 'mm_settings';
  const defSources = { imgflip: true, memegen: true, reddit: true, redditru: true, memepedia: true, lemmy: true };
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { s = {}; }
  s.sources = Object.assign({}, defSources, s.sources || {});
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  return {
    enabled: id => !!s.sources[id],
    enabledList: () => Object.keys(s.sources).filter(k => s.sources[k]),
    setSource(id, on) { s.sources[id] = on; save(); },
    get: k => s[k], set(k, v) { s[k] = v; save(); }
  };
})();

const Feed = (() => {
  const MAX_ITEMS = 2500;   // мемов в одной ленте
  const MAX_FEEDS = 40;     // лент (вкладка+категория+поиск) в кеше
  const STALE_MS = 20 * 60 * 1000;
  const mem = new Map();

  const keyOf = (tab, catId, q) => tab + '|' + (catId || 'all') + '|' + (q || '').trim().toLowerCase();

  async function get(tab, catId, q) {
    const key = keyOf(tab, catId, q);
    if (mem.has(key)) return mem.get(key);
    let f = null;
    try { f = await DB.feedGet(key); } catch (e) {}
    if (!f) f = { key, tab, catId: catId || null, q: (q || '').trim(), items: [], cursors: {}, done: {}, updated: 0 };
    f.seen = new Set(f.items.map(i => i.id));
    // источники, отключённые из-за ошибок сети, при новом открытии пробуем снова
    Object.keys(f.errDone || {}).forEach(id => delete f.done[id]);
    f.errDone = {}; f.err = {};
    f.loading = false;
    mem.set(key, f);
    return f;
  }
  let saveT = null;
  function persist(f) {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      const { seen, loading, ...plain } = f;
      if (plain.items.length > MAX_ITEMS) plain.items = plain.items.slice(0, MAX_ITEMS);
      try { await DB.feedPut(plain); await DB.feedTrim(MAX_FEEDS); } catch (e) {}
    }, 600);
  }
  function ctxOf(f, cursor) {
    return { tab: f.tab, cat: Cats.byId(f.catId), q: f.q, cursor };
  }
  // перемешиваем порции из разных источников по очереди
  function interleave(groups) {
    const out = []; let i = 0, any = true;
    while (any) {
      any = false;
      groups.forEach(g => { if (g[i]) { out.push(g[i]); any = true; } });
      i++;
    }
    return out;
  }
  function active(f) {
    return Sources.list.filter(s => Settings.enabled(s.id) && s.tabs.includes(f.tab));
  }
  // подгрузить следующую порцию; возвращает новые мемы
  async function more(f) {
    if (f.loading) return null;
    const srcs = active(f).filter(s => !f.done[s.id]);
    if (!srcs.length) return [];
    f.loading = true;
    const errors = [];
    const uniq = it => { if (f.seen.has(it.id)) return false; f.seen.add(it.id); return true; };
    try {
      const res = await Promise.all(srcs.map(async s => {
        try {
          const r = await s.page(ctxOf(f, f.cursors[s.id] || null));
          f.cursors[s.id] = r.cursor; if (r.done) f.done[s.id] = true;
          return r.items.filter(uniq);
        } catch (e) {
          f.err = f.err || {}; f.err[s.id] = (f.err[s.id] || 0) + 1;
          if (f.err[s.id] >= 3) { f.done[s.id] = true; f.errDone = f.errDone || {}; f.errDone[s.id] = true; }
          errors.push(s.name);
          return [];
        }
      }));
      const fresh = interleave(res);
      f.items.push(...fresh);
      f.updated = Date.now();
      f.lastErrors = errors;
      persist(f);
      return fresh;
    } finally { f.loading = false; }
  }
  // свежие мемы — наверх (кеш остаётся)
  async function refreshTop(f) {
    const uniq = it => { if (f.seen.has(it.id)) return false; f.seen.add(it.id); return true; };
    const srcs = active(f).filter(s => s.id !== 'imgflip' && s.id !== 'memegen');
    const res = await Promise.all(srcs.map(async s => {
      try {
        const r = await s.page(ctxOf(f, null));
        if (!(s.id in f.cursors)) { f.cursors[s.id] = r.cursor; if (r.done) f.done[s.id] = true; }
        return r.items.filter(uniq);
      } catch (e) { return []; }
    }));
    const fresh = interleave(res);
    if (fresh.length) { f.items.unshift(...fresh); f.updated = Date.now(); persist(f); }
    return fresh;
  }
  function reset(f) {
    f.items = []; f.cursors = {}; f.done = {}; f.err = {}; f.seen = new Set(); f.updated = 0; persist(f);
  }
  const isStale = f => Date.now() - (f.updated || 0) > STALE_MS;
  // источник снова включили — разрешаем ему грузиться
  function reopen(id) { mem.forEach(f => { delete f.done[id]; if (f.err) delete f.err[id]; }); }
  function visible(f) {
    return f.items.filter(it => Settings.enabled(it.src));
  }
  function canMore(f) { return active(f).some(s => !f.done[s.id]); }
  async function clearAll() { mem.clear(); await DB.feedClear(); }
  return { get, more, refreshTop, reset, isStale, reopen, visible, canMore, clearAll, active };
})();
