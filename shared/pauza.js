/* «Пауза»: общий скрипт всех игр.
   Даёт игре связь с Telegram, рекорды, паузу, экраны меню и кнопку «Вызвать друга».
   Этим же набором функций будут пользоваться сторонние разработчики. */
(function () {
  'use strict';

  var BOT = 'Pauzagame_bot';
  var PLAY_LINK = 'https://t.me/' + BOT + '/play';
  var NIGHT = '#140734';
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  var store = {
    get: function (k, d) {
      return safe(function () { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }, d);
    },
    set: function (k, v) { safe(function () { localStorage.setItem(k, JSON.stringify(v)); }); }
  };

  /* ---------- Telegram ----------
     Свой мост без скрипта с telegram.org: он может не загрузиться в России. */
  var hashHasTg = /tgWebApp(Data|Version|Platform)=/.test(location.hash);
  if (hashHasTg) safe(function () { sessionStorage.setItem('pz_tg', '1'); });
  var inTelegram = hashHasTg || !!window.TelegramWebviewProxy ||
    safe(function () { return sessionStorage.getItem('pz_tg') === '1'; }, false);

  function postEvent(type, data) {
    if (!inTelegram) return false;
    var body = data || {};
    try {
      if (window.TelegramWebviewProxy && window.TelegramWebviewProxy.postEvent) {
        window.TelegramWebviewProxy.postEvent(type, JSON.stringify(body));
        return true;
      }
      if (window.external && 'notify' in window.external) {
        window.external.notify(JSON.stringify({ eventType: type, eventData: body }));
        return true;
      }
      if (window.parent !== window) {
        window.parent.postMessage(JSON.stringify({ eventType: type, eventData: body }), '*');
        return true;
      }
    } catch (e) {}
    return false;
  }

  function init() {
    postEvent('web_app_ready');
    postEvent('web_app_expand');
    postEvent('web_app_setup_swipe_behavior', { allow_vertical_swipe: false });
    postEvent('web_app_set_header_color', { color: NIGHT });
    postEvent('web_app_set_background_color', { color: NIGHT });
    postEvent('web_app_set_bottom_bar_color', { color: NIGHT });
    /* Крестик Telegram сначала спрашивает «Закрыть?», а не выкидывает сразу */
    postEvent('web_app_setup_closing_behavior', { need_confirmation: true });
    if (!backHandler) postEvent('web_app_setup_back_button', { is_visible: false });
  }

  /* Кнопка «Назад» в шапке Telegram вместо крестика. back(fn) — показать, back(null) — спрятать */
  var backHandler = null;
  function back(fn) {
    backHandler = fn || null;
    postEvent('web_app_setup_back_button', { is_visible: !!backHandler });
  }

  /* Какую игру просили открыть по ссылке t.me/…/play?startapp=race */
  function startParam() {
    var fromQuery = safe(function () { return new URLSearchParams(location.search).get('tgWebAppStartParam'); }, null);
    if (fromQuery) return fromQuery;
    return safe(function () {
      var data = new URLSearchParams(location.hash.slice(1)).get('tgWebAppData');
      return data ? new URLSearchParams(data).get('start_param') : null;
    }, null);
  }

  function haptic(kind) {
    if (!kind) return;
    if (inTelegram) {
      if (kind === 'crash') postEvent('web_app_trigger_haptic_feedback', { type: 'notification', notification_type: 'error' });
      else if (kind === 'win') postEvent('web_app_trigger_haptic_feedback', { type: 'notification', notification_type: 'success' });
      else if (kind === 'coin') postEvent('web_app_trigger_haptic_feedback', { type: 'selection_change' });
      else postEvent('web_app_trigger_haptic_feedback', { type: 'impact', impact_style: 'light' });
    } else if (kind === 'crash') {
      safe(function () { if (navigator.vibrate) navigator.vibrate(80); });
    }
  }

  /* «Вызвать друга»: в Telegram вставляет вызов в выбранный чат, в браузере копирует текст */
  function share(gameId, phrase) {
    if (postEvent('web_app_switch_inline_query', { query: gameId + ' ' + phrase, chat_types: ['users', 'groups'] })) {
      return Promise.resolve('telegram');
    }
    var text = phrase + ' Побьёшь? ' + PLAY_LINK + '?startapp=' + gameId;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return 'copied'; }, function () { return Promise.reject(text); });
    }
    return Promise.reject(text);
  }

  /* ---------- Ссылки, реклама и счётчик игроков ---------- */
  var ROOT = safe(function () { return document.currentScript.src.replace(/shared\/pauza\.js.*$/, ''); }, '../');
  var SUPPORT = 'helpPauza';
  function openLink(url) {
    if (!url) return;
    if (/^https:\/\/t\.me\//.test(url)) { if (postEvent('web_app_open_tg_link', { path_full: url.slice(12) })) return; }
    else if (postEvent('web_app_open_link', { url: url })) return;
    window.open(url, '_blank', 'noopener');
  }
  /* Рекламное место. Объявление лежит в ads.json в корне сайта, код менять не нужно. */
  var adPromise = null;
  function today() { return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10); }
  function ad() {
    if (!adPromise) {
      adPromise = fetch(ROOT + 'ads.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (a) {
        return a && a.active && a.text && (!a.until || today() <= a.until) ? a : null;
      }).catch(function () { return null; });
    }
    return adPromise;
  }
  function adLabel(a) { return ['Реклама', a.advertiser, a.erid ? 'erid: ' + a.erid : ''].filter(Boolean).join(' · '); }
  /* Счётчик: случайный номер устройства, без имён и id из Telegram. Нужен, чтобы видеть, сколько людей играет. */
  function deviceId() {
    return safe(function () {
      var v = localStorage.getItem('pz_dev');
      if (!v) { v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('pz_dev', v); }
      return v.replace(/[^a-z0-9]/g, '').slice(0, 32);
    }, '');
  }
  function ping(game) {
    var d = deviceId(); if (!d || !/^[a-z0-9]{1,20}$/.test(game)) return;
    var fresh = safe(function () {
      var k = 'pz_ping_' + game, last = Number(sessionStorage.getItem(k)) || 0;
      if (Date.now() - last < 120000) return false;
      sessionStorage.setItem(k, String(Date.now())); return true;
    }, true);
    if (!fresh) return;
    safe(function () { fetch(BOT_API + '/hit?d=' + d + '&g=' + game, { mode: 'no-cors', keepalive: true }).catch(function () {}); });
  }

  /* ---------- События от Telegram ----------
     Мобильные клиенты вызывают Telegram.WebView.receiveEvent, веб-версия присылает postMessage */
  var listeners = {};
  function on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
  function off(type, fn) {
    var list = listeners[type];
    if (list) listeners[type] = list.filter(function (f) { return f !== fn; });
  }
  function receiveEvent(type, data) {
    (listeners[type] || []).slice().forEach(function (fn) { safe(function () { fn(data || {}); }); });
  }
  on('back_button_pressed', function () { if (backHandler) backHandler(); });
  window.Telegram = window.Telegram || {};
  if (!window.Telegram.WebView) window.Telegram.WebView = { receiveEvent: receiveEvent };
  if (!window.TelegramGameProxy) window.TelegramGameProxy = { receiveEvent: receiveEvent };
  if (!window.TelegramGameProxy_receiveEvent) window.TelegramGameProxy_receiveEvent = receiveEvent;
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent || window.parent === window) return;
    var d = safe(function () { return typeof e.data === 'string' ? JSON.parse(e.data) : e.data; }, null);
    if (d && d.eventType) receiveEvent(d.eventType, d.eventData);
  });

  /* Облачное хранилище Telegram: одно на пользователя и бота, видно со всех его устройств */
  var reqSeq = 0, pending = {};
  on('custom_method_invoked', function (d) {
    var p = pending[d.req_id];
    if (!p) return;
    delete pending[d.req_id];
    if (d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
  });
  function invoke(method, params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var id = 'pz' + (++reqSeq) + '_' + Date.now();
      pending[id] = { resolve: resolve, reject: reject };
      if (!postEvent('web_app_invoke_custom_method', { req_id: id, method: method, params: params })) {
        delete pending[id];
        reject(new Error('no telegram'));
        return;
      }
      setTimeout(function () { if (pending[id]) { delete pending[id]; reject(new Error('timeout')); } }, timeoutMs || 4000);
    });
  }
  var cloud = {
    get: function (keys) { return invoke('getStorageValues', { keys: keys }); },
    set: function (key, value) { return invoke('saveStorageValue', { key: key, value: value }); }
  };

  /* ---------- Звёзды ----------
     Покупки только для красоты: на очки и рекорды они не влияют. */
  var BOT_API = 'https://pauza-bot.mofv231008.workers.dev';
  var PRODUCTS = {
    thanks: { stars: 15, title: 'Спасибо', perk: 'Значок ⭐ на экране выбора' },
    gold: { stars: 75, title: 'Золотой набор', perk: 'Золотые машинка, самолётик, змейка и звездолёт, плюс значок ⭐' }
  };
  var perkCache = null;
  function perks() {
    if (!perkCache) {
      var p = store.get('pz_perks', {});
      perkCache = p && typeof p === 'object' ? p : {};
    }
    return perkCache;
  }
  function grant(id) {
    var p = perks();
    if (!p[id]) p[id] = Date.now();
    store.set('pz_perks', p);
    cloud.set('pz_perks', JSON.stringify(p)).catch(function () {});
  }
  function gold() { return !!perks().gold; }
  function supporter() { var p = perks(); return !!(p.gold || p.thanks); }
  /* Подтягиваем покупки из облака: так они появляются на новом телефоне */
  function syncPerks() {
    if (!inTelegram) return Promise.resolve(perks());
    return cloud.get(['pz_perks']).then(function (res) {
      var remote = safe(function () { return JSON.parse((res && res.pz_perks) || '{}') || {}; }, {});
      var local = perks(), changed = false;
      Object.keys(remote).forEach(function (k) { if (PRODUCTS[k] && !local[k]) { local[k] = remote[k]; changed = true; } });
      if (changed) store.set('pz_perks', local);
      return local;
    }, function () { return perks(); });
  }
  /* Окно оплаты Telegram. Ответ: 'paid', 'cancelled', 'failed' или 'pending' */
  function buy(id) {
    if (!PRODUCTS[id]) return Promise.reject(new Error('Такого набора нет.'));
    if (!inTelegram) return Promise.reject(new Error('Оплата звёздами работает только внутри Telegram. Открой игру через @' + BOT + '.'));
    return fetch(BOT_API + '/invoice?product=' + encodeURIComponent(id)).then(function (r) {
      if (!r.ok) throw new Error('Сервер оплаты не ответил. Попробуй ещё раз через минуту.');
      return r.json();
    }, function () {
      throw new Error('Нет связи с сервером оплаты. Проверь интернет и попробуй ещё раз.');
    }).then(function (data) {
      var m = /^https:\/\/t\.me\/(?:\$|invoice\/)([A-Za-z0-9_\-=]+)$/.exec((data && data.link) || '');
      if (!m) throw new Error('Не получилось создать счёт. Попробуй ещё раз через минуту.');
      var slug = m[1];
      return new Promise(function (resolve, reject) {
        function closed(d) {
          if (d.slug && d.slug !== slug) return;
          off('invoice_closed', closed);
          if (d.status === 'paid') { grant(id); haptic('win'); }
          resolve(d.status || 'cancelled');
        }
        on('invoice_closed', closed);
        if (!postEvent('web_app_open_invoice', { slug: slug })) {
          off('invoice_closed', closed);
          reject(new Error('Не получилось открыть окно оплаты.'));
        }
      });
    });
  }

  /* ---------- Помощники для игр ---------- */

  /* Скруглённые прямоугольники на старых телефонах (iOS 15 и раньше) */
  if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.max(0, Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  /* Холст во всю сцену с учётом плотности пикселей. onResize(view) зовётся при каждом изменении размера. */
  function canvas2d(canvas, stage, onResize) {
    var ctx = canvas.getContext('2d');
    var view = { ctx: ctx, W: 1, H: 1, dpr: 1 };
    var ready = false;
    function fit() {
      var r = stage.getBoundingClientRect();
      var w = Math.max(1, r.width), h = Math.max(1, r.height);
      view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(w * view.dpr); canvas.height = Math.round(h * view.dpr);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      var oldW = view.W, oldH = view.H;
      view.W = w; view.H = h;
      if (onResize && ready) onResize(view, oldW, oldH);
    }
    if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
    window.addEventListener('resize', fit);
    fit();
    /* Первый вызов onResize — после того, как игра получила view */
    Promise.resolve().then(function () { ready = true; if (onResize) onResize(view, 1, 1); });
    return view;
  }

  /* Игровой цикл: fn(dt) каждый кадр, dt в секундах, не больше 0,05 */
  function loop(fn) {
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      fn(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* Ограничение по времени: секунды справа вверху и полоска .timebar, если она есть */
  function timeLimit(game, total, onEnd, bar) {
    var fill = bar ? bar.querySelector('i') : null;
    var t = { left: total, total: total };
    function show() {
      var warn = t.left <= Math.min(10, total / 4);
      game.setSide(Math.ceil(t.left) + ' с', warn);
      if (fill) {
        fill.style.transform = 'scaleX(' + clamp(t.left / total, 0, 1).toFixed(4) + ')';
        bar.classList.toggle('warn', warn);
      }
    }
    t.reset = function () { t.left = total; show(); };
    t.add = function (sec) {
      t.left = clamp(t.left + sec, 0, total * 2); show();
      if (t.left <= 0 && game.running) onEnd();
    };
    t.show = show;
    loop(function (dt) {
      if (!game.running || t.left <= 0) return;
      t.left -= dt;
      if (t.left <= 0) { t.left = 0; show(); onEnd(); } else show();
    });
    return t;
  }

  /* Тап и свайп по элементу. h.tap(x, y, e) в координатах элемента, h.swipe('left'|'right'|'up'|'down') */
  function gestures(el, h) {
    var start = null;
    el.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      start = { x: e.clientX, y: e.clientY, t: Date.now() };
      if (h.down) { var r = el.getBoundingClientRect(); h.down(e.clientX - r.left, e.clientY - r.top, e); }
    });
    el.addEventListener('pointerup', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
        if (h.swipe) h.swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      } else if (h.tap) {
        var r = el.getBoundingClientRect();
        h.tap(e.clientX - r.left, e.clientY - r.top, e);
      }
    });
    el.addEventListener('pointercancel', function () { start = null; });
  }

  /* Стрелки и WASD на компьютере */
  function arrows(fn) {
    var map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
    window.addEventListener('keydown', function (e) {
      var d = map[e.code];
      if (d) { e.preventDefault(); fn(d, e); }
    });
  }

  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(list) { return list[rand(list.length)]; }
  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) { var j = rand(i + 1), t = list[i]; list[i] = list[j]; list[j] = t; }
    return list;
  }

  /* ---------- Мелочи ---------- */
  function fmt(n) { return Math.floor(n).toLocaleString('ru-RU'); }
  function plural(n, forms) {
    n = Math.abs(Math.floor(n));
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var s = sec % 60;
    return Math.floor(sec / 60) + ':' + (s < 10 ? '0' : '') + s;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function focus(node) { safe(function () { node.focus({ preventScroll: true }); }); }

  /* ---------- Каркас игры ----------
     Игра передаёт название, правила и три функции:
       onReset()        подготовить новый раунд
       onRun(isResume)  игра пошла (после старта или после паузы)
       onPause()        игра встала на паузу
     В конце раунда игра вызывает shell.end({ score, stats, phrase }). */
  function shell(cfg) {
    var stage = document.querySelector('.stage');
    var bestKey = 'pz_best_' + cfg.id, runsKey = 'pz_runs_' + cfg.id;
    var best = store.get(bestKey, null);
    var runs = store.get(runsKey, 0) | 0;
    var state = 'start';
    var lastPhrase = '';
    var cdTimer = 0, overTimer = 0, toastTimer = 0;
    var formatScore = cfg.formatScore || fmt;
    var unit = cfg.unit || function () { return ''; };
    var home = cfg.home || '../';
    var pauseKeys = cfg.pauseKeys || ['Space', 'KeyP', 'Escape'];

    function withUnit(n) { var u = unit(n); return formatScore(n) + (u ? ' ' + u : ''); }
    function backLink() { var a = el('a', 'back', '← Все игры'); a.href = home; return a; }
    function button(cls, text, onClick) {
      var b = el('button', 'btn ' + cls, text);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    /* Счёт */
    var hud = el('div', 'hud'); hud.hidden = true;
    var hudMain = el('div');
    var scoreEl = el('div', 'score', '0');
    var bestEl = el('div', 'best');
    hudMain.appendChild(scoreEl); hudMain.appendChild(bestEl);
    var hudRight = el('div', 'hud-right');
    var sideEl = el('div', 'side'); sideEl.hidden = true;
    var pauseBtn = el('button', 'icon-btn'); pauseBtn.type = 'button';
    pauseBtn.setAttribute('aria-label', 'Поставить на паузу');
    var bars = el('span', 'bars'); bars.appendChild(el('i')); bars.appendChild(el('i'));
    pauseBtn.appendChild(bars);
    hudRight.appendChild(sideEl); hudRight.appendChild(pauseBtn);
    hud.appendChild(hudMain); hud.appendChild(hudRight);

    var cd = el('div', 'countdown', '3'); cd.hidden = true;

    /* Экран «Старт» */
    var startScr = el('section', 'overlay');
    var sp = el('div', 'panel');
    var mark = el('div', 'mark'); mark.setAttribute('aria-hidden', 'true');
    mark.appendChild(el('i')); mark.appendChild(el('i'));
    sp.appendChild(mark);
    sp.appendChild(el('h1', '', cfg.title));
    sp.appendChild(el('p', 'tag', cfg.tagline));
    if (cfg.rulesHtml) { var rules = el('div', 'rules'); rules.innerHTML = cfg.rulesHtml; sp.appendChild(rules); }
    var startActions = el('div', 'actions');
    var startBtn = button('btn-primary', cfg.startLabel || 'Играть', begin);
    startActions.appendChild(startBtn);
    sp.appendChild(startActions);
    var bestLine = el('p', 'best-line'); bestLine.hidden = true;
    sp.appendChild(bestLine);
    if (cfg.kbdHint) sp.appendChild(el('p', 'kbd-hint', cfg.kbdHint));
    sp.appendChild(backLink());
    startScr.appendChild(sp);

    /* Экран «Пауза» */
    var pauseScr = el('section', 'overlay'); pauseScr.hidden = true;
    var pp = el('div', 'panel');
    pp.appendChild(el('h2', '', 'Пауза'));
    pp.appendChild(el('p', 'pause-text', 'Тебе ответили? Беги в чат, игра подождёт.'));
    var pauseActions = el('div', 'actions');
    var resumeBtn = button('btn-primary', 'Дальше', resume);
    pauseActions.appendChild(resumeBtn);
    pauseActions.appendChild(button('btn-ghost', 'Заново', begin));
    pp.appendChild(pauseActions);
    pp.appendChild(backLink());
    pauseScr.appendChild(pp);

    /* Экран «Итог» */
    var overScr = el('section', 'overlay'); overScr.hidden = true;
    var op = el('div', 'panel');
    var eyebrow = el('p', 'eyebrow');
    var big = el('p', 'big');
    var bigLabel = el('p', 'big-label');
    var record = el('p', 'record');
    var stats = el('p', 'stats');
    op.appendChild(eyebrow); op.appendChild(big); op.appendChild(bigLabel); op.appendChild(record); op.appendChild(stats);
    var overActions = el('div', 'actions');
    var againBtn = button('btn-primary', 'Ещё раз', begin);
    overActions.appendChild(againBtn);
    overActions.appendChild(button('btn-ghost', 'Вызвать друга', function () {
      share(cfg.id, lastPhrase).then(function (how) {
        if (how === 'copied') toast('Скопировано. Отправь другу в чат');
      }, function (text) {
        toast('Скопируй и отправь другу: ' + text, true);
      });
    }));
    op.appendChild(overActions);
    var adBox = el('button', 'ad-line'); adBox.type = 'button'; adBox.hidden = true;
    op.appendChild(adBox);
    op.appendChild(backLink());
    overScr.appendChild(op);

    var toastEl = el('div', 'toast'); toastEl.hidden = true; toastEl.setAttribute('role', 'status');

    [hud, cd, startScr, pauseScr, overScr, toastEl].forEach(function (n) { stage.appendChild(n); });

    function sync() { stage.setAttribute('data-state', state); }
    function show(scr) { [startScr, pauseScr, overScr].forEach(function (s) { s.hidden = s !== scr; }); }
    function showBest() {
      var has = best !== null;
      bestEl.textContent = has ? 'рекорд ' + formatScore(best) : '';
      bestLine.hidden = !has;
      if (has) { bestLine.textContent = 'Твой рекорд: '; bestLine.appendChild(el('b', '', withUnit(best))); }
    }
    function toast(msg, long) {
      toastEl.textContent = msg; toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.hidden = true; }, long ? 8000 : 2600);
    }
    function stopCountdown() { clearInterval(cdTimer); cd.hidden = true; }
    function countdownThen(fn) {
      state = 'countdown'; sync();
      var n = 3;
      cd.textContent = '3'; cd.hidden = false;
      clearInterval(cdTimer);
      cdTimer = setInterval(function () {
        n--;
        if (n <= 0) { stopCountdown(); fn(); } else cd.textContent = String(n);
      }, 430);
    }
    function run(isResume) {
      state = 'running'; sync();
      if (!isResume) ping(cfg.id);
      if (cfg.onRun) cfg.onRun(!!isResume);
    }
    function begin() {
      stopCountdown(); clearTimeout(overTimer);
      toastEl.hidden = true;
      if (cfg.onReset) cfg.onReset();
      hud.hidden = false; show(null); showBest();
      if (cfg.countdown) countdownThen(function () { run(false); }); else run(false);
    }
    function pause() {
      if (state !== 'running' && state !== 'countdown') return;
      stopCountdown();
      state = 'paused'; sync();
      if (cfg.onPause) cfg.onPause();
      show(pauseScr); focus(resumeBtn);
    }
    function resume() {
      if (state !== 'paused') return;
      show(null);
      if (cfg.countdown) countdownThen(function () { run(true); }); else run(true);
    }
    function end(res) {
      if (state === 'over' || state === 'start') return;
      stopCountdown();
      state = 'over'; sync();
      var score = res.score;
      var isNew = res.record !== false && score > 0 &&
        (best === null || (cfg.lowerIsBetter ? score < best : score > best));
      if (isNew) { best = score; store.set(bestKey, best); }
      runs++; store.set(runsKey, runs);
      lastPhrase = res.phrase || '';
      haptic(res.haptic || (isNew ? 'win' : null));
      clearTimeout(overTimer);
      overTimer = setTimeout(function () {
        eyebrow.textContent = res.eyebrow || cfg.overEyebrow || 'Итог';
        eyebrow.className = 'eyebrow' + ((res.tone || cfg.overTone) === 'good' ? ' good' : '');
        big.textContent = formatScore(score);
        bigLabel.textContent = unit(score);
        bigLabel.hidden = !bigLabel.textContent;
        record.textContent = isNew ? 'Новый рекорд!' : (best !== null ? 'Рекорд: ' + withUnit(best) : '');
        record.className = 'record' + (isNew ? ' new' : '');
        record.hidden = !record.textContent;
        stats.textContent = res.stats || '';
        stats.hidden = !res.stats;
        show(overScr); focus(againBtn);
        ad().then(function (a) {
          if (!a) return;
          adBox.textContent = '';
          adBox.appendChild(el('span', 'ad-label', adLabel(a)));
          adBox.appendChild(el('span', 'ad-text', a.text));
          adBox.onclick = function () { openLink(a.url); };
          adBox.hidden = false;
        });
      }, res.delay || 0);
    }

    var lastScore = '', lastSide = null, lastWarn = false;
    function setScore(text) {
      text = String(text);
      if (text !== lastScore) { lastScore = text; scoreEl.textContent = text; }
    }
    function setSide(html, warn) {
      if (html !== lastSide) {
        lastSide = html;
        sideEl.hidden = html == null;
        if (html != null) sideEl.innerHTML = html;
      }
      warn = !!warn;
      if (warn !== lastWarn) { lastWarn = warn; sideEl.classList.toggle('warn', warn); }
    }

    pauseBtn.addEventListener('click', pause);
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
    window.addEventListener('blur', pause);
    window.addEventListener('keydown', function (e) {
      if (pauseKeys.indexOf(e.code) === -1) return;
      if (state === 'running' || state === 'countdown') { e.preventDefault(); pause(); }
      else if (state === 'paused' && e.code !== 'Escape') { e.preventDefault(); resume(); }
    });

    init();
    /* «Назад» в шапке: во время игры ставит на паузу, иначе возвращает к списку игр */
    back(function () {
      if (state === 'running' || state === 'countdown') pause();
      else location.href = home;
    });
    sync();
    showBest();

    return {
      get state() { return state; },
      get running() { return state === 'running'; },
      get best() { return best; },
      get runs() { return runs; },
      setScore: setScore,
      setSide: setSide,
      end: end,
      pause: pause,
      toast: toast
    };
  }

  window.Pauza = {
    bot: BOT,
    playLink: PLAY_LINK,
    inTelegram: inTelegram,
    reduceMotion: reduceMotion,
    init: init,
    startParam: startParam,
    haptic: haptic,
    share: share,
    on: on,
    off: off,
    postEvent: postEvent,
    back: back,
    cloud: cloud,
    products: PRODUCTS,
    perks: perks,
    gold: gold,
    supporter: supporter,
    syncPerks: syncPerks,
    buy: buy,
    store: store,
    fmt: fmt,
    plural: plural,
    clamp: clamp,
    clock: clock,
    canvas: canvas2d,
    loop: loop,
    timeLimit: timeLimit,
    gestures: gestures,
    arrows: arrows,
    rand: rand,
    pick: pick,
    shuffle: shuffle,
    openLink: openLink,
    ad: ad,
    adLabel: adLabel,
    ping: ping,
    support: SUPPORT,
    shell: shell
  };
})();
