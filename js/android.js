// Мое_мемы — то, что есть только в приложении Android (мост window.MMApp)
(() => {
  if (!window.MMApp) return;
  const $ = id => document.getElementById(id);
  const KEY = 'mm_notify';
  let cfg = { memes: true, hours: 6 };
  try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}

  function push() {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
    MMApp.notifyConfig(JSON.stringify({ memes: cfg.memes, hours: cfg.hours, sources: Settings.enabledList() }));
  }
  function read(fn) { try { return JSON.parse(fn()) || {}; } catch (e) { return {}; } }

  const box = document.createElement('div');
  box.innerHTML = `
    <div class="panel">
      <h3 class="block-title">Уведомления</h3>
      <div class="hint">Приложение само проверяет включённые базы (Мемепедия, Reddit, Reddit RU, Lemmy) и сообщает о свежих мемах. Ночью (23:00–9:00) не беспокоит.</div>
      <label class="src-item"><input type="checkbox" id="n-memes"><div><b>Уведомлять о новых мемах</b></div></label>
      <div class="row"><label class="grow">Как часто
        <select id="n-hours"><option value="3">раз в 3 часа</option><option value="6">раз в 6 часов</option><option value="12">раз в 12 часов</option><option value="24">раз в сутки</option></select>
      </label></div>
      <div id="n-state" class="cache-info"></div>
      <div class="row chips">
        <button class="chip" id="n-allow">Разрешить уведомления</button>
        <button class="chip" id="n-check">Проверить сейчас</button>
        <button class="chip" id="n-settings">Настройки Android</button>
      </div>
    </div>
    <div class="panel">
      <h3 class="block-title">Обновление приложения</h3>
      <div id="u-state" class="cache-info"></div>
      <div class="row chips">
        <button class="chip" id="u-check">Проверить обновление</button>
        <button class="chip on hidden" id="u-install">Установить</button>
      </div>
    </div>`;
  $('page-settings').insertBefore(box, $('about'));

  function showNotify() {
    const s = read(() => MMApp.notifyStatus());
    $('n-memes').checked = cfg.memes;
    $('n-hours').value = String(cfg.hours);
    $('n-allow').classList.toggle('hidden', !!s.allowed);
    $('n-state').textContent = (s.allowed ? 'Уведомления разрешены.' : 'Уведомления пока запрещены в системе.') + (s.last ? ' Последняя проверка — ' + s.last + '.' : '');
  }
  function showUpdate() {
    const s = read(() => MMApp.updateStatus());
    $('u-state').textContent = 'Установлена версия ' + (s.installed || '?') + '. ' + (s.text || '');
    $('u-install').classList.toggle('hidden', !s.available);
  }
  $('n-memes').onchange = e => { cfg.memes = e.target.checked; push(); showNotify(); };
  $('n-hours').onchange = e => { cfg.hours = +e.target.value; push(); };
  $('n-allow').onclick = () => MMApp.notifyAllow();
  $('n-check').onclick = () => { push(); $('n-state').textContent = 'Проверяю…'; MMApp.notifyCheck(); };
  $('n-settings').onclick = () => MMApp.notifySettings();
  $('u-check').onclick = () => { $('u-state').textContent = 'Проверяю…'; MMApp.updateCheck(); };
  $('u-install').onclick = () => MMApp.updateInstall();
  // включили или выключили базу мемов — сообщаем приложению
  $('src-list').addEventListener('change', () => setTimeout(push, 0));
  document.querySelector('.nav[data-page="settings"]').addEventListener('click', () => { showNotify(); showUpdate(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) showNotify(); });
  window.mmChecked = showNotify;
  window.mmUpdate = showUpdate;

  // кнопка «Назад» телефона
  window.mmBack = () => {
    if (!$('pv').classList.contains('hidden')) { $('pv-close').click(); return true; }
    if (!$('viewer').classList.contains('hidden')) { $('v-close').click(); return true; }
    if (!$('crop-bar').classList.contains('hidden')) { $('crop-cancel').click(); return true; }
    if (!$('page-memes').classList.contains('active')) { App.go('memes'); return true; }
    return false;
  };
  push(); showNotify(); showUpdate();
})();
