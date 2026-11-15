/* Deterministic mechanics/lifecycle checks without network or Telegram. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element {
 constructor(){this.children=[];this.textContent='';this.style={};this.dataset={};this.classList={toggle(){},remove(){},add(){}};}
 prepend(e){this.children.unshift(e);} querySelectorAll(){return [];} click(){if(this.onclick)this.onclick();} appendChild(e){this.children.push(e);return e;} replaceChildren(){this.children=[];this.textContent='';}
 set innerHTML(v){this.html=v;this.children=[new Element()];} get innerHTML(){return this.html;}
 querySelector(){return this.children[0];}setPointerCapture(){} insertAdjacentHTML(_,v){this.html=(this.html||'')+v;}
}
const source=fs.readFileSync('shared/ten-games.js','utf8');
function game(id,timed){let els=Object.fromEntries(['prompt','hint','display','controls','feedback','chapter','main'].map(x=>[x,new Element()])),cfg,tick,result,events={};
 const shell={running:false,setScore(n){this.score=n;},setSide(){},end(r){result=r;this.running=false;}};
 const math=Object.create(Math);math.random=()=>.5;
 const context={Math:math,Map,console,document:{body:new Element(),querySelector:()=>els.main,getElementById:id=>els[id],createElement:()=>new Element(),addEventListener:(k,fn)=>events[k]=fn},window:{PauzaGameConfig:{id,title:id,timed,rules:'test'},Pauza:{shell(c){cfg=c;return shell;},loop(fn){tick=fn;}},addEventListener:(k,fn)=>events[k]=fn}};
 vm.runInNewContext(source,context);cfg.onReset();shell.running=true;
 const click=(label)=>{const b=typeof label==='number'?els.controls.children[label]:els.controls.children.find(b=>b.textContent===label);assert(b,'Missing '+label);assert(!b.disabled);b.onclick();};
 return {els,shell,click,step:dt=>tick(dt),events,reset(){cfg.onReset();shell.running=true;},get result(){return result;}};
}
for(const id of ['waterjug','onestroke','morse','binary','weighing','tightrope','boiler','rpsread','riskdice','chomp']){
 const timed=['waterjug','onestroke','morse','binary','weighing'].includes(id),g=game(id,timed);
 assert(g.els.controls.children.length>0);g.shell.running=false;g.step(100);assert.equal(g.result,undefined,'paused game ended');g.click(0);assert.equal(g.shell.score,0,'paused input changed score');g.shell.running=true;
 if(id==='binary'){g.click('16');g.click('Проверить');assert.equal(g.shell.score,10);for(let n=0;n<2;n++){g.click('16');g.click('Проверить');}assert.equal(g.shell.score,35,'three correct solutions award a streak bonus');g.click('Проверить');g.click('16');g.click('Проверить');assert.equal(g.shell.score,45,'incorrect answer breaks streak');}
 if(id==='morse'){g.click('Д');assert.equal(g.shell.score,10);}
 if(id==='weighing'){g.click(4);g.click('Взвесить');assert.match(g.els.feedback.textContent,/Левая/);g.click('Назвать монету');g.click(4);assert.equal(g.shell.score,10);}
 if(id==='waterjug'){
  // Seed picks (4,7)->5. Breadth-first search the real pour rules.
  const q=[{v:[0,0],path:[]}],seen=new Set();let solution;
  while(q.length){let {v,path}=q.shift(),key=v.join();if(seen.has(key))continue;seen.add(key);if(v.includes(5)){solution=path;break;}
   for(let i=0;i<2;i++)for(let op=0;op<3;op++){let w=v.slice(),cap=[4,7];if(op===0)w[i]=cap[i];if(op===1)w[i]=0;if(op===2){let n=Math.min(w[i],cap[1-i]-w[1-i]);w[i]-=n;w[1-i]+=n;}q.push({v:w,path:[...path,i*3+op]});}}
  assert(solution);solution.forEach(g.click);assert.equal(g.shell.score,10);
 }
 if(id==='onestroke'){[1,0,3,2,0].forEach(i=>g.click(String(i+1)));assert.equal(g.shell.score,10);}
 if(id==='rpsread'){g.click('✊');assert.equal(g.shell.score,10);g.step(5);assert(g.result);}
 if(id==='tightrope'){g.els.controls.children[0].onpointerdown({preventDefault(){},pointerId:1});for(let i=0;i<200;i++)g.step(.1);assert(g.result);}
 if(id==='boiler'){for(let i=0;i<100;i++)g.step(.1);assert(g.result);}
 if(id==='riskdice'){g.click('Бросить');g.click('Забрать');assert.equal(g.shell.score,4);g.step(70);assert.equal(g.result,undefined,'survival time limit');}
 if(id==='chomp'){g.click(3);g.step(1);g.click(0);assert(g.result);}
 if(timed){g.step(59);assert.equal(g.result,undefined);g.step(1);assert(g.result);}
 g.reset();assert.equal(g.shell.score,0);console.log('PASS',id);
}
const cat=JSON.parse(fs.readFileSync('tools/catalog.json'));assert.equal(cat.games.length,187);assert.equal(new Set(cat.games.map(x=>x.id)).size,187);for(const g of cat.games)assert(fs.existsSync(g.id+'/index.html'));
console.log('PASS catalog: 187 unique ids with game pages');
