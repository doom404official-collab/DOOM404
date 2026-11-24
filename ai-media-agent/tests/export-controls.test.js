// Behavioral state tests with stubbed media APIs; these do not validate video output.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../narrated-export.js'),'utf8');
function harness(options={}){
 const ids=['broadcast-narrated','broadcast-canvas','narrated-status','broadcast-status','universal-report','unified-report','broadcast-preview','broadcast-export','presenter-mode','mint'];
 const events={},elements={},exports=[],paints=[];let frame,ac;
 const element=()=>({disabled:false,value:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn},append(){},after(){},click(){},remove(){},style:{},querySelector(){return null}});
 for(const id of ids)elements[id]=element();elements['broadcast-export'].disabled=true;elements['presenter-mode'].value='hud';
 const track={stop(){}};elements['broadcast-canvas'].captureStream=()=>({getVideoTracks:()=>[track]});elements['broadcast-canvas'].getContext=()=>({});elements['broadcast-canvas'].width=540;elements['broadcast-canvas'].height=960;
 class AudioContext{constructor(){ac=this;this.currentTime=0}async resume(){}async decodeAudioData(){return {duration:1}}createMediaStreamDestination(){return {stream:{getAudioTracks:()=>[track]}}}createBufferSource(){return {connect(){},start(){},stop(){}}}close(){}}
 class MediaStream{constructor(tracks){this.tracks=tracks}getTracks(){return this.tracks}}
 class Recorder{static isTypeSupported(){return true}constructor(){this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['stubbed-state-test'])});this.onstop()}}
 const context={window:{addEventListener(name,fn){events[name]=fn},dispatchEvent(e){exports.push(e.detail)},AudioContext,MediaRecorder:Recorder,doom404HudV8:{reset(){},begin:options.begin||(()=>Promise.resolve()),paint(c,i,p,e){paints.push(e.mint)},stop(){}}},document:{getElementById:id=>elements[id]||null,createElement:element,body:{append(){}}},MediaStream,MediaRecorder:Recorder,fetch:options.fetch||(()=>Promise.resolve({ok:true,json:async()=>({clips:Array(7).fill('YQ==')})})),Blob,URL:{createObjectURL:()=> 'blob:state-test',revokeObjectURL(){}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},atob,Uint8Array,requestAnimationFrame:fn=>{frame=fn},setTimeout(){},console};
 vm.runInNewContext(source,context);
 const ready=mint=>events['doom404:broadcast-ready']({detail:{eligible:true,universal:true,mint,scenes:Array.from({length:7},(_,i)=>({caption:'Scene '+i+' evidence sentence.'}))}});ready('originalMint');
 return {elements,events,exports,paints,ready,click:()=>elements['broadcast-narrated'].listeners.click(),finish:()=>{ac.currentTime=10;frame()},context};
}
const controls=['broadcast-narrated','universal-report','unified-report','broadcast-preview','broadcast-export','presenter-mode','mint'];
function snapshot(h){return controls.map(id=>h.elements[id].disabled)}
test('locks research and presenter controls, freezes active episode, restores exact prior states after completion',async()=>{let release;const h=harness({begin:()=>new Promise(r=>release=r)}),prior=snapshot(h);const pending=h.click();assert.ok(snapshot(h).every(Boolean));h.ready('replacementMint');release();await pending;assert.ok(snapshot(h).every(Boolean));h.finish();assert.deepEqual(snapshot(h),prior);assert.equal(h.exports[0].mint,'originalMint');assert.ok(h.paints.every(m=>m==='originalMint'))});
test('asset initialization failure restores prior enabled and disabled states',async()=>{const h=harness({begin:()=>Promise.reject(Error('asset unavailable'))}),prior=snapshot(h);await h.click();assert.deepEqual(snapshot(h),prior);assert.match(h.elements['narrated-status'].textContent,/export cancelled/)});
test('narration failure restores controls and allows another attempt',async()=>{const h=harness({fetch:()=>Promise.reject(Error('provider unavailable'))}),prior=snapshot(h);await h.click();assert.deepEqual(snapshot(h),prior);assert.match(h.elements['narrated-status'].textContent,/Narrated export unavailable/);await h.click();assert.deepEqual(snapshot(h),prior)});
test('unsupported presenter early exit restores prior states without starting media',async()=>{const h=harness();h.elements['presenter-mode'].value='studio';const prior=snapshot(h);await h.click();assert.deepEqual(snapshot(h),prior);assert.equal(h.exports.length,0);assert.match(h.elements['narrated-status'].textContent,/Select a V8 HUD presenter/)});
