// Run: node --test glitch-runner/tests/v6-patterns.test.cjs
// Deterministic physics regression checks for the fixed authored pattern library.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function survives(kind,speed,actions){
  const obstacles=kind==='double'?[{x:505,w:48,h:58,k:'ground'},{x:770,w:49,h:178,k:'high'}]:
    kind==='short'?[{x:505,w:50,h:45,k:'ground'},{x:740,w:54,h:54,k:'ground'}]:
    kind==='overhead'?[{x:505,w:110,h:76,k:'overhead'}]:
    kind==='gap'?[{x:505,w:78,h:30,k:'gap'}]:
    kind==='high'?[{x:505,w:52,h:178,k:'high'}]:
    [{x:505,w:52,h:67,k:'ground'}];
  let py=397,vy=0,jumps=0;const dt=1/90;
  for(let i=0;i<450;i++){
    const t=i*dt;
    for(const j of actions.jumps||[])if(Math.abs(t-j)<dt/2&&jumps<2){vy=jumps===0?-590:-535;jumps++;}
    vy+=1120*dt;py+=vy*dt;if(py>=397){py=397;vy=0;jumps=0;}
    const slide=actions.slide&&t>=actions.slide[0]&&t<actions.slide[1]&&jumps===0;
    for(const o of obstacles){
      const x=o.x-speed*t;
      const top=slide?472:py+14,bottom=py+106;
      const hazardTop=o.k==='overhead'?367:o.k==='gap'?501:515-o.h+13;
      const hazardBottom=o.k==='overhead'?447:o.k==='gap'?527:510;
      if(79<x+o.w-8&&142>x+8&&bottom>hazardTop&&top<hazardBottom)return false;
    }
    if(obstacles.every(o=>o.x-speed*t+o.w<-20))return true;
  }
  return true;
}
const timing=Array.from({length:39},(_,i)=>i*.04);
function canSolve(kind,speed,allowDouble=true){
 for(const a of timing)for(const b of (allowDouble?timing:[-1])){
   if(b>=0&&b<=a+.09)continue;
   for(const slide of kind==='overhead'?[[0,.8],[.45,1.5],[.7,1.6]]:[null]){
     if(survives(kind,speed,{jumps:b<0?[a]:[a,b],slide}))return true;
   }
 }
 return false;
}
test('V6 scripts include all approved gameplay protections',()=>{
 for(const required of ['audio-controller.js','doom404-mascot-optimized.glb','function pauseGame','function jump()','MODE: CHALLENGE','HOW TO PLAY','function beginSlide','doom404-daily-missions-v2','shieldItems','function die(o)'])assert.ok(html.includes(required),required);
 assert.ok(html.includes("if(state==='play')beginSlide();else start()"),'only restart when not playing');
});
for(const speed of [410,480,610]){
 test('all advanced authored patterns have a survivable path at speed '+speed,()=>{
   for(const kind of ['single','short','double','high','overhead','gap'])assert.ok(canSolve(kind,speed),kind+' unsolvable');
 });
 test('high and double barriers cannot be solved with one jump at speed '+speed,()=>{
   for(const kind of ['high','double'])assert.equal(canSolve(kind,speed,false),false,kind+' too easy');
 });
}
