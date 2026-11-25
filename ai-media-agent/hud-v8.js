(()=>{"use strict";
let last=-1,changed=0,cat=null,catMode=false,selectedMode="hud";
async function begin(mode){stop();selectedMode=mode;catMode=mode==="hud-cat"||mode==="hud-bore"||mode==="hud-bull";if(!catMode)return window.doom404Prerecorded.begin();cat=document.createElement("video");cat.muted=true;cat.defaultMuted=true;cat.playsInline=true;cat.loop=true;cat.preload="auto";cat.src=mode==="hud-bull"?"./presenter-assets/bull/doom-bull-presenter.mp4":mode==="hud-bore"?"./presenter-assets/bore/doom-bore-presenter.mp4":"./presenter-assets/cat/doom-cat-presenter.mp4";await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Selected presenter load timeout")),15000);cat.onloadeddata=()=>{clearTimeout(timer);resolve()};cat.onerror=()=>{clearTimeout(timer);reject(Error("Selected presenter video unavailable"))};cat.load()});await cat.play()}
function stop(){if(cat){cat.pause();cat.removeAttribute("src");cat.load();cat=null}catMode=false}
const labels=["REPORT OVERVIEW","VERIFIED INFRASTRUCTURE","ACCOUNT CONCENTRATION","UNRESOLVED CLASSIFICATION","VERIFIED TRANSFER","FUNDING SIGNIFICANCE","LIMITATIONS"];
function reset(){last=-1;changed=0}
function captionPage(caption,progress){const words=String(caption).split(/\s+/);const pages=Math.max(1,Math.ceil(words.length/28));const index=Math.min(pages-1,Math.floor(Math.max(0,Math.min(1,progress))*pages));return words.slice(index*28,(index+1)*28).join(" ")}
function paint(c,i,p,episode,scenes,sceneProgress=0){
 const dynamic=episode?.universal?episode.scenes[i]:null;const now=performance.now();if(last!==i){last=i;changed=now}
 const t=Math.min(1,(now-changed)/300);
 c.fillStyle="#090a0e";c.fillRect(0,0,540,960);
 c.strokeStyle="#383943";c.lineWidth=1;c.strokeRect(10,10,520,940);
 c.fillStyle="#ff5268";c.font="bold 24px sans-serif";c.fillText("DOOM404 AI MEDIA",24,43);c.font="bold 12px sans-serif";c.textAlign="right";c.fillText(selectedMode==="hud"?"DOOM":selectedMode.replace("hud-","DOOM ").toUpperCase(),516,43);c.textAlign="left";
 c.fillStyle="#a9aab3";c.font="13px sans-serif";c.fillText(episode?.universal?((episode.identity?.symbol?episode.identity.symbol+" · ":"")+"SOLANA · "+episode.mint.slice(0,6)+"…"+episode.mint.slice(-4)):"ON-CHAIN EVIDENCE · EDUCATION",24,65,490);
 // Upper studio composition: independent evidence monitor above continuous presenter.
 c.fillStyle="#14161e";c.fillRect(16,82,508,624);
 c.strokeStyle="#78303d";c.strokeRect(16,82,508,624);
 c.save();c.beginPath();c.rect(24,90,492,260);c.clip();
 c.fillStyle="#101219";c.fillRect(24,90,492,260);
 c.strokeStyle="#20232b";for(let x=24;x<516;x+=24){c.beginPath();c.moveTo(x,90);c.lineTo(x,350);c.stroke()}for(let y=90;y<350;y+=24){c.beginPath();c.moveTo(24,y);c.lineTo(516,y);c.stroke()}
 c.globalAlpha=.65+.35*t;c.fillStyle="#e5e5ec";c.font="bold 18px sans-serif";c.fillText((dynamic?.label||labels[i]),42,122);
 const share=episode?.top20Share;
 const values=["TOMO","0 TOKENS",Number.isFinite(share)?share.toFixed(2)+"%":"UNAVAILABLE","UNRESOLVED","0.05 SOL","DUST EXCLUDED","PARTIAL EVIDENCE"];
 const notes=["HOLDER INTELLIGENCE","KNOWN BONDING CURVE","TOKEN ACCOUNTS · NOT UNIQUE OWNERS","CUSTODY / INFRASTRUCTURE","PURPOSE AND IDENTITY UNKNOWN","NOT A SHARED-FUNDING INDICATOR","NOT A TOKEN SAFETY RATING"];
 c.fillStyle="#ff5268";c.font="bold 38px sans-serif";c.fillText((dynamic?.value||values[i]),42,188,450);
 c.fillStyle="#b9bac4";c.font="16px sans-serif";c.fillText((dynamic?.note||notes[i]),42,222,450);
 if(dynamic?.label==="OWNER RESOLUTION"){const h=episode.evidence.holders;const ratio=h.accounts.filter(a=>a.ownerVerified).length/h.accounts.length;c.fillStyle="#353740";c.fillRect(42,245,450,14);c.fillStyle="#ff4053";c.fillRect(42,245,450*ratio,14)}if((!dynamic&&i===2||dynamic?.label==="ACCOUNT CONCENTRATION")&&Number.isFinite(share)){c.fillStyle="#353740";c.fillRect(42,245,450,14);c.fillStyle="#ff4053";c.fillRect(42,245,450*Math.max(0,Math.min(100,share))/100,14)}
 const refTypes={"TOKEN WITHDRAWAL TRANSFERS":"TOKEN_SCOPED_WITHDRAWAL_TRANSFER","MATCHED ROUND TRIPS":"MATCHED_TRANSACTION_NET_ROUND_TRIP","SAME SLOT ACQUISITIONS":"SAME_SLOT_ACQUISITIONS","RECIPROCAL TRANSFERS":"RECIPROCAL_TRANSFERS","TRANSFER CYCLE PATTERNS":"TRANSFER_CYCLE","SHARED FUNDING OBSERVATIONS":"SHARED_FUNDING_OBSERVATION","OBSERVED TRANSFERS":"DIRECT_TRANSFER"};const tx=(episode?.references||[]).find(r=>r.type===(dynamic?refTypes[dynamic.label]:"VERIFIED_SOL_TRANSFER"));
 c.font="14px monospace";c.fillStyle="#c5a0aa";if(tx?.signature&&(dynamic||i===4)){c.fillText("TX "+tx.signature.slice(0,12)+"…"+tx.signature.slice(-8),42,278);if(tx.slot)c.fillText("SLOT "+tx.slot,42,300)}if(!dynamic&&i===1&&episode?.curveSlot)c.fillText("SLOT "+episode.curveSlot,42,278);
 c.globalAlpha=.12;c.fillStyle="#ff4053";c.fillRect(24,90+(now/30)%260,492,2);c.restore();
 if(catMode&&cat){const x=16,y=360,w=508,h=340;const sw=cat.videoWidth,sh=cat.videoHeight;const scale=Math.min(w/sw,h/sh);c.fillStyle="#090a0e";c.fillRect(x,y,w,h);if(sw&&sh)c.drawImage(cat,x+(w-sw*scale)/2,y+(h-sh*scale)/2,sw*scale,sh*scale)}else{c.save();c.translate(0,215);window.doom404Prerecorded.draw(c,1,episode);c.restore()}
 // Fixed angular HUD, independent of caption changes.
 c.fillStyle="#14161c";c.strokeStyle="#79303d";c.lineWidth=1.5;c.beginPath();c.moveTo(16,730);c.lineTo(34,712);c.lineTo(524,712);c.lineTo(524,925);c.lineTo(506,943);c.lineTo(16,943);c.closePath();c.fill();c.stroke();
 c.strokeStyle="#ff4053";c.lineWidth=3;c.beginPath();c.moveTo(16,760);c.lineTo(16,730);c.lineTo(34,712);c.lineTo(130,712);c.moveTo(410,943);c.lineTo(506,943);c.lineTo(524,925);c.lineTo(524,900);c.stroke();
 c.save();c.globalAlpha=.65+.35*t;c.fillStyle="#ff5268";c.font="bold 15px sans-serif";c.fillText(String(i+1).padStart(2,"0")+" / "+(dynamic?.label||labels[i]),32,739,476);
 c.fillStyle="#f4f4f6";let lines=[],fontSize=21;const splitCaption=()=>{const out=[];let line="";for(const word of captionPage(scenes[i],sceneProgress).split(/\s+/)){const next=line?line+" "+word:word;if(c.measureText(next).width>476&&line){out.push(line);line=word}else line=next}if(line)out.push(line);return out};do{c.font=fontSize+"px sans-serif";lines=splitCaption();if(lines.length*(fontSize+3)<=132)break;fontSize--}while(fontSize>=15);let y=768;for(const line of lines){c.fillText(line,32,y);y+=fontSize+3}c.restore();
 c.fillStyle="#aeb0ba";c.font="12px sans-serif";c.fillText("PARTIAL EVIDENCE · NOT A SAFETY RATING",32,910);
 for(let j=0;j<7;j++){c.fillStyle=j<=i?"#ff4053":"#383943";c.fillRect(32+j*69,923,63,4)}
}
window.doom404HudV8={paint,reset,begin,stop};
})();