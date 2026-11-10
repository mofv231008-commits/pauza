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
    store: store,
    fmt: fmt,
    plural: plural,
    clamp: clamp,
    clock: clock,
    shell: shell
  };
})();
