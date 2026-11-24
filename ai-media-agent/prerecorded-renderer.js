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
 const share=episode?.top20Share;
 if(i===2&&(!Number.isFinite(share)||share<0||share>100))return;
 if(i===4&&!episode?.candidateVerified)return;
 // Calibrated against V7.1 exported monitor: x 310–478, y 194–319.
 const x=310,y=194,w=168,h=125;
 const a=Math.min(1,Math.max(0,(performance.now()-changedAt)/650));
 ctx.save();ctx.fillStyle="#14141c";ctx.fillRect(x,y,w,h);
 ctx.textAlign="center";ctx.fillStyle="#e9dce0";ctx.font="bold 12px sans-serif";
 ctx.fillText(i===2?"TOP-20 ACCOUNTS":"VERIFIED TRANSFER",x+w/2,y+22);
 ctx.fillStyle="#ff5268";ctx.font="bold 28px sans-serif";
 ctx.fillText(i===2?share.toFixed(2)+"%":"0.05 SOL",x+w/2,y+55);
 if(i===2){ctx.fillStyle="#39343e";ctx.fillRect(x+12,y+69,w-24,10);ctx.fillStyle="#ff5268";ctx.fillRect(x+12,y+69,(w-24)*share/100*a,10)}
 else {ctx.strokeStyle="#ff5268";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+24,y+75);ctx.lineTo(x+24+(w-48)*a,y+75);ctx.stroke();ctx.fillStyle="#ff5268";ctx.beginPath();ctx.arc(x+24+(w-48)*a,y+75,4,0,Math.PI*2);ctx.fill()}
 ctx.fillStyle="#d6cbd0";ctx.font="11px sans-serif";ctx.fillText(i===2?"NOT UNIQUE OWNERS":"PURPOSE UNKNOWN",x+w/2,y+105);ctx.restore()
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
 // Explicitly clear the former blurred filler band in the recorded canvas.
 ctx.fillStyle="#131018";ctx.fillRect(28,Y+H+3,484,6);
 if(v.readyState>=2)evidenceScreen(ctx,i,episode);
 return true
}
function stop(){Object.values(clips).forEach(v=>v.pause());active=null;hold=null;started=false}
window.doom404Prerecorded={version:"v7.2",prepare,begin,draw,stop,get failed(){return failed}};
})();