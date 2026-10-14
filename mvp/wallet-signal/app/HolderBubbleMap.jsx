"use client";
import {useMemo,useState} from "react";
function layout(nodes){
 const count=nodes.length;
 return nodes.map((n,i)=>{const angle=i*2.399963229728653;const dist=12+Math.sqrt(i/Math.max(count,1))*35;
  return {...n,x:50+Math.cos(angle)*dist,y:50+Math.sin(angle)*dist};});
}
export default function HolderBubbleMap({holders=[],groups=[]}){
 const [selected,setSelected]=useState(null);
 const nodes=useMemo(()=>layout(holders.filter(h=>h.ownerWallet).map((h,i)=>({wallet:h.ownerWallet,sharePct:Number(h.sharePct)||0,rank:i+1}))),[holders]);
 const byWallet=new Map(nodes.map(n=>[n.wallet,n]));
 const edges=groups.flatMap(g=>g.directEdges||[]).filter(e=>byWallet.has(e.walletA)&&byWallet.has(e.walletB));
 const active=nodes.find(n=>n.wallet===selected);
 return <div style={{background:"#101823",border:"1px solid #303d50",borderRadius:14,padding:12}}>
  <strong>HOLDER CONNECTION MAP</strong>
  <p style={{fontSize:12,color:"#a9b6c9"}}>Bubble size reflects token supply. Lines represent observed direct transactions, not shared ownership.</p>
  <svg viewBox="0 0 100 100" role="img" aria-label="Top-holder wallet connection graph" style={{width:"100%",maxHeight:380}}>
   {edges.map((e,i)=>{const a=byWallet.get(e.walletA),b=byWallet.get(e.walletB);return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#efbd68" strokeWidth=".5" opacity=".8"/>;})}
   {nodes.map(n=>{const linked=edges.some(e=>e.walletA===n.wallet||e.walletB===n.wallet);return <circle key={n.wallet} cx={n.x} cy={n.y} r={Math.max(2,Math.min(9,1.7+Math.sqrt(n.sharePct)*1.5))} fill={linked?"#b7654c":"#277c74"} stroke={selected===n.wallet?"white":"#d4e0e8"} strokeWidth={selected===n.wallet?".7":".25"} onClick={()=>setSelected(n.wallet)} style={{cursor:"pointer"}}><title>{n.wallet}: {n.sharePct.toFixed(2)}% supply</title></circle>;})}
  </svg>
  <p style={{fontSize:12,color:"#9facbf"}}>Select a bubble to inspect its wallet and observed holdings.</p>
  {active&&<div style={{overflowWrap:"anywhere",fontSize:13}}>
   <strong>Wallet #{active.rank}: {active.sharePct.toFixed(2)}% supply</strong>
   <p><a href={"https://solscan.io/account/"+encodeURIComponent(active.wallet)} target="_blank" rel="noopener noreferrer" style={{color:"#8bd4ff"}}>{active.wallet} ↗</a></p>
   {edges.filter(e=>e.walletA===active.wallet||e.walletB===active.wallet).map((e,i)=><p key={i}>Connection to {e.walletA===active.wallet?e.walletB:e.walletA}: {(e.signatures||[]).length} supporting transaction(s)</p>)}
  </div>}
 </div>;
}
