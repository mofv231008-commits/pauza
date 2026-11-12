/* Общий каркас викторин «Паузы»: вопрос, 2–4 варианта, минута на всё, ошибка отнимает секунды.
   PauzaQuiz({ id, title, tagline, rules, unit: ['ответ','ответа','ответов'], seconds, penalty, cols,
               next: function () { return { q, sub, opts: [...], right: индекс, html: false } },
               phrase: function (score) {...}, swipe: false, qClass: '' }) */
window.PauzaQuiz = function (cfg) {
  'use strict';
  var P = window.Pauza, stage = document.getElementById('stage');
  var U = cfg.unit || ['ответ', 'ответа', 'ответов'];
  var css = document.createElement('style');
  css.textContent = [
    '.stage{background:var(--shoulder)}',
    '.qz{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:84px 18px 24px}',
    '.qz .timebar{position:absolute;left:16px;right:16px;top:72px}',
    '.qz-sub{margin:0;color:var(--lilac);font-size:15px;text-align:center}',
    '.qz-q{margin:0;font-family:var(--font-display);font-weight:800;font-size:clamp(22px,6.8vw,32px);text-align:center;line-height:1.18;max-width:100%;overflow-wrap:anywhere}',
    '.qz-q.long{font-size:clamp(17px,5vw,22px);font-weight:600;line-height:1.3}',
    '.qz-q.emoji{font-size:clamp(40px,13vw,58px);letter-spacing:4px}',
    '.qz-opts{display:grid;gap:10px;width:min(100%,380px)}',
    '.qz-opts.c2{grid-template-columns:1fr 1fr}',
    '.qz-opts button{min-height:56px;border:0;border-radius:16px;background:var(--road);color:var(--paper);font-family:var(--font-display);font-weight:600;font-size:16px;line-height:1.2;padding:8px 10px;cursor:pointer;touch-action:manipulation}',
    '.qz-opts.big button{min-height:84px;font-size:19px}',
    '.qz-opts button.right{background:var(--mint);color:var(--ink)}',
    '.qz-opts button.wrong{background:var(--coral);color:var(--ink)}',
    '.qz-card{transition:transform .18s ease,opacity .18s ease}',
    '.stage[data-state="paused"] .qz-opts,.stage[data-state="countdown"] .qz-opts,.stage[data-state="paused"] .qz-q,.stage[data-state="countdown"] .qz-q{visibility:hidden}'
  ].join('\n');
  document.head.appendChild(css);
  var wrap = document.createElement('div'); wrap.className = 'qz';
  wrap.innerHTML = '<div class="timebar"><i></i></div><p class="qz-sub"></p><p class="qz-q qz-card"></p><div class="qz-opts"></div>';
  stage.appendChild(wrap);
  var subEl = wrap.querySelector('.qz-sub'), qEl = wrap.querySelector('.qz-q'), optsEl = wrap.querySelector('.qz-opts');
  var cur, score = 0, wrong = 0, busy = false, streak = 0, bestStreak = 0;
  var n0 = 4;

  var shell = P.shell({
    id: cfg.id, title: cfg.title, tagline: cfg.tagline,
    rulesHtml: cfg.rules, overEyebrow: 'Время вышло', countdown: true,
    unit: function (n) { return P.plural(n, U); },
    kbdHint: cfg.swipe ? 'На компьютере: стрелки ← и →' : 'На компьютере: клавиши 1–4',
    onReset: reset
  });
  var timer = P.timeLimit(shell, cfg.seconds || 60, finish, wrap.querySelector('.timebar'));

  function ask() {
    cur = cfg.next();
    subEl.textContent = cur.sub || cfg.sub || '';
    subEl.hidden = !subEl.textContent;
    qEl.className = 'qz-q qz-card' + (cur.cls ? ' ' + cur.cls : cfg.qClass ? ' ' + cfg.qClass : '');
    if (cur.html) qEl.innerHTML = cur.q; else qEl.textContent = cur.q;
    optsEl.textContent = '';
    n0 = cur.opts.length;
    optsEl.className = 'qz-opts' + ((cfg.cols || (n0 === 2 ? 2 : 1)) === 2 ? ' c2' : '') + (n0 <= 3 && cfg.big !== false ? ' big' : '');
    cur.opts.forEach(function (text, k) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = text;
      b.addEventListener('click', function () { answer(b, k); });
      optsEl.appendChild(b);
    });
    qEl.style.transform = ''; qEl.style.opacity = '';
    busy = false;
  }
  function answer(btn, k) {
    if (!shell.running || busy) return;
    busy = true;
    if (k === cur.right) {
      score += cur.points || 1; streak++; bestStreak = Math.max(bestStreak, streak);
      shell.setScore(String(score)); btn.className = 'right'; P.haptic('coin');
      setTimeout(function () { if (shell.running) ask(); }, 330);
    } else {
      wrong++; streak = 0; btn.className = 'wrong'; P.haptic('crash');
      if (optsEl.children[cur.right]) optsEl.children[cur.right].className = 'right';
      timer.add(-(cfg.penalty == null ? 3 : cfg.penalty));
      setTimeout(function () { if (shell.running) ask(); }, cur.explain ? 1500 : 900);
      if (cur.explain) subEl.textContent = cur.explain, subEl.hidden = false;
    }
  }
  function reset() { score = 0; wrong = 0; streak = 0; bestStreak = 0; shell.setScore('0'); timer.reset(); if (cfg.onReset) cfg.onReset(); ask(); }
  function finish() {
    busy = true;
    shell.end({ score: score, delay: 300, stats: 'ошибок: ' + wrong + (bestStreak > 2 ? ' · лучшая серия: ' + bestStreak : ''),
      phrase: cfg.phrase ? cfg.phrase(score) : 'В «' + cfg.title + '» у меня ' + score + ' ' + P.plural(score, U) + ' за минуту. Сможешь больше?' });
  }
  window.addEventListener('keydown', function (e) {
    var m = /^Digit([1-4])$/.exec(e.code);
    if (m && optsEl.children[m[1] - 1]) { optsEl.children[m[1] - 1].click(); return; }
    if (cfg.swipe && (e.code === 'ArrowLeft' || e.code === 'ArrowRight') && optsEl.children.length === 2) { e.preventDefault(); optsEl.children[e.code === 'ArrowLeft' ? 0 : 1].click(); }
  });
  if (cfg.swipe) {
    var sx = null, sy = 0;
    qEl.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    window.addEventListener('pointermove', function (e) { if (sx === null || busy) return; var dx = e.clientX - sx; qEl.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 20 + 'deg)'; });
    window.addEventListener('pointerup', function (e) {
      if (sx === null) return; var dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 60 && !busy && shell.running) { qEl.style.opacity = '0'; optsEl.children[dx < 0 ? 0 : 1].click(); } else qEl.style.transform = '';
    });
  }
  ask(); timer.show();
  return { shell: shell, timer: timer };
};
