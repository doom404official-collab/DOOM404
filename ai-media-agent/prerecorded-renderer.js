// DOOM404 prerecorded broadcast adapter. No 2D or 3D fallback during clip transitions.
// Holds the previous decoded frame until the next prerecorded clip is ready.
(()=>{"use strict";
const names={opening:"Doom-Opening.mp4",explaining:"doom-explaining.mp4",evidence:"doom-evidence.mp4",closing:"doom-closing.mp4"};
const clips={},base="./presenter-assets/doom/",X=30,Y=145,W=480,H=271;
let active=null,failed=false,changedAt=0,hold=null,started=false;
const frame=document.createElement("canvas");frame.width=W;frame.height=H;
function roleForScene(i){return i===0?"opening":i===6?"closing":i===2||i===4?"evidence":"explaining"}
function drawSource(ctx,v){const sw=v.videoWidth||540,sh=v.videoHeight||960;
// Uploaded 9:16 assets contain a baked blurred band; isolate the newsroom above it.
const sy=sh*.237,cropH=sh*.295;
ctx.drawImage(v,0,sy,sw,cropH,X,Y,W,H)}
async function prepare(){
 for(const [role,file] of Object.entries(names)){
  if(clips[role])continue;
  const v=document.createElement("video");v.muted=true;v.defaultMuted=true;v.playsInline=true;v.loop=true;v.preload="auto";v.crossOrigin="anonymous";v.src=base+file;
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error("Clip unavailable: "+file)),10000);v.onloadeddata=()=>{clearTimeout(timeout);resolve()};v.onerror=()=>{clearTimeout(timeout);reject(Error("Clip unavailable: "+file))};v.load()});
  clips[role]=v;
 }
 return true
}
async function begin(){await prepare();active=null;failed=false;started=true;hold=null;return true}
function evidenceScreen(ctx,i,episode){
 if(i!==2&&i!==4)return;
 const concentration=Number.isFinite(episode?.top20Share)?episode.top20Share.toFixed(2)+"%":"";
 const title=i===2?"TOP-20 ACCOUNTS":"SOL TRANSFER";
 const value=i===2?concentration:"0.05 SOL";
 const qualifier=i===2?"NOT UNIQUE OWNERS":"PURPOSE UNKNOWN";
 if(i===2&&!concentration)return;
 // Place graphics on the blank studio display, never as a new on-chain claim.
 ctx.save();ctx.fillStyle="#15151d";ctx.fillRect(317,151,162,110);
 ctx.strokeStyle="#e83950";ctx.lineWidth=2;ctx.strokeRect(317,151,162,110);
 ctx.textAlign="center";ctx.fillStyle="#f5d7dd";ctx.font="bold 12px sans-serif";ctx.fillText(title,398,172);
 ctx.fillStyle="#ff5268";ctx.font="bold 27px sans-serif";ctx.fillText(value,398,210);
 ctx.fillStyle="#c7bec5";ctx.font="10px sans-serif";ctx.fillText(qualifier,398,234);
 ctx.restore()
}
function draw(ctx,i,episode){
 if(!started)return false;
 const role=roleForScene(i),v=clips[role];if(!v)return false;
 if(active!==role){
  if(active&&clips[active]?.readyState>=2){
   const h=frame.getContext("2d");h.clearRect(0,0,W,H);h.save();h.translate(-X,-Y);drawSource(h,clips[active]);h.restore();hold=frame;
   clips[active].pause()
  }
  active=role;changedAt=performance.now();
  try{v.currentTime=0}catch{}
  v.play().catch(()=>{failed=true})
 }
 ctx.save();ctx.beginPath();ctx.rect(X,Y,W,H);ctx.clip();
 if(v.readyState>=2){
  drawSource(ctx,v);
  if(hold){const opacity=Math.max(0,1-(performance.now()-changedAt)/240);if(opacity>0){ctx.globalAlpha=opacity;ctx.drawImage(hold,X,Y)}else hold=null}
 }else if(hold){ctx.drawImage(hold,X,Y)}
 else {ctx.fillStyle="#120e16";ctx.fillRect(X,Y,W,H)}
 ctx.restore();
 if(v.readyState>=2)evidenceScreen(ctx,i,episode);
 return true
}
function stop(){Object.values(clips).forEach(v=>v.pause());active=null;hold=null;started=false}
window.doom404Prerecorded={prepare,begin,draw,stop,get failed(){return failed}};
})();