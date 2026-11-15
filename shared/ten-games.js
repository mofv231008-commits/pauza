/* Ten independent mechanics; common Telegram shell, pause and score lifecycle. */
(function () {
'use strict';
const C=window.PauzaGameConfig,P=window.Pauza,$=id=>document.getElementById(id);
let score=0,time=0,s={},held=0,round=0,visualTime=0,streak=0;
const themes={waterjug:['Гидролаборатория','Собери точный объём'],onestroke:['Неоновая сеть','Замкни маршрут'],morse:['Радиорубка','Расшифруй передачу'],binary:['Пульт доступа','Собери код из битов'],weighing:['Монетный двор','Раскрой подделку'],tightrope:['Над городом','Удержись на канате'],boiler:['Машинное отделение','Сдерживай давление'],rpsread:['Арена жестов','Переиграй соперника'],riskdice:['Комната риска','Забери выигрыш вовремя'],chomp:['Сладкая западня','Оставь отраву сопернику']};
document.body.dataset.game=C.id;
const room=document.createElement('div');room.className='room-label';room.innerHTML='<span>'+themes[C.id][0]+'</span><b id="chapter">'+themes[C.id][1]+'</b>';document.querySelector('.minigame').prepend(room);
const svg=(body,cls='')=>'<svg class="scene '+cls+'" viewBox="0 0 320 190" aria-hidden="true">'+body+'</svg>';
function status(){const el=$('chapter');if(el)el.textContent=['tightrope','boiler'].includes(C.id)?'Выживание · '+Math.floor(time)+' с':C.id==='riskdice'?'В банке '+s.bank+' · жизни '+s.lives:C.id==='chomp'?'Партия '+(round+1):'Этап '+(round+1)+' · '+(C.timed?'60 секунд':'до проигрыша');}
function pulse(kind){let el=document.querySelector('.minigame');el.classList.remove('success','mistake');void el.offsetWidth;el.classList.add(kind);}
function drawDie(value){$('display').innerHTML='<div class="dice-table"><div class="die">'+Array.from({length:9},(_,i)=>'<i class="'+([[],[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]][value||1].includes(i)?'pip':'')+'"></i>').join('')+'</div><span class="bank-label">'+(value?'Выпало '+value:'Твой следующий ход')+'</span></div>';}
function drawBalance(){let a=(s.x-50)*.65;$('display').innerHTML=svg('<g class="skyline"><path d="M0 175V120h30v55h10V95h35v80h12v-42h28v42h26V111h27v64h16V85h36v90h20v-55h28v55h20V105h32v85H0"/></g><path d="M15 131Q160 151 305 131" class="rope"/><g transform="translate('+ (50+s.x*2.2)+' 103) rotate('+a+')"><circle cy="-39" r="9" fill="#FFD84D"/><path d="M0-28v25m0 0-13 26m13-26 13 26m-43-42h86" class="acrobat"/></g><path d="M'+(s.wind>0?32:260)+' 30h28m-28 8h20" stroke="#B9A8F0" stroke-width="2"/><text x="160" y="25" text-anchor="middle" class="scene-caption">ВЕТЕР '+(s.wind>0?'→':'←')+'</text>');}
function drawBoiler(){let danger=s.pressure<25||s.pressure>75;document.body.classList.toggle('danger',danger);$('display').innerHTML=svg('<path d="M0 150h64m194 0h62M252 75h33V20" class="pipe"/><rect x="64" y="44" width="192" height="128" rx="24" class="tank"/><path d="M74 68h172m-166 96v22m160-22v22" class="pipe"/><circle cx="160" cy="100" r="39" fill="#110c23" stroke="'+(danger?'#FF6B4A':'#B9A8F0')+'" stroke-width="5"/><path d="M130 108a32 32 0 0 1 60 0" fill="none" stroke="#3DF5B0" stroke-width="5"/><path d="M160 100l0-27" stroke="#FFD84D" stroke-width="4" transform="rotate('+(s.pressure*2.4-120)+' 160 100)"/><circle cx="160" cy="100" r="5" fill="#FFD84D"/><text x="160" y="125" text-anchor="middle" class="scene-caption">'+Math.round(s.pressure)+' BAR</text><path d="M104 42q-12-16 0-30m28 30q-12-16 0-30m70 30q-12-16 0-30" class="steam '+(held?'venting':'')+'"/><path d="m135 167 12-26 13 14 14-24 13 36" fill="#FF9A6B" class="flame"/>');}

const rand=n=>Math.floor(Math.random()*n), pick=a=>a[rand(a.length)];
const shell=P.shell({id:C.id,title:C.title,tagline:C.timed?'Один раунд — одна минута.':'Играй до проигрыша, без лимита времени.',rulesHtml:'<p>'+C.rules+'</p>'+(C.timed?'<p>Три верных решения подряд — бонус +5 очков.</p>':''),countdown:true,formatScore: ["tightrope","boiler"].includes(C.id)?n=>(n/10).toFixed(1).replace(".",",")+" с":undefined,onReset:reset});
function button(label,fn,cls){let b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls||'';b.onclick=()=>{if(shell.running){fn(b);status();}};$('controls').appendChild(b);return b;}
function text(prompt,hint){$('prompt').textContent=prompt;$('hint').textContent=hint||'';}
function clear(){held=0;$('controls').replaceChildren();$('display').replaceChildren();}
function feedback(msg){$('feedback').textContent=msg;if(/Нет|не совпадает|−/.test(msg))streak=0;if(msg) pulse(/Нет|не совпадает|сгорел|Единица|Нет свободной|−/.test(msg)?'mistake':'success');}
function add(n){score+=n;shell.setScore(score);}
function finish(reason){held=0;shell.end({score,stats:reason+' · '+time.toFixed(1).replace('.',',')+' с',phrase:'В «'+C.title+'» набрал '+score+' очков. Попробуешь?'});}
function win(){streak++;let bonus=C.timed&&streak%3===0?5:0;add(10+bonus);round++;feedback(bonus?'Три подряд! +15 · бонус за серию':'Отлично! +10 · следующий этап');setup();status();}
function meter(){let d=document.createElement('div');d.className='meter';d.innerHTML='<i></i>';$('display').appendChild(d);$('display').style.width='100%';}
function bar(v){let i=$('display').querySelector('i');if(i)i.style.width=Math.max(0,Math.min(100,v))+'%';}
function reset(){score=0;time=0;round=0;held=0;streak=0;visualTime=0;shell.setScore(0);feedback('');document.body.classList.remove('danger');setup();status();}
function setup(){clear();$('display').style.width='';
switch(C.id){
case 'waterjug':{
 const task=pick([[3,5,4],[3,5,1],[3,5,2],[4,7,5],[4,7,6],[2,5,3],[5,7,6]]);s={cap:task.slice(0,2),v:[0,0],goal:task[2]};
 text('Получи '+s.goal+' л','В любом кувшине. Переливай до края или до пустого.');
 const draw=()=>{ $('display').innerHTML='<div class="jug-scene">'+s.cap.map((cap,i)=>'<div class="jug-wrap"><span class="jug-name">'+(i?'Б':'А')+' · '+cap+' л</span><div class="jug" style="--capacity:'+cap+'"><div class="water" style="height:'+(s.v[i]/cap*100)+'%"></div><div class="jug-ticks"></div><strong>'+s.v[i]+'<small> л</small></strong></div></div>').join('')+'<div class="target-tag">ЦЕЛЬ <b>'+s.goal+' л</b></div></div>';if(s.v.includes(s.goal))win();};
 [0,1].forEach(i=>{button('Наполнить '+s.cap[i]+' л',()=>{s.v[i]=s.cap[i];draw();});button('Вылить '+s.cap[i]+' л',()=>{s.v[i]=0;draw();});button(s.cap[i]+' → '+s.cap[1-i]+' л',()=>{let q=Math.min(s.v[i],s.cap[1-i]-s.v[1-i]);s.v[i]-=q;s.v[1-i]+=q;draw();});});draw();break;}
case 'onestroke':{
 // All templates have an Euler trail; vary by reflection and rotation.
 const templates=[[[0,1],[1,2],[2,3],[3,0],[0,4],[4,1],[1,3]],[[0,1],[1,2],[2,3],[3,0],[0,2]],[[0,1],[1,2],[2,3],[3,0],[0,4],[4,2],[0,2]]];
 let edges=pick(templates),pts=[[60,135],[240,135],[240,35],[60,35],[150,85]];
 let degrees=Array(5).fill(0);edges.forEach(e=>e.forEach(i=>degrees[i]++));let odds=degrees.map((n,i)=>n%2?i:-1).filter(i=>i>=0);
 s={edges,used:[],at:pick(odds.length?odds:degrees.map((n,i)=>n?i:-1).filter(i=>i>=0))};
 text('Одним росчерком','Зелёная точка — начало. Каждую линию пройди один раз.');
 function draw(){let svg='<svg class="diagram" viewBox="0 0 300 170">';edges.forEach((e,k)=>{svg+='<line class="'+(s.used.includes(k)?'used':'')+'" x1="'+pts[e[0]][0]+'" y1="'+pts[e[0]][1]+'" x2="'+pts[e[1]][0]+'" y2="'+pts[e[1]][1]+'"/>';});pts.forEach((p,i)=>{if(degrees[i])svg+='<circle data-node="'+i+'" class="'+(i===s.at?'current':'')+'" cx="'+p[0]+'" cy="'+p[1]+'" r="16"/><text x="'+p[0]+'" y="'+(p[1]+4)+'" text-anchor="middle">'+(i+1)+'</text>';});$('display').innerHTML=svg+'</svg>';$('display').querySelectorAll('[data-node]').forEach(n=>n.onclick=()=>{if(shell.running){let i=Number(n.dataset.node);$('controls').children[i].click();}});}
 degrees.forEach((d,i)=>{if(d)button(String(i+1),()=>{let k=edges.findIndex((e,k)=>!s.used.includes(k)&&e.includes(i)&&e.includes(s.at)&&i!==s.at);if(k<0){feedback('Нет свободной линии к этой точке');return;}s.used.push(k);s.at=i;draw();if(s.used.length===edges.length)win();});});button('Сначала',()=>{s.used=[];s.at=pick(odds.length?odds:[0]);draw();});draw();break;}
case 'morse':{
 const key=[['А','·−'],['Б','−···'],['В','·−−'],['Г','−−·'],['Д','−··'],['Е','·'],['Ж','···−'],['З','−−··']];let target=pick(key);s={answer:target[0]};text(target[1],key.map(x=>x.join(' ')).join('   /   '));$('display').innerHTML='<div class="radio"><div class="radio-screen"><span>ВХОДЯЩИЙ СИГНАЛ</span><strong>'+target[1]+'</strong><div class="wave"></div></div><div class="radio-dials"><i></i><span>PAUZA · FM 108.0</span><i></i></div></div>';key.forEach(x=>button(x[0],()=>{if(x[0]===s.answer)win();else{add(-Math.min(2,score));feedback('Это '+s.answer+' · −2');setup();}}));break;}
case 'binary':{
 let weights=[16,8,4,2,1],target=1+rand(31);s={target,weights,on:weights.map(()=>false)};
 text('Число: '+target,'Переключай биты, затем проверь результат');
 const draw=()=>{$('display').innerHTML='<div class="terminal"><span>ACCESS CONTROL / '+(round+1)+'</span><strong>'+weights.reduce((a,w,i)=>a+(s.on[i]?w:0),0).toString().padStart(2,'0')+'<small> / '+target+'</small></strong><div class="bit-lamps">'+s.on.map(v=>'<i class="'+(v?'lit':'')+'">'+(v?'1':'0')+'</i>').join('')+'</div></div>';};
 weights.forEach((w,i)=>button(String(w),b=>{s.on[i]=!s.on[i];b.classList.toggle('active',s.on[i]);draw();}));button('Проверить',()=>{if(weights.reduce((a,w,i)=>a+(s.on[i]?w:0),0)===target)win();else feedback('Пока не совпадает');});draw();break;}
case 'weighing':{
 s={heavy:rand(8),pan:Array(8).fill(0),guess:false,weighs:0,tilt:0};
 text('Одна монета тяжелее','Нажимай монеты: вне весов → слева → справа.');
 const draw=()=>{$('display').innerHTML=svg('<path d="M160 37v127m-40 7h80" class="scale-frame"/><g transform="rotate('+s.tilt+' 160 52)"><path d="M62 52h196m-196 0-24 68m24-68 24 68m172-68-24 68m24-68 24 68" class="scale-frame"/><path d="M32 119h60q-5 22-30 22t-30-22m196 0h60q-5 22-30 22t-30-22" fill="#3DF5B0"/><text x="62" y="110" text-anchor="middle" class="scene-caption">'+s.pan.map((v,i)=>v===1?i+1:null).filter(Boolean).join(' ')+'</text><text x="258" y="110" text-anchor="middle" class="scene-caption">'+s.pan.map((v,i)=>v===2?i+1:null).filter(Boolean).join(' ')+'</text></g><circle cx="160" cy="52" r="8" fill="#FFD84D"/>');};
 for(let i=0;i<8;i++)button('№ '+(i+1),b=>{if(s.guess){if(i===s.heavy)win();else{add(-Math.min(3,score));feedback('Нет, тяжелее № '+(s.heavy+1));setup();}return;}s.pan[i]=(s.pan[i]+1)%3;b.textContent='№ '+(i+1)+['',' ←',' →'][s.pan[i]];draw();});
 button('Взвесить',()=>{let left=0,right=0;s.pan.forEach((v,i)=>{if(v===1)left+=i===s.heavy?11:10;if(v===2)right+=i===s.heavy?11:10;});s.weighs++;s.tilt=left===right?0:left>right?-8:8;draw();feedback((left===right?'Равновесие':left>right?'Левая чаша тяжелее':'Правая чаша тяжелее')+' · взвешиваний: '+s.weighs);});
 button('Назвать монету',b=>{s.guess=!s.guess;b.classList.toggle('active',s.guess);text(s.guess?'Нажми тяжёлую монету':'Одна монета тяжелее',s.guess?'Правильно: +10. Ошибка: −3.':'Нажимай монеты: вне весов → слева → справа.');});draw();break;}
case 'tightrope':s={x:50,v:0,wind:0,change:0,earned:0};text('Удержи равновесие','Зажми ← или →. Ветер меняет направление.');drawBalance();holdButton('←',-1);holdButton('→',1);break;
case 'boiler':s={pressure:50,heat:9,change:0,earned:0};text('Давление: 50','Зажимай клапан. Безопасный диапазон: 10–90.');drawBoiler();holdButton('Выпустить пар',1);break;
case 'rpsread':s={move:rand(3),left:Math.max(.65,3-round*.08),limit:Math.max(.65,3-round*.08)};text('Соперник: '+['✊ камень','✂️ ножницы','✋ бумага'][s.move],'Выбери жест, который его победит');meter();$('display').insertAdjacentHTML('afterbegin','<div class="duel-scene"><div class="opponent-hand hand-'+s.move+'">'+['✊','✂️','✋'][s.move]+'</div><span>ХОД СОПЕРНИКА</span></div>');['✊','✂️','✋'].forEach((x,i)=>button(x,()=>{if(i===(s.move+2)%3)win();else finish('Соперник победил');}));break;
case 'riskdice':s={bank:0,lives:3};text('Банк: 0','Жизни: ♥♥♥ · единица сжигает банк');drawDie(5);button('Бросить',()=>{let die=1+rand(6);drawDie(die);if(die===1){s.bank=0;s.lives--;feedback('Единица! Банк сгорел');if(!s.lives){finish('Три неудачных броска');return;}}else{s.bank+=die;feedback('Забрать банк или рискнуть ещё?');}text('Банк: '+s.bank,'Жизни: '+'♥'.repeat(s.lives));});button('Забрать',()=>{if(s.bank){add(s.bank);s.bank=0;text('Банк: 0','Жизни: '+'♥'.repeat(s.lives));feedback('Очки сохранены');}});break;
case 'chomp':s={rows:[4,4,4],bot:false,wait:0};text('Твой ход','Красная клетка отравлена. Убирается всё справа и ниже.');drawChomp();break;
}}
function holdButton(label,value){let b=button(label,()=>{});b.onpointerdown=e=>{if(!shell.running)return;e.preventDefault();held=value;b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{held=0;};}
window.addEventListener('blur',()=>held=0);document.addEventListener('visibilitychange',()=>held=0);
function drawChomp(){ $('controls').replaceChildren();$('controls').style.display='grid';$('controls').style.gridTemplateColumns='repeat(4, 1fr)';for(let y=0;y<3;y++)for(let x=0;x<4;x++){let b=button(y===0&&x===0?'×':'',()=>{if(s.bot)return;if(!x&&!y){finish('Попалась отравленная клетка');return;}bite(y,x);s.bot=true;s.wait=.55;text('Ход соперника','Подожди…');drawChomp();},!x&&!y?'chocolate poison':'chocolate');b.disabled=x>=s.rows[y]||s.bot;if(x>=s.rows[y])b.style.visibility='hidden';}}
function bite(y,x){for(let k=y;k<3;k++)s.rows[k]=Math.min(s.rows[k],x);}
// Exact finite impartial-game solver. A move to (0,0) is always losing.
const memo=new Map();function winning(rows){let key=rows.join();if(memo.has(key))return memo.get(key);for(let y=0;y<3;y++)for(let x=0;x<rows[y];x++){if(!x&&!y)continue;let next=rows.map((v,k)=>k>=y?Math.min(v,x):v);if(!winning(next)){memo.set(key,true);return true;}}memo.set(key,false);return false;}
function botChomp(){let moves=[];for(let y=0;y<3;y++)for(let x=0;x<s.rows[y];x++){if(x||y){let next=s.rows.map((v,k)=>k>=y?Math.min(v,x):v);moves.push({x,y,good:!winning(next)});}}if(!moves.length){add(20);round++;feedback('Сопернику осталась отрава! +20');s={rows:[4,4,4],bot:false,wait:0};text('Новая плитка','Твой ход');drawChomp();return;}let good=moves.filter(m=>m.good),m=pick(Math.random()<.65&&good.length?good:moves);bite(m.y,m.x);s.bot=false;text('Твой ход','Красную клетку брать нельзя');drawChomp();}
P.loop(dt=>{if(!shell.running){held=0;return;}time+=dt;visualTime+=dt;if(visualTime>=.08)status();if(C.timed){shell.setSide(Math.ceil(Math.max(0,60-time))+' с',time>50);if(time>=60){finish('Минута закончилась');return;}}else shell.setSide(Math.floor(time)+' с');
if(C.id==='tightrope'){s.change-=dt;if(s.change<=0){s.wind=(Math.random()-.5)*(25+time*.3);s.change=.8+Math.random();}s.v+=(s.wind+held*42)*dt;s.v*=Math.exp(-dt*1.7);s.x+=s.v*dt;if(visualTime>=.08)drawBalance();$('prompt').textContent='Баланс: '+Math.round(s.x);if(s.x<=0||s.x>=100){finish('Потерял равновесие');return;}let n=Math.floor(time*10);if(n>score)add(n-score);}
if(C.id==='boiler'){s.change-=dt;if(s.change<=0){s.heat=8+Math.random()*10+time*.15;s.change=2;}s.pressure+=(s.heat-held*34)*dt;if(visualTime>=.08)drawBoiler();$('prompt').textContent='Давление: '+Math.round(s.pressure);if(s.pressure<=10||s.pressure>=90){finish(s.pressure<=10?'Котёл погас':'Избыточное давление');return;}let n=Math.floor(time*10);if(n>score)add(n-score);}
if(C.id==='rpsread'){s.left-=dt;bar(s.left/s.limit*100);if(s.left<=0)finish('Не успел выбрать жест');}
if(visualTime>=.08)visualTime=0;
if(C.id==='chomp'&&s.bot){s.wait-=dt;if(s.wait<=0)botChomp();}
});
})();
