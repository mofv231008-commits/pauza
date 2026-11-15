/* Ten independent mechanics; common Telegram shell, pause and score lifecycle. */
(function () {
'use strict';
const C=window.PauzaGameConfig,P=window.Pauza,$=id=>document.getElementById(id);
let score=0,time=0,s={},held=0,round=0;
const rand=n=>Math.floor(Math.random()*n), pick=a=>a[rand(a.length)];
const shell=P.shell({id:C.id,title:C.title,tagline:C.timed?'Один раунд — одна минута.':'Играй до проигрыша, без лимита времени.',rulesHtml:'<p>'+C.rules+'</p>',countdown:true,formatScore: ["tightrope","boiler"].includes(C.id)?n=>(n/10).toFixed(1).replace(".",",")+" с":undefined,onReset:reset});
function button(label,fn,cls){let b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls||'';b.onclick=()=>{if(shell.running)fn(b);};$('controls').appendChild(b);return b;}
function text(prompt,hint){$('prompt').textContent=prompt;$('hint').textContent=hint||'';}
function clear(){held=0;$('controls').replaceChildren();$('display').replaceChildren();}
function feedback(msg){$('feedback').textContent=msg;}
function add(n){score+=n;shell.setScore(score);}
function finish(reason){held=0;shell.end({score,stats:reason+' · '+time.toFixed(1).replace('.',',')+' с',phrase:'В «'+C.title+'» набрал '+score+' очков. Попробуешь?'});}
function win(){add(10);feedback('Готово! +10');round++;setup();}
function meter(){let d=document.createElement('div');d.className='meter';d.innerHTML='<i></i>';$('display').appendChild(d);$('display').style.width='100%';}
function bar(v){let i=$('display').querySelector('i');if(i)i.style.width=Math.max(0,Math.min(100,v))+'%';}
function reset(){score=0;time=0;round=0;held=0;shell.setScore(0);feedback('');setup();}
function setup(){clear();$('display').style.width='';
switch(C.id){
case 'waterjug':{
 const task=pick([[3,5,4],[3,5,1],[3,5,2],[4,7,5],[4,7,6],[2,5,3],[5,7,6]]);s={cap:task.slice(0,2),v:[0,0],goal:task[2]};
 text('Получи '+s.goal+' л','В любом кувшине. Переливай до края или до пустого.');
 const draw=()=>{ $('display').textContent=s.v[0]+' / '+s.cap[0]+' л 🫙 '+s.v[1]+' / '+s.cap[1]+' л';if(s.v.includes(s.goal))win();};
 [0,1].forEach(i=>{button('Наполнить '+s.cap[i]+' л',()=>{s.v[i]=s.cap[i];draw();});button('Вылить '+s.cap[i]+' л',()=>{s.v[i]=0;draw();});button(s.cap[i]+' → '+s.cap[1-i]+' л',()=>{let q=Math.min(s.v[i],s.cap[1-i]-s.v[1-i]);s.v[i]-=q;s.v[1-i]+=q;draw();});});draw();break;}
case 'onestroke':{
 // All templates have an Euler trail; vary by reflection and rotation.
 const templates=[[[0,1],[1,2],[2,3],[3,0],[0,4],[4,1],[1,3]],[[0,1],[1,2],[2,3],[3,0],[0,2]],[[0,1],[1,2],[2,3],[3,0],[0,4],[4,2],[0,2]]];
 let edges=pick(templates),pts=[[60,135],[240,135],[240,35],[60,35],[150,85]];
 let degrees=Array(5).fill(0);edges.forEach(e=>e.forEach(i=>degrees[i]++));let odds=degrees.map((n,i)=>n%2?i:-1).filter(i=>i>=0);
 s={edges,used:[],at:pick(odds.length?odds:degrees.map((n,i)=>n?i:-1).filter(i=>i>=0))};
 text('Одним росчерком','Зелёная точка — начало. Каждую линию пройди один раз.');
 function draw(){let svg='<svg class="diagram" viewBox="0 0 300 170">';edges.forEach((e,k)=>{svg+='<line class="'+(s.used.includes(k)?'used':'')+'" x1="'+pts[e[0]][0]+'" y1="'+pts[e[0]][1]+'" x2="'+pts[e[1]][0]+'" y2="'+pts[e[1]][1]+'"/>';});pts.forEach((p,i)=>{if(degrees[i])svg+='<circle class="'+(i===s.at?'current':'')+'" cx="'+p[0]+'" cy="'+p[1]+'" r="16"/><text x="'+p[0]+'" y="'+(p[1]+4)+'" text-anchor="middle">'+(i+1)+'</text>';});$('display').innerHTML=svg+'</svg>';}
 degrees.forEach((d,i)=>{if(d)button(String(i+1),()=>{let k=edges.findIndex((e,k)=>!s.used.includes(k)&&e.includes(i)&&e.includes(s.at)&&i!==s.at);if(k<0){feedback('Нет свободной линии к этой точке');return;}s.used.push(k);s.at=i;draw();if(s.used.length===edges.length)win();});});button('Сначала',()=>{s.used=[];s.at=pick(odds.length?odds:[0]);draw();});draw();break;}
case 'morse':{
 const key=[['А','·−'],['Б','−···'],['В','·−−'],['Г','−−·'],['Д','−··'],['Е','·'],['Ж','···−'],['З','−−··']];let target=pick(key);s={answer:target[0]};text(target[1],key.map(x=>x.join(' ')).join('   /   '));key.forEach(x=>button(x[0],()=>{if(x[0]===s.answer)win();else{add(-Math.min(2,score));feedback('Это '+s.answer+' · −2');setup();}}));break;}
case 'binary':{
 let weights=[16,8,4,2,1],target=1+rand(31);s={target,weights,on:weights.map(()=>false)};
 text('Число: '+target,'Переключай биты, затем проверь результат');
 const draw=()=>{$('display').textContent='Сейчас: '+weights.reduce((a,w,i)=>a+(s.on[i]?w:0),0);};
 weights.forEach((w,i)=>button(String(w),b=>{s.on[i]=!s.on[i];b.classList.toggle('active',s.on[i]);draw();}));button('Проверить',()=>{if(weights.reduce((a,w,i)=>a+(s.on[i]?w:0),0)===target)win();else feedback('Пока не совпадает');});draw();break;}
case 'weighing':{
 s={heavy:rand(8),pan:Array(8).fill(0),guess:false,weighs:0};
 text('Одна монета тяжелее','Нажимай монеты: вне весов → слева → справа.');
 const draw=()=>{$('display').textContent='Слева: '+s.pan.map((v,i)=>v===1?i+1:null).filter(Boolean).join(', ')+' / Справа: '+s.pan.map((v,i)=>v===2?i+1:null).filter(Boolean).join(', ');};
 for(let i=0;i<8;i++)button('№ '+(i+1),b=>{if(s.guess){if(i===s.heavy)win();else{add(-Math.min(3,score));feedback('Нет, тяжелее № '+(s.heavy+1));setup();}return;}s.pan[i]=(s.pan[i]+1)%3;b.textContent='№ '+(i+1)+['',' ←',' →'][s.pan[i]];draw();});
 button('Взвесить',()=>{let left=0,right=0;s.pan.forEach((v,i)=>{if(v===1)left+=i===s.heavy?11:10;if(v===2)right+=i===s.heavy?11:10;});s.weighs++;feedback((left===right?'Равновесие':left>right?'Левая чаша тяжелее':'Правая чаша тяжелее')+' · взвешиваний: '+s.weighs);});
 button('Назвать монету',b=>{s.guess=!s.guess;b.classList.toggle('active',s.guess);text(s.guess?'Нажми тяжёлую монету':'Одна монета тяжелее',s.guess?'Правильно: +10. Ошибка: −3.':'Нажимай монеты: вне весов → слева → справа.');});draw();break;}
case 'tightrope':s={x:50,v:0,wind:0,change:0,earned:0};text('Удержи равновесие','Зажми ← или →. Ветер меняет направление.');meter();holdButton('←',-1);holdButton('→',1);break;
case 'boiler':s={pressure:50,heat:9,change:0,earned:0};text('Давление: 50','Зажимай клапан. Безопасный диапазон: 10–90.');meter();holdButton('Выпустить пар',1);break;
case 'rpsread':s={move:rand(3),left:Math.max(.65,3-round*.08),limit:Math.max(.65,3-round*.08)};text('Соперник: '+['✊ камень','✂️ ножницы','✋ бумага'][s.move],'Выбери жест, который его победит');meter();['✊','✂️','✋'].forEach((x,i)=>button(x,()=>{if(i===(s.move+2)%3)win();else finish('Соперник победил');}));break;
case 'riskdice':s={bank:0,lives:3};text('Банк: 0','Жизни: ♥♥♥ · единица сжигает банк');$('display').textContent='🎲';button('Бросить',()=>{let die=1+rand(6);$('display').textContent='Выпало: '+die;if(die===1){s.bank=0;s.lives--;feedback('Единица! Банк сгорел');if(!s.lives){finish('Три неудачных броска');return;}}else{s.bank+=die;feedback('Забрать банк или рискнуть ещё?');}text('Банк: '+s.bank,'Жизни: '+'♥'.repeat(s.lives));});button('Забрать',()=>{if(s.bank){add(s.bank);s.bank=0;text('Банк: 0','Жизни: '+'♥'.repeat(s.lives));feedback('Очки сохранены');}});break;
case 'chomp':s={rows:[4,4,4],bot:false,wait:0};text('Твой ход','Красная клетка отравлена. Убирается всё справа и ниже.');drawChomp();break;
}}
function holdButton(label,value){let b=button(label,()=>{});b.onpointerdown=e=>{if(!shell.running)return;e.preventDefault();held=value;b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{held=0;};}
window.addEventListener('blur',()=>held=0);document.addEventListener('visibilitychange',()=>held=0);
function drawChomp(){ $('controls').replaceChildren();$('controls').style.display='grid';$('controls').style.gridTemplateColumns='repeat(4, 1fr)';for(let y=0;y<3;y++)for(let x=0;x<4;x++){let b=button(y===0&&x===0?'☠️':'🍫',()=>{if(s.bot)return;if(!x&&!y){finish('Попалась отравленная клетка');return;}bite(y,x);s.bot=true;s.wait=.55;text('Ход соперника','Подожди…');drawChomp();},!x&&!y?'poison':'');b.disabled=x>=s.rows[y]||s.bot;if(x>=s.rows[y])b.style.visibility='hidden';}}
function bite(y,x){for(let k=y;k<3;k++)s.rows[k]=Math.min(s.rows[k],x);}
// Exact finite impartial-game solver. A move to (0,0) is always losing.
const memo=new Map();function winning(rows){let key=rows.join();if(memo.has(key))return memo.get(key);for(let y=0;y<3;y++)for(let x=0;x<rows[y];x++){if(!x&&!y)continue;let next=rows.map((v,k)=>k>=y?Math.min(v,x):v);if(!winning(next)){memo.set(key,true);return true;}}memo.set(key,false);return false;}
function botChomp(){let moves=[];for(let y=0;y<3;y++)for(let x=0;x<s.rows[y];x++){if(x||y){let next=s.rows.map((v,k)=>k>=y?Math.min(v,x):v);moves.push({x,y,good:!winning(next)});}}if(!moves.length){add(20);round++;feedback('Сопернику осталась отрава! +20');s={rows:[4,4,4],bot:false,wait:0};text('Новая плитка','Твой ход');drawChomp();return;}let good=moves.filter(m=>m.good),m=pick(Math.random()<.65&&good.length?good:moves);bite(m.y,m.x);s.bot=false;text('Твой ход','Красную клетку брать нельзя');drawChomp();}
P.loop(dt=>{if(!shell.running){held=0;return;}time+=dt;if(C.timed){shell.setSide(Math.ceil(Math.max(0,60-time))+' с',time>50);if(time>=60){finish('Минута закончилась');return;}}else shell.setSide(Math.floor(time)+' с');
if(C.id==='tightrope'){s.change-=dt;if(s.change<=0){s.wind=(Math.random()-.5)*(25+time*.3);s.change=.8+Math.random();}s.v+=(s.wind+held*42)*dt;s.v*=Math.exp(-dt*1.7);s.x+=s.v*dt;bar(s.x);$('prompt').textContent='Баланс: '+Math.round(s.x);if(s.x<=0||s.x>=100){finish('Потерял равновесие');return;}let n=Math.floor(time*10);if(n>score)add(n-score);}
if(C.id==='boiler'){s.change-=dt;if(s.change<=0){s.heat=8+Math.random()*10+time*.15;s.change=2;}s.pressure+=(s.heat-held*34)*dt;bar(s.pressure);$('prompt').textContent='Давление: '+Math.round(s.pressure);if(s.pressure<=10||s.pressure>=90){finish(s.pressure<=10?'Котёл погас':'Избыточное давление');return;}let n=Math.floor(time*10);if(n>score)add(n-score);}
if(C.id==='rpsread'){s.left-=dt;bar(s.left/s.limit*100);if(s.left<=0)finish('Не успел выбрать жест');}
if(C.id==='chomp'&&s.bot){s.wait-=dt;if(s.wait<=0)botChomp();}
});
})();
