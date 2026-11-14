/* DOOM404 Runner audio adapter. Read-only gameplay integration. */
(()=>{
'use strict';
const root='https://raw.githubusercontent.com/doom404official-collab/DOOM404/d67088d1e3e536d5155003b068eae32001ffa8a1/audio/';
// Audio assets are pinned to the verified GitHub upload commit because Vercel's isolated game root excludes sibling /audio.
const files={l1:'level_1_dark_intro_loop_8s.wav',l2:'level_2_rising_danger_loop_8s.wav',l3:'level_3_heavy_metal_loop_8s.wav',boss:'boss_final_rush_loop_8s.wav',jump:'jump.wav',land:'land.wav',hit:'obstacle_hit.wav',level:'level_complete.wav',victory:'victory.wav',over:'game_over.wav',menu:'menu_select.wav',restart:'restart.wav'};
const music={};let unlocked=false,current=null,previous=null,previousLevel=1,previousJumps=0,previousVy=0,previousY=null,wasPaused=false;
const load=(key,loop=false)=>{const a=new Audio(root+files[key]);a.preload=loop?'auto':'none';a.loop=loop;a.volume=loop?.28:.45;return a};
for(const key of ['l1','l2','l3','boss'])music[key]=load(key,true);
const effects={};for(const key of ['jump','land','hit','level','victory','over','menu','restart'])effects[key]=load(key);
function effect(key){if(!unlocked)return;const source=effects[key];if(!source)return;const a=source.cloneNode();a.volume=source.volume;a.play().catch(()=>{});}
function stopMusic(){for(const a of Object.values(music)){a.pause();a.currentTime=0;}current=null;}
function selectMusic(key){if(current===key)return;stopMusic();current=key;if(unlocked)music[key].play().catch(()=>{});}
function paused(s){return !!s.paused;}
function read(){return typeof window.DOOM_RUNNER_BRIDGE==='function'?window.DOOM_RUNNER_BRIDGE():null;}
function frame(){
const s=read();
if(s){
const isPaused=paused(s);
if(!previous){previous=s;previousY=s.py;previousJumps=s.jumps;previousVy=s.vy;previousLevel=(typeof level==='number'?level:1);}
if(s.state==='play'){
const lv=typeof level==='number'?level:1;
selectMusic(lv===1?'l1':lv===2?'l2':lv===3?'l3':'boss');
if(isPaused){if(current)music[current].pause();}
else {
if(wasPaused&&current&&unlocked)music[current].play().catch(()=>{});
if(lv>previousLevel)effect('level');
if(previous.state==='play'&&!previous.paused){
if(s.jumps>previousJumps&&s.vy<0)effect('jump');
if(previousJumps>0&&s.jumps===0&&s.vy===0)effect('land');
}
}
previousLevel=lv;
}else if(s.state==='dead'){
if(previous.state==='play'){stopMusic();effect('hit');effect('over');}
}else if(s.state==='ready'&&previous.state==='play'){stopMusic();}
wasPaused=isPaused;previous=s;previousJumps=s.jumps;previousVy=s.vy;previousY=s.py;
}
requestAnimationFrame(frame);
}
function unlock(){unlocked=true;const s=read();if(s&&s.state==='play'&&!s.paused){if(current)music[current].play().catch(()=>{});}}
document.getElementById('start')?.addEventListener('pointerdown',()=>{
unlock();const s=read();if(s?.state==='dead')effect('restart');else effect('menu');
stopMusic();previous=null;previousLevel=1;previousJumps=0;wasPaused=false;
},{capture:true});
document.getElementById('jump')?.addEventListener('pointerdown',unlock,{capture:true});
document.getElementById('resumeGame')?.addEventListener('click',unlock,{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&current)music[current].pause();});
window.addEventListener('blur',()=>{if(current)music[current].pause();});
window.DOOM_RUNNER_AUDIO={stop:stopMusic,playVictory(){stopMusic();effect('victory');}};
requestAnimationFrame(frame);
})();