"""Собирает index.html (экран выбора игр) из tools/catalog.json.

Запуск: python3 tools/build_hub.py
В каталоге у каждой игры: id (папка), title, into (винительный падеж для «Сыграем в …»),
about (короткое описание), section, icon (эмодзи для бота), unit (подпись рекорда), art (изображение карточки),
revision (необязательная версия ссылки).
"""
import json, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((ROOT / 'tools' / 'catalog.json').read_text(encoding='utf-8'))
games = data['games']
by_id = {g['id']: g for g in games}
assert len(by_id) == len(games), 'повторяется id'
for g in games:
    assert (ROOT / g['id'] / 'index.html').exists(), 'нет папки игры ' + g['id']

def game_path(game):
    path = game['id'] + '/'
    if 'revision' in game:
        path += '?v=' + str(int(game['revision']))
    return path


versioned_paths = {g['id']: game_path(g) for g in games if 'revision' in g}

STAR = '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>'


def card(g):
    art = g['art'].replace('\n', '\n          ')
    return f'''      <li><a class="card" href="{game_path(g)}" data-id="{g['id']}">
        <span class="art">{art}</span>
        <span class="card-body"><span class="card-title">{html.escape(g['title'])}</span><span class="card-desc">{html.escape(g['about'])}</span><span class="card-best" hidden></span></span>
      </a></li>'''


def row(sid, title, items):
    cards = '\n'.join(card(g) for g in items)
    return f'''  <section class="group" aria-labelledby="g-{sid}">
    <div class="group-head"><h2 class="group-title" id="g-{sid}">{html.escape(title)}</h2><span class="group-count">{len(items)}</span></div>
    <ul class="cards">
{cards}
    </ul>
  </section>'''


rows = []
# Каталог: новые игры добавляем в начало. Витрина заменяет прошлую десятку.
fresh = games[:10]
if fresh:
    rows.append(row('new', 'Новые игры', fresh))
# Сюжетные игры также остаются в своих жанровых разделах.
story_ids = ['space', 'spamattack']
rows.append(row('story', 'Сюжетные игры', [by_id[i] for i in story_ids]))
for s in data['sections']:
    items = [g for g in games if g['section'] == s['id']]
    if items:
        rows.append(row(s['id'], s['title'], items))

units = {}
for g in games:
    u = g.get('unit')
    if u:
        units[g['id']] = u

support_html = '''  <section class="group support" id="support" aria-labelledby="g-support">
    <div class="group-head"><h2 class="group-title" id="g-support">Поддержать «Паузу»</h2></div>
    <div class="support-box">
      <p class="support-lead">Играй бесплатно. А если нравится «Пауза», можешь поддержать её звёздами Telegram. Это украшения: на очки и рекорды они не влияют.</p>
      <ul class="offers">
        <li class="offer" data-product="thanks">
          <span class="offer-icon" aria-hidden="true"><svg viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#45413C"/><path d="M20 8.5l3.4 7.2 7.8.9-5.8 5.4 1.6 7.7L20 25.8l-7 3.9 1.6-7.7-5.8-5.4 7.8-.9z" fill="#FFD84D"/></svg></span>
          <span class="offer-text"><span class="offer-title">Спасибо</span><span class="offer-perk">Значок ⭐ рядом с названием</span></span>
          <button class="offer-buy" type="button"><span class="price">15</span>%%STAR%%</button>
        </li>
        <li class="offer" data-product="gold">
          <span class="offer-icon" aria-hidden="true"><svg viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#45413C"/><rect x="13" y="9" width="14" height="22" rx="5" fill="#FFD84D"/><rect x="15.5" y="13" width="9" height="5" rx="2" fill="#33312E"/><rect x="15.5" y="23" width="9" height="4" rx="2" fill="#33312E"/><path d="M20 31.5l1.2 2.5 2.8.3-2 1.9.5 2.7-2.5-1.4-2.5 1.4.5-2.7-2-1.9 2.8-.3z" fill="#F5AD7A"/></svg></span>
          <span class="offer-text"><span class="offer-title">Золотой набор</span><span class="offer-perk">Золотые машинка, самолётик, змейка и звездолёт, плюс значок&nbsp;⭐</span></span>
          <button class="offer-buy" type="button"><span class="price">75</span>%%STAR%%</button>
        </li>
      </ul>
      <p class="buy-msg" id="buy-msg" role="status" hidden></p>
      <p class="support-terms">Нажимая на цену, ты соглашаешься с <a href="terms/">условиями покупок</a>. Помощь с оплатой: команда /paysupport в боте или аккаунт поддержки <a href="https://t.me/helpPauza" data-tg>@helpPauza</a>.</p>
    </div>
  </section>'''.replace('%%STAR%%', STAR)

TEMPLATE = r'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#F1F0EC">
<meta name="color-scheme" content="light">
<title>Пауза</title>
<script src="shared/pauza.js?v=7"></script>
<script>
/* Ссылка вида t.me/Pauzagame_bot/play?startapp=race сразу открывает нужную игру */
(function () {
  var known = %%KNOWN%%;
  var wanted = window.Pauza.startParam();
  var versioned = %%VERSIONED%%;
  if (wanted && known.indexOf(wanted) !== -1) location.replace((versioned[wanted] || wanted + '/') + location.hash);
})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=Unbounded:wght@600;800&display=swap" media="print" onload="this.media='all'">
<link rel="stylesheet" href="shared/pauza.css?v=7">
<style>
/* Экран выбора: шапка, затем разделы. В каждом разделе карточки листаются вбок. */
body.hub{overflow-y:auto;overflow-x:hidden;height:auto;min-height:100%}
.hub-wrap{
  --gutter:max(16px,env(safe-area-inset-left,0px));
  width:min(100%,560px);margin-inline:auto;display:flex;flex-direction:column;gap:24px;
  padding-block:22px 28px;padding-left:var(--gutter);padding-right:max(16px,env(safe-area-inset-right,0px));
}
.hub-head{display:flex;align-items:center;gap:16px}
.hub-head .mark{height:46px}
.hub-head .mark i{width:16px;height:46px;border-radius:8px}
.hub-head h1{font-size:34px;display:flex;align-items:center;gap:10px}
.hub-head .tag{margin:4px 0 0;font-size:15px}
.hub-nav{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border:1px solid var(--line);border-radius:16px;background:var(--shoulder)}
.hub-nav a{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border-radius:12px;color:var(--lilac);text-decoration:none;font-family:var(--font-display);font-size:13px;font-weight:600}
.hub-nav svg{width:18px;height:18px;flex:none}
.hub-nav [aria-current="page"]{background:#F28A45;color:var(--ink)}
.hub-nav [aria-current="page"] svg{color:var(--ink)}
.hub-games{display:flex;flex-direction:column;gap:24px}
.player-stats{display:grid;gap:20px}
.player-stats h2{font-size:clamp(20px,6vw,28px);line-height:1.2}
.stats-note,.stats-empty p{margin:6px 0 0;color:var(--lilac);font-size:14px}
.stats-totals{margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.stats-totals div{display:flex;flex-direction:column-reverse;gap:5px;min-width:0;padding:12px 8px;border:1px solid var(--line);border-radius:14px;background:var(--shoulder)}
.stats-totals dd{margin:0;font-family:var(--font-display);font-size:clamp(17px,5vw,26px);font-weight:800;color:var(--mint);overflow-wrap:anywhere}
.stats-totals dt{font-size:12px;line-height:1.25;color:var(--lilac)}
.stats-title{margin:0 0 10px;font-family:var(--font-display);font-size:14px;font-weight:600}
.stats-list{margin:0;padding:0;list-style:none;border:1px solid var(--line);border-radius:16px;background:var(--shoulder)}
.stats-list li+li{border-top:1px solid var(--line)}
.stats-game{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:12px 14px;min-height:52px;color:var(--paper);text-decoration:none;border-radius:10px}
.stats-game:hover,.stats-game:active{background:var(--road)}
.stats-name{font-family:var(--font-display);font-size:14px;font-weight:600;overflow-wrap:anywhere}
.stats-detail{grid-column:1;color:var(--lilac);font-size:13px;overflow-wrap:anywhere}
.stats-record{color:var(--mint)}
.stats-arrow{grid-column:2;grid-row:1 / span 2;color:var(--lilac)}
.stats-empty{padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--shoulder)}
.stats-empty .chip{margin-top:12px}
.hub-actions{display:flex;gap:10px;margin-top:-6px}
.chip{
  appearance:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:999px;
  background:var(--shoulder);border:1px solid var(--line);color:var(--paper);font-family:var(--font-display);font-weight:600;font-size:14px;cursor:pointer;text-decoration:none;
}
.chip svg{width:18px;height:18px;flex:none}
.badge{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--road);border:1px solid rgba(255,216,77,.5)}
.badge .star{width:17px;height:17px;fill:var(--sun)}
body.gold .hub-head .mark i{background:var(--sun)}
.group{display:flex;flex-direction:column;gap:10px;min-width:0}
.group-head{display:flex;align-items:baseline;gap:8px}
.group-title{margin:0;font-family:var(--font-display);font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--lilac)}
.group-count{font-size:12px;color:var(--lilac);opacity:.7;font-variant-numeric:tabular-nums}
.cards{
  list-style:none;margin:0 calc(-1 * var(--gutter));padding:2px var(--gutter) 8px;
  display:grid;grid-auto-flow:column;grid-auto-columns:clamp(138px,41%,190px);gap:10px;
  overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:var(--gutter);
  scrollbar-width:none;touch-action:pan-x pan-y;
}
.cards::-webkit-scrollbar{display:none}
@media (hover:hover) and (pointer:fine){.cards{scrollbar-width:thin;scrollbar-color:var(--road) transparent}.cards::-webkit-scrollbar{display:block;height:6px}.cards::-webkit-scrollbar-thumb{background:var(--road);border-radius:3px}}
.cards li{scroll-snap-align:start;min-width:0}
.card{
  display:flex;flex-direction:column;height:100%;min-width:0;overflow:hidden;
  border-radius:16px;background:var(--shoulder);border:1px solid var(--line);
  color:var(--paper);text-decoration:none;
}
.card:active{transform:translateY(1px)}
.art{display:block;width:100%;aspect-ratio:16/10;background:var(--road)}
.art img{display:block;width:100%;height:100%;object-fit:cover}
.art svg{display:block;width:100%;height:100%}
.card-body{display:flex;flex-direction:column;gap:2px;padding:9px 11px 11px}
.card-title{font-family:var(--font-display);font-weight:600;font-size:14px;line-height:1.2}
.card-desc{font-size:12.5px;line-height:1.3;color:var(--lilac);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-best{margin-top:3px;font-size:12px;color:var(--mint);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hub-foot{margin:0;font-size:13px;color:var(--lilac);text-align:center}
.art text{font-family:"Unbounded","Arial Black",system-ui,sans-serif;font-weight:800}
/* Поддержка звёздами */
.support-box{display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:18px;background:var(--shoulder);border:1px solid var(--line)}
.support-lead{margin:0;font-size:14px;line-height:1.45;color:var(--paper)}
.offers{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.offer{display:flex;align-items:center;gap:12px}
.offer-icon{flex:none;width:44px;height:44px}
.offer-icon svg{display:block;width:100%;height:100%}
.offer-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.offer-title{font-family:var(--font-display);font-weight:600;font-size:15px;line-height:1.2}
.offer-perk{font-size:13px;line-height:1.3;color:var(--lilac)}
.offer-buy{
  flex:none;appearance:none;border:0;border-radius:14px;min-width:84px;max-width:130px;min-height:44px;padding:0 14px;
  display:inline-flex;align-items:center;justify-content:center;gap:5px;
  background:var(--sun);color:var(--ink);font-family:var(--font-display);font-weight:600;font-size:15px;cursor:pointer;
}
.offer-buy .star{width:16px;height:16px;fill:var(--ink);flex:none}
.offer-buy:disabled{opacity:.55;cursor:default}
.offer.owned .offer-buy{background:transparent;color:var(--mint);border:1px solid rgba(61,245,176,.45);opacity:1}
.buy-msg{margin:0;padding:10px 12px;border-radius:12px;background:rgba(250,247,242,.08);font-size:14px;line-height:1.4}
.buy-msg.good{background:rgba(61,245,176,.14);color:var(--mint)}
.support-terms{margin:0;font-size:12px;line-height:1.45;color:var(--lilac)}
.support-terms a{color:var(--paper)}
.ad-slot{display:flex;flex-direction:column;gap:4px;margin:0 0 4px;padding:14px 16px;border-radius:18px;background:var(--shoulder);border:1px dashed var(--line);color:var(--paper);text-decoration:none}
.ad-slot.on{border-style:solid;border-color:rgba(255,216,77,.45)}
.ad-label{font-size:11px;letter-spacing:.04em;color:var(--lilac)}
.ad-text{font-family:var(--font-body);font-weight:600;font-size:15px;line-height:1.3}
.ad-cta{font-size:13px;color:var(--mint)}
</style>
</head>
<body class="hub">
<main class="hub-wrap">
  <header class="hub-head">
    <div class="mark" aria-hidden="true"><i></i><i></i></div>
    <div>
      <h1>Пауза <span class="badge" id="badge" title="Спасибо за поддержку" hidden>%%STAR%%</span></h1>
      <p class="tag" id="hub-tag">Есть минутка? Выбирай игру.</p>
    </div>
  </header>
  <nav class="hub-nav" aria-label="Разделы Паузы">
    <a href="./" id="games-tab" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/></svg>Игры</a>
    <a href="?open=stats" id="stats-tab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v16h16M8 15v-3m5 3V8m5 7V5"/></svg>Мои игры</a>
  </nav>
  <div class="hub-games" id="hub-games">
  <div class="hub-actions">
    <button class="chip" type="button" id="random"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#F28A45" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="#F28A45"/><circle cx="15.5" cy="15.5" r="1.6" fill="#F28A45"/><circle cx="12" cy="12" r="1.6" fill="#F28A45"/></svg>Случайная игра</button>
    <a class="chip" href="#support"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="#FFD84D"/></svg>Поддержать</a>
  </div>

  <a class="ad-slot" id="ad" href="https://t.me/helpPauza" data-tg>
    <span class="ad-label">Реклама</span>
    <span class="ad-text">Хочешь разместить рекламу в «Паузе»?</span>
    <span class="ad-cta">Написать @helpPauza →</span>
  </a>

%%ROWS%%

%%SUPPORT%%

  <p class="hub-foot">Чтобы позвать друга, набери @Pauzagame_bot и пробел в любом чате.</p>
  </div>

  <section class="player-stats" id="player-stats" aria-labelledby="stats-heading" hidden>
    <div>
      <h2 id="stats-heading">Как ты играешь</h2>
      <p class="stats-note">Результаты хранятся на этом устройстве.</p>
    </div>
    <dl class="stats-totals">
      <div><dt>Партий сыграно</dt><dd id="stats-runs">0</dd></div>
      <div><dt>Разных игр попробовано</dt><dd id="stats-played">0</dd></div>
      <div><dt>Игр с рекордом</dt><dd id="stats-records">0</dd></div>
    </dl>
    <div id="stats-results" hidden>
      <h3 class="stats-title">Во что ты играл</h3>
      <ul class="stats-list" id="stats-list"></ul>
    </div>
    <div class="stats-empty" id="stats-empty">
      <strong>Здесь будут твои результаты</strong>
      <p>Сыграй партию — и первый результат появится здесь.</p>
      <a class="chip" href="./">Выбрать игру</a>
    </div>
  </section>
</main>

<script>
(function () {
  'use strict';
  var P = window.Pauza;
  var GAMES = %%KNOWN%%;
  /* Как подписать рекорд на карточке: слова после числа, 'points', 'ms' или 'clock' */
  var units = %%UNITS%%;
  var POINTS = ['очко', 'очка', 'очков'];
  function label(u, v) {
    if (u === 'ms') return v + ' мс';
    if (u === 'clock') return P.clock(v);
    if (u === 'tenths') return (v / 10).toFixed(1).replace('.', ',') + ' с';
    if (u === 'points') u = POINTS;
    return P.fmt(v) + ' ' + P.plural(v, u);
  }
  var open = new URLSearchParams(location.search).get('open');
  var start = P.startParam();
  var showStats = open === 'stats' || (!open && start === 'stats');
  var cards = document.querySelectorAll('.card');

  /* Рекорд гонки из первой версии игры */
  if (P.store.get('pz_best_race', null) === null && P.store.get('pz_best', 0) > 0) {
    P.store.set('pz_best_race', P.store.get('pz_best', 0));
  }
  P.init();
  if (showStats) {
    document.title = 'Пауза · Как ты играешь';
    document.getElementById('hub-tag').hidden = true;
    document.getElementById('hub-games').hidden = true;
    document.getElementById('games-tab').removeAttribute('aria-current');
    document.getElementById('stats-tab').setAttribute('aria-current', 'page');
    document.getElementById('player-stats').hidden = false;
    P.back(function () { location.replace('./'); });

    var gameCards = Object.create(null);
    Array.prototype.forEach.call(cards, function (card) {
      var id = card.getAttribute('data-id');
      if (!gameCards[id]) {
        gameCards[id] = { title: card.querySelector('.card-title').textContent, path: card.getAttribute('href') };
      }
    });
    function renderStats() {
      var total = 0, records = 0, played = [];
      GAMES.forEach(function (id) {
        var runs = P.store.get('pz_runs_' + id, 0);
        var best = P.store.get('pz_best_' + id, null);
        runs = Number.isSafeInteger(runs) && runs > 0 ? runs : 0;
        var hasBest = Number.isFinite(best) && best > 0 && !!units[id];
        if (!runs && !hasBest) return;
        total += runs;
        if (hasBest) records++;
        played.push({ game: gameCards[id], runs: runs, record: hasBest ? label(units[id], best) : null });
      });
      played.sort(function (a, b) { return b.runs - a.runs || a.game.title.localeCompare(b.game.title, 'ru'); });
      document.getElementById('stats-runs').textContent = P.fmt(total);
      document.getElementById('stats-played').textContent = P.fmt(played.length);
      document.getElementById('stats-records').textContent = P.fmt(records);
      document.getElementById('stats-results').hidden = !played.length;
      document.getElementById('stats-empty').hidden = !!played.length;

      var rows = document.createDocumentFragment();
      played.forEach(function (entry) {
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.className = 'stats-game';
        link.href = entry.game.path;
        var title = document.createElement('span');
        title.className = 'stats-name';
        title.textContent = entry.game.title;
        link.appendChild(title);
        var detail = document.createElement('span');
        detail.className = 'stats-detail';
        if (entry.runs) detail.textContent = P.fmt(entry.runs) + ' ' + P.plural(entry.runs, ['партия', 'партии', 'партий']);
        if (entry.record) {
          var record = document.createElement('span');
          record.className = 'stats-record';
          record.textContent = 'Рекорд: ' + entry.record;
          if (entry.runs) detail.appendChild(document.createTextNode(' · '));
          detail.appendChild(record);
        }
        link.appendChild(detail);
        var arrow = document.createElement('span');
        arrow.className = 'stats-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '›';
        link.appendChild(arrow);
        item.appendChild(link);
        rows.appendChild(item);
      });
      var list = document.getElementById('stats-list');
      list.textContent = '';
      list.appendChild(rows);
    }
    renderStats();
    window.addEventListener('pageshow', function (event) { if (event.persisted) renderStats(); });
    window.addEventListener('storage', function (event) { if (!event.key || /^pz_(runs|best)_/.test(event.key)) renderStats(); });
    return;
  }

  Array.prototype.forEach.call(cards, function (card) {
    var id = card.getAttribute('data-id');
    var best = P.store.get('pz_best_' + id, null);
    if (best === null || !units[id]) return;
    var line = card.querySelector('.card-best');
    line.textContent = 'Рекорд: ' + label(units[id], best);
    line.hidden = false;
  });
  document.getElementById('random').addEventListener('click', function () {
    var picked = P.pick(GAMES);
    var versioned = %%VERSIONED%%;
    location.href = versioned[picked] || picked + '/';
  });

  /* ---------- Поддержка звёздами ---------- */
  var msg = document.getElementById('buy-msg');
  var offers = Array.prototype.slice.call(document.querySelectorAll('.offer'));
  var busy = false;
  var STAR = '%%STAR%%';
  function say(text, good) {
    msg.textContent = text || '';
    msg.className = 'buy-msg' + (good ? ' good' : '');
    msg.hidden = !text;
  }
  function render() {
    var p = P.perks();
    document.getElementById('badge').hidden = !P.supporter();
    document.body.classList.toggle('gold', P.gold());
    offers.forEach(function (li) {
      var id = li.getAttribute('data-product'), btn = li.querySelector('.offer-buy');
      /* «Спасибо» можно покупать сколько угодно раз, «Золотой набор» один раз */
      var owned = !!p[id] && id === 'gold';
      li.classList.toggle('owned', owned);
      if (owned) { btn.textContent = 'Уже куплено ✓'; btn.disabled = true; }
      else {
        if (!btn.querySelector('.price')) btn.innerHTML = '<span class="price"></span>' + STAR;
        btn.querySelector('.price').textContent = P.products[id].stars;
        btn.disabled = busy;
      }
      btn.setAttribute('aria-label', P.products[id].title + ': ' + (owned ? 'уже куплено' : P.products[id].stars + ' звёзд'));
    });
  }
  offers.forEach(function (li) {
    var id = li.getAttribute('data-product');
    li.querySelector('.offer-buy').addEventListener('click', function () {
      if (busy) return;
      if (!P.inTelegram) { say('Чтобы оплатить звёздами, открой «Паузу» через @' + P.bot + '.'); return; }
      busy = true; render(); say('Открываем оплату…');
      P.buy(id).then(function (status) {
        if (status === 'paid') say(id === 'gold' ? 'Спасибо за поддержку! Золотой набор теперь твой. Загляни в «Гонку» или «Звездолёт».' : 'Спасибо за поддержку! Твоя звезда уже рядом с названием «Паузы».', true);
        else if (status === 'pending') say('Ждём подтверждения оплаты. Если покупка не появится через пару минут, напиши /paysupport.');
        else if (status === 'failed') say('Оплата не прошла. Попробуй ещё раз.');
        else say('');
      }, function (err) {
        say(err && err.message ? err.message : 'Что-то не получилось. Попробуй ещё раз.');
      }).then(function () { busy = false; render(); });
    });
  });
  render();
  P.syncPerks().then(render);
  /* Рекламное место: объявление из ads.json, а если его нет — приглашение рекламодателям */
  var adEl = document.getElementById('ad');
  P.ad().then(function (a) {
    if (!a) return;
    adEl.classList.add('on');
    adEl.querySelector('.ad-label').textContent = P.adLabel(a);
    adEl.querySelector('.ad-text').textContent = a.text;
    adEl.querySelector('.ad-cta').textContent = (a.button || 'Подробнее') + ' →';
    adEl.href = a.url || adEl.href;
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-tg]'), function (a) {
    a.addEventListener('click', function (e) { if (P.inTelegram) { e.preventDefault(); P.openLink(a.href); } });
  });
  P.ping('hub');
  if (open === 'support' || start === 'support') {
    setTimeout(function () { document.getElementById('support').scrollIntoView({ block: 'start', behavior: P.reduceMotion ? 'auto' : 'smooth' }); }, 60);
  }
})();
</script>
</body>
</html>
'''

page = (TEMPLATE
        .replace('%%KNOWN%%', json.dumps([g['id'] for g in games], ensure_ascii=False))
        .replace('%%VERSIONED%%', json.dumps(versioned_paths, ensure_ascii=False))
        .replace('%%UNITS%%', json.dumps(units, ensure_ascii=False))
        .replace('%%COUNT%%', str(len(games)) + ' ' + ('игра' if len(games) % 10 == 1 and len(games) % 100 != 11 else 'игры' if 2 <= len(games) % 10 <= 4 and not 12 <= len(games) % 100 <= 14 else 'игр'))
        .replace('%%ROWS%%', '\n\n'.join(rows))
        .replace('%%SUPPORT%%', support_html)
        .replace('%%STAR%%', STAR))
(ROOT / 'index.html').write_text(page, encoding='utf-8')
print('hub:', len(games), 'игр,', len(page), 'байт')

# Список игр для бота: бот берёт его с сайта (games.json), так что новые игры появляются в боте без правки кода.
import re
def emoji(s):
    return re.sub(r'\\u\{([0-9A-Fa-f]+)\}', lambda m: chr(int(m.group(1), 16)), s)
ordered = []
for s in data['sections']:
    ordered += [g for g in games if g['section'] == s['id']]
bot_list = [[g['id'], emoji(g['icon']), g['title'], g['into'].strip('«»'), g['about']] for g in ordered]
assert len(bot_list) == len(games)
(ROOT / 'games.json').write_text(json.dumps(bot_list, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('games.json:', len(bot_list))
