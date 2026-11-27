// Мое_мемы — главная логика
const VERSION = '0.3.0 альфа';
const App = (() => {
  const $ = id => document.getElementById(id);
  let catalog = { new: [], classic: [] };
  let sub = 'new';
  let catId = null;
  let viewing = null;
  let feed = null;       // текущая лента
  let shown = [];        // мемы, показанные в сетке (для просмотра листанием)
  let gen = 0;           // номер отрисовки — чтобы старые загрузки не мешали

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const srcName = id => { const s = Sources.byId(id); return s ? s.name : ''; };

  // ---------- навигация ----------
  function go(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    if (page === 'editor') Editor.render();
    if (page === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.nav').forEach(n => n.onclick = () => go(n.dataset.page));
  document.querySelectorAll('.subtab').forEach(b => b.onclick = () => {
    if (sub === b.dataset.sub && sub !== 'fav') {
      $('cats').classList.toggle('hidden');   // повторное нажатие — свернуть/развернуть подменю
      return;
    }
    sub = b.dataset.sub;
    document.querySelectorAll('.subtab').forEach(x => x.classList.toggle('active', x === b));
    $('cats').classList.toggle('hidden', sub === 'fav');
    renderGrid();
  });
  let searchT = null;
  $('search').addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(renderGrid, 650); });
  $('refresh').onclick = async () => {
    if (!feed) { renderGrid(); return; }
    const f = feed, g = gen;
    loader(true);
    const fresh = await Feed.refreshTop(f);
    if (g !== gen) return;
    loader(false);
    if (fresh.length) { renderGrid(); toast('Новых мемов: ' + fresh.length); }
    else toast('Пока ничего нового');
  };

  // ---------- подменю категорий ----------
  function renderCats() {
    const mk = (c, box) => {
      const b = document.createElement('button');
      b.className = 'chip' + (catId === c.id ? ' on' : '');
      b.textContent = c.name;
      b.onclick = () => {
        catId = catId === c.id ? null : c.id;
        renderCats(); renderGrid();
      };
      box.appendChild(b);
    };
    const pBox = $('cats-people'), tBox = $('cats-topics');
    pBox.innerHTML = ''; tBox.innerHTML = '';
    const all = document.createElement('button');
    all.className = 'chip' + (catId ? '' : ' on'); all.textContent = 'Все мемы';
    all.onclick = () => { catId = null; renderCats(); renderGrid(); };
    tBox.appendChild(all);
    Cats.people.forEach(c => mk(c, pBox));
    Cats.topics.forEach(c => mk(c, tBox));
  }

  // ---------- сетка ----------
  function card(t, idx) {
    const d = document.createElement('div');
    d.className = 'card';
    const img = document.createElement('img');
    img.className = 'thumb'; img.loading = 'lazy'; img.alt = t.name; img.decoding = 'async';
    // сначала через CORS (так картинка кешируется на устройстве), при ошибке — напрямую
    const tries = [Sources.view(t.thumb || t.url, 400), t.thumb || t.url, t.url];
    let k = 0;
    img.crossOrigin = 'anonymous';
    img.src = tries[0];
    img.onerror = () => {
      k++;
      if (k >= tries.length) { d.remove(); return; }
      if (k === 1) img.removeAttribute('crossorigin');
      img.src = tries[k];
    };
    const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = t.name;
    const fv = document.createElement('button');
    fv.className = 'fav' + (Favs.has(t.id) ? ' on' : ''); fv.textContent = '♥'; fv.title = 'В избранное';
    fv.onclick = e => {
      e.stopPropagation();
      const on = Favs.toggle(t); fv.classList.toggle('on', on);
      toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
      if (sub === 'fav') renderGrid();
    };
    d.append(img, nm, fv);
    if (t.src) { const tg = document.createElement('span'); tg.className = 'src-tag'; tg.textContent = srcName(t.src); d.appendChild(tg); }
    d.onclick = () => openPV(idx);
    return d;
  }
  function filterFav(list) {
    const q = $('search').value.trim().toLowerCase();
    return q ? list.filter(t => (t.name || '').toLowerCase().includes(q)) : list;
  }
  function loader(on) { $('loader').classList.toggle('hidden', !on); }
  function setCount() {
    if (sub === 'fav' || !feed) { $('count').textContent = ''; return; }
    const names = Feed.active(feed).map(s => s.name).join(', ');
    $('count').textContent = 'Мемов: ' + shown.length + (Feed.canMore(feed) ? '+' : '') + ' · ' + (names || 'нет выбранных баз');
  }
  function appendCards(items) {
    const g = $('grid'); const frag = document.createDocumentFragment();
    items.forEach(t => { shown.push(t); frag.appendChild(card(t, shown.length - 1)); });
    g.appendChild(frag);
  }
  function showEmpty() {
    const empty = $('empty');
    const none = shown.length === 0;
    empty.classList.toggle('hidden', !none);
    if (!none) return;
    if (sub === 'fav') empty.innerHTML = 'Избранных шаблонов пока нет.<br>Нажми ♥ на любой картинке в «Новые» или «Классика».';
    else if (feed && !Feed.active(feed).length) empty.innerHTML = 'Для этой вкладки не выбрано ни одной базы мемов.<br>Включи базы в ⚙️ Настройках.';
    else if (feed && feed.loading) empty.innerHTML = '';
    else empty.innerHTML = 'Ничего не нашлось. Попробуй другую категорию или слово.' + (navigator.onLine ? '' : '<br>Нет интернета — показываю только сохранённое.');
  }
  async function renderGrid() {
    const my = ++gen;
    feed = null;
    const g = $('grid'); g.innerHTML = '';
    shown = [];
    $('saved-block').classList.toggle('hidden', sub !== 'fav');
    if (sub === 'fav') {
      feed = null; loader(false);
      await renderSaved();
      if (my !== gen) return;
      appendCards(filterFav(Favs.list()));
      setCount(); showEmpty();
      return;
    }
    const f = await Feed.get(sub, catId, $('search').value);
    if (my !== gen) return;
    feed = f;
    appendCards(Feed.visible(f));
    setCount(); showEmpty();
    if (shown.length < 30) await loadMore();
    else if (f.tab === 'new' && Feed.isStale(f) && navigator.onLine) {
      Feed.refreshTop(f).then(fresh => { if (my === gen && fresh.length) { toast('Новых мемов: ' + fresh.length + ' — наверху'); } });
    }
  }
  // подгрузка при листании
  async function loadMore() {
    const f = feed, my = gen;
    if (!f) return;
    if (f.loading || !Feed.canMore(f)) { if (f) setCount(); return; }
    if (!navigator.onLine) { toast('Нет интернета — показываю сохранённое'); return; }
    loader(true); showEmpty();
    let fresh = null, tries = 0;
    // если порция пустая (например, фильтр категории), пробуем ещё пару раз
    while (tries++ < 3) {
      fresh = await Feed.more(f);
      if (my !== gen) return;
      if (fresh === null) break;
      const vis = fresh.filter(it => Settings.enabled(it.src));
      if (vis.length) { appendCards(vis); break; }
      if (!Feed.canMore(f)) break;
    }
    loader(false);
    if (f.lastErrors && f.lastErrors.length && !shown.length) toast('Не отвечает: ' + f.lastErrors.join(', '));
    setCount(); showEmpty();
    pvUpdate();
    if (my === gen && Feed.canMore(f) && nearBottom()) setTimeout(loadMore, 50);
  }
  function nearBottom() {
    const r = $('sentinel').getBoundingClientRect();
    return $('page-memes').classList.contains('active') && r.top < window.innerHeight + 1200;
  }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) loadMore(); }, { rootMargin: '1200px 0px' });

  async function renderSaved() {
    const g = $('saved-grid'); g.innerHTML = '';
    let items = [];
    try { items = await DB.all(); } catch (e) {}
    const q = $('search').value.trim().toLowerCase();
    if (q) items = items.filter(i => (i.name || '').toLowerCase().includes(q));
    if (!items.length) {
      g.innerHTML = '<div class="hint" style="grid-column:1/-1">Здесь появятся мемы, которые ты сохранишь в редакторе.</div>';
      return;
    }
    items.forEach(it => {
      const d = document.createElement('div'); d.className = 'card';
      const img = document.createElement('img'); img.className = 'thumb'; img.src = it.thumb; img.alt = it.name;
      const nm = document.createElement('div'); nm.className = 'name';
      nm.textContent = (it.name || 'Мем') + ' · ' + new Date(it.created).toLocaleDateString('ru-RU');
      d.append(img, nm);
      d.onclick = () => openViewer(it);
      g.appendChild(d);
    });
  }

  // ---------- просмотр мемов с листанием ----------
  let pvIdx = -1;
  function openPV(i) { pvIdx = i; $('pv').classList.remove('hidden'); document.body.style.overflow = 'hidden'; pvShow(); }
  function closePV() { $('pv').classList.add('hidden'); document.body.style.overflow = ''; pvIdx = -1; }
  function pvShow() {
    const t = shown[pvIdx]; if (!t) return;
    const img = $('pv-img');
    const thumb = Sources.view(t.thumb || t.url, 400), full = Sources.view(t.url);
    img.crossOrigin = 'anonymous';
    img.onerror = () => { img.onerror = null; img.removeAttribute('crossorigin'); img.src = t.url; };
    img.src = thumb;                           // сначала миниатюра из кеша
    const big = new Image(); big.crossOrigin = 'anonymous';
    big.onload = () => { if (shown[pvIdx] === t) img.src = full; };
    big.onerror = () => { if (shown[pvIdx] === t) { img.removeAttribute('crossorigin'); img.src = t.url; } };
    big.src = full;
    $('pv-name').textContent = t.name;
    $('pv-src').textContent = srcName(t.src) || 'Избранное';
    $('pv-fav').classList.toggle('on', Favs.has(t.id));
    const a = $('pv-link'); const web = /^https?:\/\//i.test(t.link || ''); a.classList.toggle('hidden', !web); if (web) a.href = t.link;
    pvUpdate();
    // заранее грузим следующие картинки (они попадают в кеш)
    for (let k = 1; k <= 3; k++) { const n = shown[pvIdx + k]; if (n) { const p = new Image(); p.crossOrigin = 'anonymous'; p.src = Sources.view(n.url); } }
    if (sub !== 'fav' && pvIdx >= shown.length - 6) loadMore();
  }
  function pvUpdate() {
    if (pvIdx < 0) return;
    $('pv-count').textContent = (pvIdx + 1) + ' / ' + shown.length + (feed && Feed.canMore(feed) ? '+' : '');
    $('pv-prev').style.visibility = pvIdx > 0 ? '' : 'hidden';
    $('pv-next').style.visibility = pvIdx < shown.length - 1 ? '' : 'hidden';
  }
  function pvStep(d) {
    const n = pvIdx + d;
    if (n < 0) return;
    if (n >= shown.length) { if (feed && Feed.canMore(feed)) { toast('Загружаю ещё…'); loadMore(); } return; }
    pvIdx = n; pvShow();
  }
  $('pv-prev').onclick = () => pvStep(-1);
  $('pv-next').onclick = () => pvStep(1);
  $('pv-close').onclick = closePV;
  (() => {
    let x0 = null, y0 = 0;
    const st = $('pv-stage');
    st.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    st.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) pvStep(dx < 0 ? 1 : -1);
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx)) closePV();
    });
  })();
  document.addEventListener('keydown', e => {
    if (pvIdx < 0) return;
    if (e.key === 'ArrowRight') pvStep(1); else if (e.key === 'ArrowLeft') pvStep(-1); else if (e.key === 'Escape') closePV();
  });
  $('pv-edit').onclick = () => { const t = shown[pvIdx]; if (!t) return; closePV(); openTemplate(t); };
  $('pv-fav').onclick = () => {
    const t = shown[pvIdx]; if (!t) return;
    const on = Favs.toggle(t); $('pv-fav').classList.toggle('on', on);
    toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
  };
  $('pv-dl').onclick = async () => {
    const t = shown[pvIdx]; if (!t) return;
    toast('Скачиваю…');
    let blob = null;
    for (const u of [Sources.view(t.url), t.url, Sources.weserv(t.url)]) {
      try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) { blob = await r.blob(); break; } } catch (e) {}
    }
    if (!blob) { toast('Не получилось скачать — открой «Источник»'); return; }
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    download(blob, 'meme_' + Date.now() + '.' + ext);
    if (!window.MMApp) toast('Картинка скачана в «Загрузки»');
  };

  // ---------- настройки ----------
  async function renderSettings() {
    const box = $('src-list'); box.innerHTML = '';
    Sources.list.forEach(s => {
      const l = document.createElement('label'); l.className = 'src-item';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = Settings.enabled(s.id);
      cb.onchange = () => {
        if (!cb.checked && Settings.enabledList().length <= 1) { cb.checked = true; toast('Нужна хотя бы одна база'); return; }
        Settings.setSource(s.id, cb.checked);
        if (cb.checked) Feed.reopen(s.id);
        toast(cb.checked ? s.name + ' включена' : s.name + ' выключена');
      };
      const tabs = s.tabs.map(t => t === 'new' ? 'Новые' : 'Классика').join(' + ');
      const txt = document.createElement('div');
      txt.innerHTML = '<b></b> ' + (s.lang === 'ru' ? '🇷🇺' : '') + '<small></small>';
      txt.querySelector('b').textContent = s.name;
      txt.querySelector('small').textContent = s.desc + ' · ' + tabs;
      l.append(cb, txt); box.appendChild(l);
    });
    $('about').textContent = 'Мое_мемы v' + VERSION + '. Мемы подгружаются бесконечно при листании и открытии картинок и сохраняются в кеше устройства.';
    const info = $('cache-info'); info.textContent = 'Считаю…';
    let st = { feeds: 0, memes: 0 }, imgs = 0, mb = '';
    try { st = await DB.feedStats(); } catch (e) {}
    try { if (window.caches) imgs = (await (await caches.open('mm-img-v1')).keys()).length; } catch (e) {}
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); mb = ' · занято ~' + Math.round((e.usage || 0) / 1048576) + ' МБ'; } } catch (e) {}
    info.textContent = 'Мемов в списках: ' + st.memes + ' (лент: ' + st.feeds + ') · картинок в кеше: ' + imgs + mb;
  }
  $('clear-feeds').onclick = async () => {
    if (!confirm('Очистить сохранённые списки мемов? Избранное и твои мемы останутся.')) return;
    await Feed.clearAll(); feed = null; toast('Списки очищены'); renderSettings();
  };
  $('clear-imgs').onclick = async () => {
    if (!confirm('Удалить сохранённые картинки мемов из кеша?')) return;
    try { await caches.delete('mm-img-v1'); } catch (e) {}
    toast('Картинки удалены из кеша'); renderSettings();
  };

  // ---------- открыть в редакторе ----------
  function openTemplate(t) {
    go('editor');
    Editor.openSource({ type: 'url', url: Sources.view(t.url), name: t.name });
  }
  function onUpload(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    go('editor');
    Editor.openSource({ type: 'blob', blob: f, name: f.name.replace(/\.\w+$/, '') });
  }
  $('upload').onchange = onUpload;
  $('upload2').onchange = onUpload;
  $('new-btn').onclick = () => {
    if (Editor.hasContent() && !confirm('Начать новый пустой мем? Несохранённые изменения пропадут.')) return;
    Editor.blank();
  };

  // ---------- сохранение ----------
  function fileName() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return 'meme_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.jpg';
  }
  // в приложении Android файлы передаются в него: обычное скачивание там не работает
  function toApp(method, blob, name) {
    const r = new FileReader();
    r.onload = () => window.MMApp[method](name, String(r.result).split(',')[1], blob.type || 'image/jpeg');
    r.readAsDataURL(blob);
  }
  function download(blob, name) {
    if (window.MMApp) { toApp('saveImage', blob, name); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function getJpeg() {
    try { return await Editor.exportBlob(0.92); }
    catch (e) { toast('Не получилось сохранить картинку (защита сайта-источника).'); throw e; }
  }
  $('save-db').onclick = async () => {
    if (!Editor.hasContent()) { toast('Пустой холст'); return; }
    const blob = await getJpeg();
    const S = Editor.S;
    const item = {
      id: 'm' + Date.now(), created: Date.now(), name: Editor.name(),
      blob, thumb: await Editor.thumbFrom(blob), project: Editor.project(),
      src: S.src ? (S.src.type === 'url' ? { type: 'url', url: S.src.url, name: S.src.name } : { type: 'blob', blob: S.src.blob, name: S.src.name }) : null
    };
    try { await DB.put(item); toast('Сохранено на сайте → Мемы › Избранное'); }
    catch (e) { toast('Ошибка сохранения в базу'); }
  };
  $('save-jpg').onclick = async () => {
    if (!Editor.hasContent()) { toast('Пустой холст'); return; }
    const blob = await getJpeg();
    download(blob, fileName());
    if (!window.MMApp) toast('JPEG скачан в «Загрузки»');
  };
  if (window.MMApp) {
    $('share-jpg').classList.remove('hidden');
    $('share-jpg').onclick = async () => {
      if (!Editor.hasContent()) { toast('Пустой холст'); return; }
      toApp('shareImage', await getJpeg(), fileName());
    };
  } else if (navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/jpeg' })], 'a.jpg', { type: 'image/jpeg' })] })) {
    $('share-jpg').classList.remove('hidden');
    $('share-jpg').onclick = async () => {
      const blob = await getJpeg();
      const file = new File([blob], fileName(), { type: 'image/jpeg' });
      try { await navigator.share({ files: [file], title: 'Мем' }); } catch (e) {}
    };
  }

  // ---------- просмотр сохранённого ----------
  function openViewer(it) {
    viewing = it;
    const img = $('viewer-img');
    if (img._url) URL.revokeObjectURL(img._url);
    img._url = URL.createObjectURL(it.blob); img.src = img._url;
    $('viewer').classList.remove('hidden');
  }
  function closeViewer() { $('viewer').classList.add('hidden'); viewing = null; }
  $('v-close').onclick = closeViewer;
  $('viewer').onclick = e => { if (e.target.id === 'viewer') closeViewer(); };
  $('v-dl').onclick = () => { if (viewing) { download(viewing.blob, fileName()); if (!window.MMApp) toast('JPEG скачан'); } };
  $('v-del').onclick = async () => {
    if (!viewing || !confirm('Удалить этот мем из базы сайта?')) return;
    await DB.del(viewing.id); closeViewer(); renderGrid(); toast('Удалено');
  };
  $('v-edit').onclick = () => {
    if (!viewing) return;
    const it = viewing; closeViewer();
    if (!it.src) { toast('У этого мема нет исходной картинки'); return; }
    go('editor');
    Editor.openSource(Object.assign({}, it.src), it.project);
  };

  // ---------- старт ----------
  async function init() {
    $('ver').textContent = 'v' + VERSION;
    Editor.init();
    // старое избранное (id без источника) → формат 0.2.0
    try {
      const l = Favs.list(); let ch = false;
      l.forEach(t => { if (!String(t.id).includes(':')) { t.id = 'if:' + t.id; t.src = 'imgflip'; ch = true; } });
      if (ch) localStorage.setItem(Favs.KEY, JSON.stringify(l));
    } catch (e) {}
    renderCats();
    io.observe($('sentinel'));
    window.addEventListener('online', () => { if (feed) loadMore(); });
    try {
      const r = await fetch('data/catalog.json?v=' + encodeURIComponent(VERSION));
      catalog = await r.json();
    } catch (e) { toast('Нет интернета — показываю сохранённое'); }
    Sources.setCatalog(catalog);
    renderGrid();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('DOMContentLoaded', init);
  return { toast, go };
})();
