"""Apply the approved copy to a local export of the existing Cloudflare Worker.

Usage: python3 tools/refresh_bot_copy.py INPUT.mjs OUTPUT.mjs
The Worker contains private configuration: keep both paths outside this public
repository. Payment handling, webhook verification and storage stay intact.
"""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
COPY = json.loads((ROOT / 'bot/copy-refresh.json').read_text())


def update(source):
    def quoted(value):
        return json.dumps(value, ensure_ascii=False)

    def block(pattern, replacement):
        nonlocal source
        source, count = re.subn(pattern, lambda _: replacement, source, flags=re.M | re.S)
        if count != 1:
            raise ValueError('Expected one matching copy block; live Worker needs review')

    welcome = quoted('\n'.join(COPY['welcome']))
    block(r'^function welcomeText\(\) \{.*?^\}',
          'function welcomeText() {\n  return ' + welcome +
          ' + (AD ? "\\n\\n" + adLabel(AD) + "\\n" + AD.text : "");\n}')
    for name, key in [('DONATE_TEXT', 'donate'), ('TERMS_TEXT', 'terms'),
                      ('PAYSUPPORT_TEXT', 'support'), ('HELP_TEXT', 'help'), ('ADS_TEXT', 'ads')]:
        block(r'^const ' + name + r' = \[.*?^\]\.join\("\\n"\);',
              'const ' + name + ' = ' + quoted('\n'.join(COPY[key])) + ';')
    block(r'^function groupHello\(chatId\) \{.*?^\}',
          'function groupHello(chatId) {\n  return say(chatId, ' + quoted('\n'.join(COPY['group'])) + ', [\n'
          '    [{ text: "Играть", url: PLAY_LINK }],\n'
          '    [{ text: "Позвать сыграть", switch_inline_query_current_chat: "" }],\n'
          '  ]);\n}')
    block(r'^function gameCard\(g\) \{.*?^\}',
          'function gameCard(g) {\n'
          '  const text = "Сыграем в «" + g.title + "»? Посмотрим, у кого получится лучше.";\n'
          '  return card("game-" + g.id, g.icon + " " + g.title, g.about, text, g.id);\n}')
    replacements = {
        'Вызвать друга': 'Позвать друга',
        'отправить вызов': 'позвать друга',
        'Этот счёт устарел. Открой «Паузу» и нажми на цену ещё раз.': 'Этот счёт уже устарел. Открой «Паузу» и снова нажми на цену.',
        'Значок-звезда уже рядом с названием «Паузы».': 'Твоя звезда уже рядом с названием «Паузы».',
        'Машинка, самолётик, змейка и звездолёт уже золотые.': 'Золотой набор теперь твой. Загляни в «Гонку» или «Звездолёт».',
        'Не получилось передать сообщение. Напиши, пожалуйста, напрямую в ': 'Не удалось передать сообщение. Напиши напрямую: ',
        'Передали в поддержку. Ответ придёт в этот чат.': 'Передали сообщение в поддержку. Ответ придёт сюда.',
        'Ответ поддержки «Паузы»:': 'Поддержка «Паузы»:',
        'Как играть с друзьями и в группах': 'Как играть с друзьями',
        'Как бросить вызов': 'Как позвать друзей',
    }
    for old, new in replacements.items():
        source = source.replace(old, new)
    source = re.sub(r'(await tg\(env, "setMyDescription", \{ description: ).*?( \}\);)',
                    lambda m: m[1] + quoted('Есть минутка? Выбирай игру и отвлекись немного. Играй сам, зови друга или играйте вдвоём на одном телефоне. Аркады, головоломки, настольные игры и хорроры — прямо в Telegram.') + m[2], source)
    source = re.sub(r'(await tg\(env, "setMyShortDescription", \{ short_description: ).*?( \}\);)',
                    lambda m: m[1] + quoted('Есть минутка? Выбирай игру и отвлекись немного. Можно позвать друга.') + m[2], source)
    return source


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    output = Path(sys.argv[2]).resolve()
    if output.is_relative_to(ROOT):
        raise SystemExit('Save private Worker exports outside the public repository')
    output.write_text(update(Path(sys.argv[1]).read_text()))
    print('Updated bot copy; private configuration preserved')
