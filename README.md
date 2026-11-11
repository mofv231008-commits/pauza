# Пауза

Мини-игры на минуту для Telegram-бота [@Pauzagame_bot](https://t.me/Pauzagame_bot): играть, пока ждёшь ответа в переписке.

## Что где лежит

- `index.html` — экран выбора игр. Ссылка `t.me/Pauzagame_bot/play?startapp=race` сразу открывает нужную игру.
- Ловкость: `race/` Гонка, `flight/` Полёт, `snake/` Змейка, `bounce/` Отскок, `tower/` Башня, `reaction/` Реакция
- Головоломки: `2048/` 2048 за минуту, `match3/` Три в ряд, `fifteen/` Пятнашки, `mines/` Сапёр
- Память и внимание: `pairs/` Пары, `simon/` Повтори, `shade/` Оттенок, `arrows/` Стрелки
- Слова и счёт: `word/` Слово, `math/` Счёт
- `shared/pauza.css` и `shared/pauza.js` — общий стиль и общий скрипт: связь с Telegram, рекорды, пауза, экраны меню, кнопка «Вызвать друга».

## Как устроена игра

Каждая игра — одна страница в своей папке. Она подключает `shared/pauza.css` и `shared/pauza.js` и вызывает `Pauza.shell({...})` с названием, правилами и тремя функциями: `onReset` (новый раунд), `onRun` (игра пошла), `onPause` (пауза). В конце раунда игра вызывает `shell.end({ score, stats, phrase })`.

Словарь игры «Слово» (`word/words.txt`) собран из открытого списка [russian-words](https://github.com/danakt/russian-words) под лицензией MIT, текст лицензии лежит в `word/WORDS-LICENSE.txt`.

Сайт публикуется через GitHub Pages.
