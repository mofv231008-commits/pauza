"""Собирает автономный предпросмотр новых игр. Запуск: python3 tools/build_horror_preview.py."""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
IDS = ['nightshift', 'deadfrequency', 'lastlift', 'ritualseal', 'impostorroom']
catalog = json.loads((ROOT / 'tools/catalog.json').read_text(encoding='utf-8'))
games = {g['id']: g for g in catalog['games']}


def inline(game_id):
    page = (ROOT / game_id / 'index.html').read_text(encoding='utf-8')
    page = re.sub(r'<link[^>]*https://fonts\.[^>]*>', '', page)
    for name in ['pauza.css', 'horror.css']:
        page = re.sub(r'<link[^>]*href="\.\./shared/' + re.escape(name) + r'[^>]*>',
                      lambda _: '<style>' + (ROOT / 'shared' / name).read_text(encoding='utf-8') + '</style>', page)
    for name in ['pauza.js', 'horror.js']:
        source = (ROOT / 'shared' / name).read_text(encoding='utf-8')
        if name == 'pauza.js':
            # Предпросмотр не отправляет события в рабочий бот и не меняет боевые рекорды.
            source = source.replace("var inTelegram = hashHasTg", "var inTelegram = false && hashHasTg")
            source = source.replace("'pz_", "'pz_preview_")
            source = re.sub(r'function ping\(game\) \{.*?\n  \}', 'function ping(game) {}', source, count=1, flags=re.S)
            source = re.sub(r'function ad\(\) \{.*?\n  \}', 'function ad() { return Promise.resolve(null); }', source, count=1, flags=re.S)
        page = re.sub(r'<script src="\.\./shared/' + re.escape(name) + r'[^>]*></script>',
                      lambda _, s=source: '<script>' + s + '</script>', page)
    # «Все игры» внутри фрейма возвращает к выбору этих пяти игр.
    page = page.replace("var home = cfg.home || '../';", "var home = '#menu';")
    page = page.replace("a.href = home; return a;", "a.href = home; a.addEventListener('click', function(e) { e.preventDefault(); window.parent.postMessage('pauza-preview-home', '*'); }); return a;")
    return page


pages = {gid: inline(gid) for gid in IDS}
cards = ''.join('<button type="button" class="card" data-game="' + gid + '"><span class="art">' + games[gid]['art'] +
                '</span><b>' + html.escape(games[gid]['title']) + '</b><span>' + html.escape(games[gid]['about']) + '</span><small>60 секунд →</small></button>' for gid in IDS)
page = '''<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark"><title>Пауза · 5 хорроров на минуту</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#100c20;color:#f4f1ff;font:15px system-ui,sans-serif}button{font:inherit;color:inherit}button:focus-visible{outline:3px solid #3DF5B0;outline-offset:3px}[hidden]{display:none!important}main{max-width:860px;margin:auto;padding:32px 20px}header p{color:#b9a8f0;max-width:560px;line-height:1.6}h1{font-size:clamp(28px,5vw,42px);line-height:1.1;margin:12px 0}header small{color:#ff9a6b;letter-spacing:.15em}nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:28px}.card{border:1px solid #55415e;border-radius:20px;background:#211831;padding:12px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:10px}.card:hover{border-color:#ff9a6b}.art{display:block;aspect-ratio:16/9;border-radius:12px;overflow:hidden}.art svg{width:100%;height:100%}.card b{font-size:19px}.card>span:not(.art){font-size:13px;color:#b9a8f0;line-height:1.5;flex:1}.card small{color:#3df5b0}#player{position:fixed;inset:0;display:flex;flex-direction:column;background:#100c20}#top{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;gap:8px;border-bottom:1px solid #55415e;font-size:12px;flex-shrink:0}#back{border:1px solid #55415e;background:#211831;border-radius:10px;padding:8px 12px;cursor:pointer}iframe{border:0;flex:1;min-height:0;width:100%;max-width:460px;align-self:center;background:#100c20}
</style></head><body><main id="menu"><header><small>ПАУЗА / ПРЕДПРОСМОТР</small><h1>Пять минут.<br>Пять причин не гасить свет.</h1><p>Пять новых хорроров по 60 секунд. Выбери игру и нажми «Играть». Пауза, повтор и рекорды работают как в Pauza. Звук не нужен, резких скримеров нет.</p></header><nav aria-label="Выбрать игру">%%CARDS%%</nav></main><section id="player" hidden aria-label="Игровой экран"><div id="top"><button id="back" type="button">← Выбрать игру</button><span id="title"></span></div><iframe title="Игра Pauza" sandbox="allow-scripts allow-same-origin"></iframe></section><script>
var pages=%%PAGES%%,titles=%%TITLES%%;
var player=document.getElementById('player'),frame=document.querySelector('iframe');
function home(){frame.srcdoc='';player.hidden=true;document.getElementById('menu').hidden=false;document.querySelector('.card').focus();}
document.querySelectorAll('[data-game]').forEach(function(b){b.addEventListener('click',function(){document.getElementById('title').textContent=titles[b.dataset.game];frame.srcdoc=pages[b.dataset.game];player.hidden=false;document.getElementById('menu').hidden=true;frame.focus();});});
document.getElementById('back').addEventListener('click',home);
window.addEventListener('message',function(e){if(e.source===frame.contentWindow&&e.data==='pauza-preview-home')home();});
</script></body></html>'''
page = page.replace('%%CARDS%%', cards).replace('%%PAGES%%', json.dumps(pages, ensure_ascii=False).replace('</', '<\\/'))
page = page.replace('%%TITLES%%', json.dumps({gid: games[gid]['title'] for gid in IDS}, ensure_ascii=False))
output = ROOT / 'previews/horror-five.html'
output.parent.mkdir(exist_ok=True)
output.write_text(page, encoding='utf-8')
print('preview:', output, output.stat().st_size, 'bytes')
