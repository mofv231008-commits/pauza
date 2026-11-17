/* Deterministic mechanics/lifecycle checks without network or Telegram. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element {
 constructor(){this.children=[];this.textContent='';this.style={};this.dataset={};this.attrs={};this.queries={};this.htmlWrites=0;this.classList={toggle(){},remove(){},add(){}};}
 prepend(e){this.children.unshift(e);} querySelectorAll(){return [];} click(){if(this.onclick)this.onclick();} appendChild(e){this.children.push(e);return e;} replaceChildren(){this.children=[];this.textContent='';}
 set innerHTML(v){this.htmlWrites++;this.queries={};this.html=v;this.children=[new Element()];} get innerHTML(){return this.html;}
 querySelector(selector){return this.queries[selector]||(this.queries[selector]=new Element());}setAttribute(k,v){this.attrs[k]=v;}setPointerCapture(){} insertAdjacentHTML(_,v){this.html=(this.html||'')+v;}
}
const source=fs.readFileSync('shared/ten-games.js','utf8');
function game(id,timed){let els=Object.fromEntries(['prompt','hint','display','controls','feedback','chapter','main'].map(x=>[x,new Element()])),cfg,tick,result,events={};
 const shell={running:false,setScore(n){this.score=n;},setSide(){},end(r){result=r;this.running=false;}};
 const math=Object.create(Math);math.random=()=>.5;
 const context={Math:math,Map,console,document:{body:new Element(),querySelector:()=>els.main,getElementById:id=>els[id],createElement:()=>new Element(),addEventListener:(k,fn)=>events[k]=fn},window:{PauzaGameConfig:{id,title:id,timed,rules:'test'},Pauza:{shell(c){cfg=c;return shell;},loop(fn){tick=fn;}},addEventListener:(k,fn)=>events[k]=fn}};
 vm.runInNewContext(source.replace('P.loop(dt=>','window.testState=()=>s;P.loop(dt=>'),context);cfg.onReset();shell.running=true;
 const click=(label)=>{const b=typeof label==='number'?els.controls.children[label]:els.controls.children.find(b=>b.textContent===label);assert(b,'Missing '+label);assert(!b.disabled);b.onclick();};
 return {els,shell,click,step:dt=>tick(dt),events,reset(){cfg.onReset();shell.running=true;},get state(){return context.window.testState();},get result(){return result;}};
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
const catalog = JSON.parse(fs.readFileSync('tools/catalog.json'));
const manifest = JSON.parse(fs.readFileSync('games.json'));
const catalogIds = catalog.games.map(game => game.id);
assert.equal(new Set(catalogIds).size, catalogIds.length);
assert.deepEqual(manifest.map(game => game[0]).sort(), catalogIds.slice().sort());
for (const id of catalogIds) assert(fs.existsSync(id + '/index.html'));
console.log('PASS catalog: ' + catalogIds.length + ' unique games in the manifest');

// Physics should behave alike on slow and fast devices; rendering must reuse the scene.
const falls=[];
for(const fps of [30,60,120]){
 const g=game('tightrope',false),display=g.els.display,writes=display.htmlWrites;
 const person=g.state.view.person;let previous=person.attrs.transform;
 for(let i=0;i<12;i++){g.step(1/fps);assert.notEqual(person.attrs.transform,previous,'movement must update each frame');previous=person.attrs.transform;}
 assert.equal(display.htmlWrites,writes,'animation must not replace the SVG');
 const before=g.state.x;g.shell.running=false;g.step(5);assert.equal(g.state.x,before,'pause freezes physics');g.shell.running=true;
 let t=12/fps;while(!g.result&&t<15){g.step(1/fps);t+=1/fps;}
 assert(g.result,'uncontrolled character must fall in hard mode');falls.push(t);
 assert.equal(display.htmlWrites,writes,'scene is reused for the entire round');
 g.reset();assert.equal(g.state.x,50);assert.equal(g.state.guard,12);assert.equal(g.state.gustTime,0);
}
assert(Math.max(...falls)-Math.min(...falls)<.12,'physics depends on device frame rate: '+falls);
const challenge=game('tightrope',false);
for(let i=0;i<1800&&!challenge.result;i++){
 const st=challenge.state;
 // Simple balancing controller models a player tapping in both directions.
 const force=-(st.x-50)*6-st.v*8-st.wind;
 const index=force<0?0:1;const b=challenge.els.controls.children[index];
 if(Math.abs(force)>12)b.onpointerdown({preventDefault(){},pointerId:1});else b.onpointerup();
 challenge.step(1/60);
}
assert(challenge.state.elapsed>10,'hard mode should remain controllable');
assert(challenge.state.guard>12&&challenge.state.level>=2,'challenge ramps with survival time');
console.log('PASS smooth SVG reuse, pause/reset, 30/60/120fps consistency; unattended falls:',falls.map(t=>t.toFixed(2)).join(', '));
console.log('PASS harder mode remains controllable:',challenge.state.elapsed.toFixed(1),'seconds');
