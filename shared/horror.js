/* Каркас минутного раунда поверх штатных меню, рекордов и Telegram-моста. */
(function () {
  'use strict';
  window.PauzaHorror = function (cfg) {
    var P = window.Pauza, timer, score = 0, mistakes = 0;
    var message = document.getElementById('message');
    var shell = P.shell({
      id: cfg.id, title: cfg.title, tagline: cfg.tagline,
      rulesHtml: '<p>' + cfg.rules + '</p>', countdown: true,
      overEyebrow: 'Смена окончена', overTone: 'good',
      unit: function (n) { return P.plural(n, ['очко', 'очка', 'очков']); },
      kbdHint: cfg.kbdHint || 'На компьютере: мышь; P или Escape — пауза',
      onReset: function () { score = 0; mistakes = 0; shell.setScore('0'); timer.reset(); cfg.reset(); },
      onPause: function () { if (cfg.pause) cfg.pause(); }
    });
    timer = P.timeLimit(shell, 60, function () {
      if (cfg.finish) cfg.finish();
      shell.end({ score: score, stats: 'Ошибок: ' + mistakes,
        phrase: 'В «' + cfg.title + '» у меня ' + score + ' ' + P.plural(score, ['очко', 'очка', 'очков']) + ' за минуту.' });
    }, document.getElementById('timebar'));
    var api = {
      shell: shell,
      get score() { return score; },
      get left() { return timer.left; },
      say: function (text, tone) { message.textContent = text; message.dataset.tone = tone || ''; },
      good: function (n) { score += n || 1; shell.setScore(String(score)); P.haptic('coin'); },
      bad: function () { mistakes++; P.haptic('crash'); }
    };
    P.loop(function (dt) { if (shell.running && cfg.tick) cfg.tick(dt); });
    timer.show();
    return api;
  };
})();
