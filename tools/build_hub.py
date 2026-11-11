"""Собирает index.html (экран выбора игр) из tools/catalog.json.

Запуск: python3 tools/build_hub.py
В каталоге у каждой игры: id (папка), title, into (винительный падеж для «Сыграем в …»),
about (короткое описание), section, icon (эмодзи для бота), unit (подпись рекорда), art (SVG карточки), new.
"""
import json, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((ROOT / 'tools' / 'catalog.json').read_text(encoding='utf-8'))
games = data['games']
by_id = {g['id']: g for g in games}
assert len(by_id) == len(games), 'повторяется id'
for g in games:
    assert (ROOT / g['id'] / 'index.html').exists(), 'нет папки игры ' + g['id']

STAR = '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>'


def card(g):
    art = g['art'].replace('\n', '\n          ')
    return f'''      <li><a class="card" href="{g['id']}/" data-id="{g['id']}">
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
fresh = [g for g in games if g.get('new')]
if fresh:
    rows.append(row('new', 'Новые игры', fresh))
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
      <p class="support-lead">Игры бесплатные и без рекламы. Если нравится, можно поддержать звёздами Telegram. Покупки только для красоты: на очки и рекорды они не влияют.</p>
      <ul class="offers">
        <li class="offer" data-product="thanks">
          <span class="offer-icon" aria-hidden="true"><svg viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#3B1E8C"/><path d="M20 8.5l3.4 7.2 7.8.9-5.8 5.4 1.6 7.7L20 25.8l-7 3.9 1.6-7.7-5.8-5.4 7.8-.9z" fill="#FFD84D"/></svg></span>
          <span class="offer-text"><span class="offer-title">Спасибо</span><span class="offer-perk">Значок ⭐ рядом с названием</span></span>
          <button class="offer-buy" type="button"><span class="price">15</span>%%STAR%%</button>
        </li>
        <li class="offer" data-product="gold">
          <span class="offer-icon" aria-hidden="true"><svg viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#3B1E8C"/><rect x="13" y="9" width="14" height="22" rx="5" fill="#FFD84D"/><rect x="15.5" y="13" width="9" height="5" rx="2" fill="#22105A"/><rect x="15.5" y="23" width="9" height="4" rx="2" fill="#22105A"/><path d="M20 31.5l1.2 2.5 2.8.3-2 1.9.5 2.7-2.5-1.4-2.5 1.4.5-2.7-2-1.9 2.8-.3z" fill="#FF9A6B"/></svg></span>
          <span class="offer-text"><span class="offer-title">Золотой набор</span><span class="offer-perk">Золотые машинка, самолётик, змейка и звездолёт, плюс значок&nbsp;⭐</span></span>
          <button class="offer-buy" type="button"><span class="price">75</span>%%STAR%%</button>
        </li>
      </ul>
      <p class="buy-msg" id="buy-msg" role="status" hidden></p>
      <p class="support-terms">Нажимая на цену, ты соглашаешься с <a href="terms/">условиями покупок</a>. Помощь с оплатой: команда /paysupport в боте.</p>
    </div>
  </section>'''.replace('%%STAR%%', STAR)

TEMPLATE = r'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#140734">
<meta name="color-scheme" content="dark">
<title>Пауза</title>
<script src="shared/pauza.js?v=4"></script>
<script>
/* Ссылка вида t.me/Pauzagame_bot/play?startapp=race сразу открывает нужную игру */
(function () {
  var known = %%KNOWN%%;
  var wanted = window.Pauza.startParam();
  if (wanted && known.indexOf(wanted) !== -1) location.replace(wanted + '/' + location.hash);
})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=Unbounded:wght@600;800&display=swap" media="print" onload="this.media='all'">
<link rel="stylesheet" href="shared/pauza.css?v=4">
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
  flex:none;appearance:none;border:0;border-radius:14px;min-width:84px;min-height:44px;padding:0 14px;
  display:inline-flex;align-items:center;justify-content:center;gap:5px;
  background:var(--sun);color:var(--ink);font-family:var(--font-display);font-weight:600;font-size:15px;cursor:pointer;
}
.offer-buy .star{width:16px;height:16px;fill:var(--ink);flex:none}
.offer-buy:disabled{opacity:.55;cursor:default}
.offer.owned .offer-buy{background:transparent;color:var(--mint);border:1px solid rgba(61,245,176,.45);opacity:1}
.buy-msg{margin:0;padding:10px 12px;border-radius:12px;background:rgba(244,241,255,.08);font-size:14px;line-height:1.4}
.buy-msg.good{background:rgba(61,245,176,.14);color:var(--mint)}
.support-terms{margin:0;font-size:12px;line-height:1.45;color:var(--lilac)}
.support-terms a{color:var(--paper)}
</style>
</head>
<body class="hub">
<main class="hub-wrap">
  <header class="hub-head">
    <div class="mark" aria-hidden="true"><i></i><i></i></div>
    <div>
      <h1>Пауза <span class="badge" id="badge" title="Спасибо за поддержку" hidden>%%STAR%%</span></h1>
      <p class="tag">%%COUNT%% игр на минуту, пока ждёшь ответа.</p>
    </div>
  </header>
  <div class="hub-actions">
    <button class="chip" type="button" id="random"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#3DF5B0" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="#3DF5B0"/><circle cx="15.5" cy="15.5" r="1.6" fill="#3DF5B0"/><circle cx="12" cy="12" r="1.6" fill="#3DF5B0"/></svg>Случайная игра</button>
    <a class="chip" href="#support"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="#FFD84D"/></svg>Поддержать</a>
  </div>

%%ROWS%%

%%SUPPORT%%

  <p class="hub-foot">Набери @Pauzagame_bot в любом чате, чтобы позвать друга.</p>
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
  /* Рекорд гонки из первой версии игры */
  if (P.store.get('pz_best_race', null) === null && P.store.get('pz_best', 0) > 0) {
    P.store.set('pz_best_race', P.store.get('pz_best', 0));
  }
  P.init();
  Array.prototype.forEach.call(document.querySelectorAll('.card'), function (card) {
    var id = card.getAttribute('data-id');
    var best = P.store.get('pz_best_' + id, null);
    if (best === null || !units[id]) return;
    var line = card.querySelector('.card-best');
    line.textContent = 'Рекорд: ' + label(units[id], best);
    line.hidden = false;
  });
  document.getElementById('random').addEventListener('click', function () {
    location.href = P.pick(GAMES) + '/';
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
      if (owned) { btn.textContent = 'Есть ✓'; btn.disabled = true; }
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
      if (!P.inTelegram) { say('Оплата звёздами работает только внутри Telegram. Открой «Паузу» через @' + P.bot + '.'); return; }
      busy = true; render(); say('Открываю оплату…');
      P.buy(id).then(function (status) {
        if (status === 'paid') say(id === 'gold' ? 'Спасибо! Золотой набор включён: загляни в «Гонку» или «Звездолёт».' : 'Спасибо за поддержку! Значок ⭐ уже рядом с названием.', true);
        else if (status === 'pending') say('Оплата обрабатывается. Если покупка не появится через пару минут, напиши /paysupport в боте.');
        else if (status === 'failed') say('Оплата не прошла. Можно попробовать ещё раз.');
        else say('');
      }, function (err) {
        say(err && err.message ? err.message : 'Что-то пошло не так. Попробуй ещё раз.');
      }).then(function () { busy = false; render(); });
    });
  });
  render();
  P.syncPerks().then(render);
  var open = new URLSearchParams(location.search).get('open');
  if (open === 'support' || P.startParam() === 'support') {
    setTimeout(function () { document.getElementById('support').scrollIntoView({ block: 'start', behavior: P.reduceMotion ? 'auto' : 'smooth' }); }, 60);
  }
})();
</script>
</body>
</html>
'''

page = (TEMPLATE
        .replace('%%KNOWN%%', json.dumps([g['id'] for g in games], ensure_ascii=False))
        .replace('%%UNITS%%', json.dumps(units, ensure_ascii=False))
        .replace('%%COUNT%%', str(len(games)))
        .replace('%%ROWS%%', '\n\n'.join(rows))
        .replace('%%SUPPORT%%', support_html)
        .replace('%%STAR%%', STAR))
(ROOT / 'index.html').write_text(page, encoding='utf-8')
print('hub:', len(games), 'игр,', len(page), 'байт')
