// Мое_мемы — источники мемов и категории
// Каждый источник: page(ctx) → { items, cursor, done }
// ctx = { tab: 'new'|'classic', cat: объект категории|null, q: строка поиска, cursor }

const Cats = (() => {
  // people — знаменитости, topics — просто категории
  // en/ru — запросы для поиска в источниках, kw — слова для фильтра по названию
  const people = [
    { id: 'p_all', name: 'Все знаменитости', en: 'celebrity', ru: '', mpCat: 50, kw: [] },
    { id: 'p_musk', name: 'Илон Маск', en: 'elon musk', ru: 'Илон Маск', kw: ['musk', 'elon', 'маск'] },
    { id: 'p_keanu', name: 'Киану Ривз', en: 'keanu', ru: 'Киану Ривз', kw: ['keanu', 'reeves', 'киану', 'ривз'] },
    { id: 'p_drake', name: 'Дрейк', en: 'drake', ru: 'Дрейк', kw: ['drake', 'дрейк'] },
    { id: 'p_leo', name: 'ДиКаприо', en: 'dicaprio', ru: 'ДиКаприо', kw: ['dicaprio', 'leonardo', 'leo ', 'дикаприо', 'леонардо'] },
    { id: 'p_cage', name: 'Николас Кейдж', en: 'nicolas cage', ru: 'Николас Кейдж', kw: ['cage', 'кейдж'] },
    { id: 'p_smith', name: 'Уилл Смит', en: 'will smith', ru: 'Уилл Смит', kw: ['will smith', 'уилл смит'] },
    { id: 'p_rock', name: 'Скала Джонсон', en: 'the rock', ru: 'Дуэйн Джонсон', kw: ['the rock', 'dwayne', 'скала', 'дуэйн'] },
    { id: 'p_gosling', name: 'Райан Гослинг', en: 'ryan gosling', ru: 'Райан Гослинг', kw: ['gosling', 'гослинг'] },
    { id: 'p_travolta', name: 'Траволта', en: 'travolta', ru: 'Траволта', kw: ['travolta', 'траволт'] },
    { id: 'p_zuck', name: 'Цукерберг', en: 'zuckerberg', ru: 'Цукерберг', kw: ['zuck', 'цукерберг'] },
    { id: 'p_jensen', name: 'Дженсен Хуанг', en: 'jensen', ru: 'Дженсен Хуанг', kw: ['jensen', 'nvidia', 'дженсен'] },
    { id: 'p_ramsay', name: 'Гордон Рамзи', en: 'gordon ramsay', ru: 'Гордон Рамзи', kw: ['ramsay', 'gordon', 'рамзи'] },
    { id: 'p_druzhko', name: 'Сергей Дружко', en: 'druzhko', ru: 'Дружко', kw: ['дружко', 'druzhko'] },
    { id: 'p_ponas', name: 'Понасенков', en: 'ponasenkov', ru: 'Понасенков', kw: ['понасенков', 'ponasenkov'] },
    { id: 'p_khabib', name: 'Хабиб', en: 'khabib', ru: 'Хабиб', kw: ['хабиб', 'khabib'] }
  ];
  const topics = [
    { id: 't_cats', name: '🐱 Коты', en: 'cat', ru: 'кот', kw: ['cat', 'kitty', 'kitten', 'кот', 'кош', 'кис'] },
    { id: 't_dogs', name: '🐶 Собаки', en: 'dog', ru: 'собака', kw: ['dog', 'doge', 'puppy', 'cheems', 'собак', 'пёс', 'пес', 'щен'] },
    { id: 't_animals', name: '🦝 Животные', en: 'animal', ru: 'животные', kw: ['animal', 'bird', 'frog', 'monkey', 'bear', 'животн', 'птиц', 'жаб', 'обезьян', 'бобр', 'медвед'] },
    { id: 't_work', name: '💼 Работа', en: 'work', ru: 'работа', kw: ['work', 'job', 'boss', 'office', 'monday', 'работ', 'начальник', 'офис', 'понедельник'] },
    { id: 't_school', name: '🎓 Учёба', en: 'school', ru: 'школа', kw: ['school', 'student', 'exam', 'teacher', 'школ', 'студент', 'экзамен', 'учител', 'универ'] },
    { id: 't_games', name: '🎮 Игры', en: 'gaming', ru: 'игры', kw: ['game', 'gaming', 'gta', 'minecraft', 'steam', 'xbox', 'playstation', 'игр', 'гта', 'майнкрафт'] },
    { id: 't_movies', name: '🎬 Кино', en: 'movie', ru: 'фильм', kw: ['movie', 'film', 'series', 'marvel', 'star wars', 'фильм', 'кино', 'сериал'] },
    { id: 't_anime', name: '🍥 Аниме', en: 'anime', ru: 'аниме', kw: ['anime', 'manga', 'аниме', 'манга'] },
    { id: 't_it', name: '💻 Программисты', en: 'programming', ru: 'программист', kw: ['code', 'coding', 'program', 'developer', 'linux', 'windows', 'bug', ' ai', 'программ', 'код', 'айти', 'нейросет'] },
    { id: 't_sport', name: '⚽ Спорт', en: 'sport', ru: 'спорт', kw: ['sport', 'football', 'soccer', 'gym', 'nba', 'спорт', 'футбол', 'качалк', 'зал'] },
    { id: 't_food', name: '🍔 Еда', en: 'food', ru: 'еда', kw: ['food', 'pizza', 'burger', 'eat', 'cook', 'еда', 'пицц', 'бургер', 'готов', 'шаурм'] },
    { id: 't_love', name: '💔 Отношения', en: 'girlfriend', ru: 'отношения', kw: ['girlfriend', 'boyfriend', 'wife', 'husband', 'date', 'love', 'девушк', 'парен', 'жена', 'муж', 'любов', 'свидан'] },
    { id: 't_react', name: '😮 Реакции', en: 'reaction', ru: 'реакция', kw: ['reaction', 'face', 'shocked', 'surprised', 'реакц', 'лицо', 'удивл'] }
  ];
  const all = people.concat(topics);
  return { people, topics, all, byId: id => all.find(c => c.id === id) || null };
})();

const Sources = (() => {
  const UA_TIMEOUT = 14000;
  let catalog = { new: [], classic: [] };

  async function getJSON(url) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), UA_TIMEOUT);
    try {
      const r = await fetch(url, { signal: ac.signal, credentials: 'omit' });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return await r.json();
    } finally { clearTimeout(t); }
  }
  const weserv = (u, w) => 'https://images.weserv.nl/?url=' + encodeURIComponent(u.replace(/^https?:\/\//, '')) + (w ? '&w=' + w + '&we' : '');
  const decode = s => { const d = document.createElement('textarea'); d.innerHTML = s || ''; return d.value; };
  const isImg = u => /\.(jpe?g|png|gif|webp)(\?|$)/i.test(u || '') || /\/pictrs\/image\//.test(u || '') || /i\.redd\.it\//.test(u || '');

  // слова для фильтра по названию (для источников без поиска)
  function words(ctx) {
    if (ctx.q) return [ctx.q.toLowerCase()];
    if (!ctx.cat) return null;
    if (ctx.cat.id === 'p_all') return Cats.people.flatMap(p => p.kw);
    return ctx.cat.kw;
  }
  function localFilter(items, ctx) {
    const w = words(ctx);
    if (!w) return items;
    return items.filter(it => { const n = ' ' + (it.name || '').toLowerCase() + ' '; return w.some(k => n.includes(k)); });
  }
  function enQuery(ctx) { return ctx.q || (ctx.cat ? ctx.cat.en : ''); }
  function ruQuery(ctx) { return ctx.q || (ctx.cat ? (ctx.cat.ru || ctx.cat.en) : ''); }

  // ---------- 1. Imgflip (шаблоны, локальный каталог) ----------
  const imgflip = {
    id: 'imgflip', name: 'Imgflip', tabs: ['new', 'classic'], lang: 'en',
    desc: 'Популярные пустые шаблоны (≈200)',
    async page(ctx) {
      const thumb = u => { const m = /^https:\/\/i\.imgflip\.com\/([a-z0-9]+)\.\w+$/.exec(u); return m ? 'https://i.imgflip.com/4/' + m[1] + '.jpg' : u; };
      const list = (catalog[ctx.tab] || []).map(t => ({ id: 'if:' + t.id, src: 'imgflip', name: t.name, url: t.url, thumb: thumb(t.url) }));
      return { items: localFilter(list, ctx), cursor: null, done: true };
    }
  };

  // ---------- 2. Memegen.link (шаблоны) ----------
  let memegenAll = null;
  const memegen = {
    id: 'memegen', name: 'Memegen', tabs: ['classic'], lang: 'en',
    desc: 'Классические шаблоны с ключевыми словами (≈200)',
    async page(ctx) {
      if (!memegenAll) memegenAll = await getJSON('https://api.memegen.link/templates');
      const list = memegenAll.map(t => ({
        id: 'mg:' + t.id, src: 'memegen', name: t.name + (t.keywords && t.keywords.length ? ' · ' + t.keywords.join(', ') : ''),
        url: t.blank, thumb: t.blank.replace(/\.(\w+)$/, '.jpg') + '?width=300', link: t.source || ''
      }));
      return { items: localFilter(list, ctx), cursor: null, done: true };
    }
  };

  // ---------- 3/4. Reddit (через meme-api.com + поиск reddit) ----------
  function redditSource(id, name, subs, lang, desc) {
    return {
      id, name, tabs: ['new'], lang, desc,
      async page(ctx) {
        const c = ctx.cursor || { i: 0, miss: 0 };
        const query = lang === 'ru' ? ruQuery(ctx) : enQuery(ctx);
        // случайные свежие мемы, по кругу по сабреддитам
        const sub = subs[c.i % subs.length];
        const d = await getJSON('https://meme-api.com/gimme/' + sub + '/50');
        let items = (d.memes || []).filter(m => !m.nsfw && !m.spoiler && isImg(m.url)).map(m => ({
          id: 'rd:' + (m.postLink || m.url).split('/').pop(), src: id, name: m.title, url: m.url,
          thumb: (m.preview && (m.preview[2] || m.preview[m.preview.length - 1])) || m.url, link: m.postLink
        }));
        if (query) items = localFilter(items, ctx);
        const miss = items.length ? 0 : c.miss + 1;
        return { items, cursor: { i: c.i + 1, miss }, done: miss >= subs.length * 2 };
      }
    };
  }
  const reddit = redditSource('reddit', 'Reddit', ['memes', 'dankmemes', 'me_irl', 'wholesomememes', 'MemeEconomy'], 'en',
    'Свежие мемы из r/memes, r/dankmemes и др. — бесконечно');
  const redditRu = redditSource('redditru', 'Reddit RU', ['Pikabu', 'KafkaFPS', 'ANormalDayInRussia'], 'ru',
    'Русские мемы: r/Pikabu, r/KafkaFPS, r/ANormalDayInRussia');

  // ---------- 5. Мемепедия (база русских мемов) ----------
  const memepedia = {
    id: 'memepedia', name: 'Мемепедия', tabs: ['new', 'classic'], lang: 'ru',
    desc: 'База русских мемов memepedia — картинки из статей',
    async page(ctx) {
      const p = ctx.cursor || 1;
      let url = 'https://memepedia.world/wp-json/wp/v2/posts?per_page=8&_fields=id,link,title,content&page=' + p
        + '&order=' + (ctx.tab === 'classic' ? 'asc' : 'desc');
      if (ctx.q) url += '&search=' + encodeURIComponent(ctx.q);
      else if (ctx.cat && ctx.cat.mpCat) url += '&categories=' + ctx.cat.mpCat;
      else if (ctx.cat) url += '&search=' + encodeURIComponent(ruQuery(ctx));
      let d;
      try { d = await getJSON(url); }
      catch (e) { if (e.status === 400) return { items: [], cursor: p, done: true }; throw e; }
      const items = [];
      d.forEach(post => {
        const title = decode(post.title && post.title.rendered);
        const html = post.content && post.content.rendered || '';
        const re = /<img[^>]+?(?:data-src|src)="([^"]+)"/g; let m, n = 0;
        const seen = new Set();
        while ((m = re.exec(html)) && n < 12) {
          const u = m[1].replace(/-\d+x\d+(\.\w+)$/, '$1');
          if (seen.has(u) || !/wp-content\/uploads/.test(u) || /\.svg/i.test(u)) continue;
          seen.add(u); n++;
          items.push({ id: 'mp:' + u.split('/uploads/').pop(), src: 'memepedia', name: title, url: u, thumb: u, link: post.link });
        }
      });
      return { items, cursor: p + 1, done: d.length < 8 };
    }
  };

  // ---------- 6. Lemmy (memes@lemmy.world) ----------
  const lemmy = {
    id: 'lemmy', name: 'Lemmy', tabs: ['new', 'classic'], lang: 'en',
    desc: 'Сообщество memes@lemmy.world — новые и лучшие за всё время',
    async page(ctx) {
      const sort = ctx.tab === 'classic' ? 'TopAll' : 'New';
      const query = enQuery(ctx);
      let d, cursor, done;
      if (query) {
        const p = ctx.cursor || 1;
        d = await getJSON('https://lemmy.world/api/v3/search?type_=Posts&community_name=memes&limit=40&sort=' + sort + '&page=' + p + '&q=' + encodeURIComponent(query));
        cursor = p + 1; done = !(d.posts && d.posts.length);
      } else {
        d = await getJSON('https://lemmy.world/api/v3/post/list?community_name=memes&limit=40&sort=' + sort + (ctx.cursor ? '&page_cursor=' + encodeURIComponent(ctx.cursor) : ''));
        cursor = d.next_page; done = !cursor;
      }
      const items = (d.posts || []).map(x => x.post).filter(p => !p.nsfw && isImg(p.url) && !/\.(mp4|webm)/i.test(p.url)).map(p => ({
        id: 'lm:' + p.id, src: 'lemmy', name: p.name, url: p.url,
        thumb: p.thumbnail_url ? p.thumbnail_url + (p.thumbnail_url.includes('?') ? '&' : '?') + 'thumbnail=400' : p.url, link: p.ap_id
      }));
      return { items, cursor, done };
    }
  };

  // адрес картинки, который можно кешировать и рисовать на холсте (с CORS)
  const CORS_HOSTS = ['i.imgflip.com', 'api.memegen.link', 'images.weserv.nl', 'lemmy.world'];
  function view(u, w) {
    if (!u) return u;
    let h = ''; try { h = new URL(u).hostname; } catch (e) { return u; }
    if (CORS_HOSTS.includes(h)) return u;
    if (/\.gif(\?|$)/i.test(u) && !w) return u;   // анимацию не трогаем
    return weserv(u, w) + (w ? '&output=jpg&q=78' : '');
  }

  const list = [imgflip, memegen, reddit, redditRu, memepedia, lemmy];
  // для знаменитостей оставляем только мемы, где имя есть в названии
  list.forEach(src => {
    const page = src.page;
    src.page = async ctx => {
      const r = await page(ctx);
      const strictPeople = !ctx.q && ctx.cat && ctx.cat.id.startsWith('p_') && !(src.id === 'memepedia' && ctx.cat.mpCat);
      if (strictPeople) r.items = localFilter(r.items, ctx);
      return r;
    };
  });
  return {
    list, byId: id => list.find(s => s.id === id),
    setCatalog(c) { catalog = c || catalog; },
    weserv, view
  };
})();
