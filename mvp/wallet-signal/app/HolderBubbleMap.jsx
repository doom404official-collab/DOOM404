"use client";
import {useMemo,useState} from "react";

const short = value => value ? value.slice(0,5)+"…"+value.slice(-5) : "Unknown";
const solscan = (kind,id) => "https://solscan.io/"+kind+"/"+encodeURIComponent(id);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function buildGraph(holders,groups){
 const unique=new Map();
 for(const h of holders||[]){
  if(typeof h?.ownerWallet!=="string"||!h.ownerWallet)continue;
  const share=Number(h.sharePct);
  if(!unique.has(h.ownerWallet))unique.set(h.ownerWallet,{wallet:h.ownerWallet,sharePct:Number.isFinite(share)?Math.max(0,share):0,rank:unique.size+1});
 }
 const nodes=[...unique.values()];
 const valid=new Set(nodes.map(n=>n.wallet));
 const edges=new Map();
 for(const group of groups||[])for(const e of group.directEdges||[]){
  if(!valid.has(e.walletA)||!valid.has(e.walletB)||e.walletA===e.walletB)continue;
  const [a,b]=[e.walletA,e.walletB].sort();
  const key=a+"|"+b;
  if(!edges.has(key))edges.set(key,{key,walletA:a,walletB:b,signatures:new Set()});
  for(const sig of e.signatures||[])if(typeof sig==="string"&&sig)edges.get(key).signatures.add(sig);
 }
 return {nodes,edges:[...edges.values()].map(e=>({...e,signatures:[...e.signatures]}))};
}
function position(nodes){
 const count=nodes.length;
 return nodes.map((n,i)=>{
  const angle=i*2.399963229728653;
  const distance=13+Math.sqrt((i+.5)/Math.max(1,count))*32;
  return {...n,x:50+Math.cos(angle)*distance,y:50+Math.sin(angle)*distance};
 });
}
const panel={background:"#101823",border:"1px solid #303d50",borderRadius:14,padding:"12px",color:"#e8eff8",minWidth:0,overflow:"hidden"};
const action={background:"#1c2a3b",border:"1px solid #43536a",borderRadius:7,color:"#e8eff8",padding:"7px 10px",cursor:"pointer",minHeight:38};
export default function HolderBubbleMap({holders=[],groups=[],scanStatus=null,transactionsChecked=null,walletHistoriesReached=null,verifiedAssessment=null}){
 const [selected,setSelected]=useState(null);
 const [linkedOnly,setLinkedOnly]=useState(false);
 const [zoom,setZoom]=useState(1);
 const [groupFilter,setGroupFilter]=useState("all");
 const [showGuide,setShowGuide]=useState(false);
 const {nodes,edges}=useMemo(()=>buildGraph(holders,groups),[holders,groups]);
 const connected=new Set(edges.flatMap(e=>[e.walletA,e.walletB]));
 const clusters=useMemo(()=>{
  const result=[];
  for(const group of groups||[]){
   const members=[...new Set((group.members||[]).filter(w=>nodes.some(n=>n.wallet===w)))];
   if(members.length>1)result.push({members,sharePct:members.reduce((sum,w)=>sum+(nodes.find(n=>n.wallet===w)?.sharePct||0),0)});
  }
  return result;
 },[groups,nodes]);
 const focused=groupFilter==="all"?null:clusters[Number(groupFilter)]?.members;
 const visible=position(nodes.filter(n=>(!linkedOnly||connected.has(n.wallet))&&(!focused||focused.includes(n.wallet))));
 const lookup=new Map(visible.map(n=>[n.wallet,n]));
 const shownEdges=edges.filter(e=>lookup.has(e.walletA)&&lookup.has(e.walletB));
 const active=nodes.find(n=>n.wallet===selected);
 const activeEdges=active?edges.filter(e=>e.walletA===selected||e.walletB===selected):[];
 const uniqueEvidence=new Set(edges.flatMap(e=>e.signatures));
 const verified=verifiedAssessment?.evidence||null;
 const verifiedKeys=new Set((verified?.pairs||[]).map(e=>[e.walletA,e.walletB].sort().join("|")));
 const verifiedCount=verifiedKeys.size;
 const assessmentStatus=verifiedAssessment?.status||"not_available";
 return <section style={panel} aria-label="Holder connection bubble map">
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
   <strong>HOLDER CONNECTION MAP</strong>
   <span style={{fontSize:12,color:"#a9b6c9"}}>{nodes.length} wallets · {edges.length} candidate pairs · {uniqueEvidence.size} signature references</span>
  </div>
  <p style={{fontSize:12,color:"#a9b6c9"}}>Scan: {scanStatus||"coverage unknown"}{Number.isFinite(Number(transactionsChecked))&&transactionsChecked!==null?` · ${transactionsChecked} transactions checked`:""}{walletHistoriesReached!==null?` · ${walletHistoriesReached} wallet histories reached`:""}. Network edges are provisional until transaction evidence is independently classified.</p>
  <div style={{fontSize:12,color:"#b9d5e8",marginBottom:8}}>Evidence validation: {verified?`${verifiedCount} verified pairs · ${verified.counts?.pending??0} signatures pending · ${verified.counts?.unavailable??0} unavailable`:`Not available for this snapshot`} · Assessment: {assessmentStatus.replaceAll("_"," ")}{verifiedAssessment?.provisionalScore!=null?` · provisional ${verifiedAssessment.provisionalScore}/${verifiedAssessment.provisionalScoreDenominator}`:""}</div>
  <p style={{fontSize:12,color:"#a9b6c9",lineHeight:1.5}}>Bubble area indicates observed holder share. Lines show recorded candidate wallet relationships; these do not establish common ownership or coordinated trading. Inspect transaction evidence before drawing conclusions.</p>
  <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto auto",alignItems:"center",gap:6,marginBottom:8}}>
   <label style={{fontSize:12,display:"flex",alignItems:"center",gap:6,minWidth:0}}><input type="checkbox" checked={linkedOnly} onChange={e=>setLinkedOnly(e.target.checked)}/> Connected wallets only</label>
   <button type="button" style={action} onClick={()=>setZoom(z=>clamp(Number((z+.25).toFixed(2)),1,2))} aria-label="Zoom in">＋</button>
   <button type="button" style={action} onClick={()=>setZoom(z=>clamp(Number((z-.25).toFixed(2)),1,2))} aria-label="Zoom out">−</button>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:6,alignItems:"center",marginBottom:10}}>
   <label style={{fontSize:12,display:"flex",alignItems:"center",gap:6,minWidth:0}}>Cluster <select aria-label="Filter by connected cluster" value={groupFilter} onChange={e=>{setGroupFilter(e.target.value);setSelected(null);}} style={{...action,minWidth:0,width:"100%"}}><option value="all">All wallets</option>{clusters.map((g,i)=><option key={i} value={String(i)}>Group {i+1} · {g.members.length} wallets</option>)}</select></label>
   <button type="button" style={action} onClick={()=>{setZoom(1);setSelected(null);setLinkedOnly(false);setGroupFilter("all");}}>Reset</button>
  </div>
  <svg viewBox="0 0 100 100" role="group" aria-label="Interactive wallet connection network" style={{width:"100%",height:"auto",maxHeight:430,background:"#0b1420",borderRadius:10}}>
   <g transform={`translate(50 50) scale(${zoom}) translate(-50 -50)`}>
    {shownEdges.map(e=>{const a=lookup.get(e.walletA),b=lookup.get(e.walletB),highlight=selected&&(e.walletA===selected||e.walletB===selected);return <line key={e.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={highlight?"#fff1a7":verifiedKeys.has(e.key)?"#58d7b0":"#efbd68"} strokeWidth={highlight?.85:.35} opacity={selected&&!highlight?.22:.8}/>;})}
    {visible.map(n=>{const linked=connected.has(n.wallet),radius=clamp(1.8+Math.sqrt(n.sharePct)*1.2,2,8);return <circle key={n.wallet} cx={n.x} cy={n.y} r={radius} fill={linked?"#c76b53":"#268a81"} stroke={selected===n.wallet?"#ffffff":"#b4c6d8"} strokeWidth={selected===n.wallet?.85:.22} opacity={selected&&selected!==n.wallet?.6:1} tabIndex={0} role="button" aria-label={`Wallet ${short(n.wallet)}, ${n.sharePct.toFixed(2)} percent supply, ${linked?"connected":"no detected connections"}`} onClick={()=>setSelected(n.wallet)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(n.wallet);}}} style={{cursor:"pointer",outline:"none"}}><title>{n.wallet}: {n.sharePct.toFixed(2)}% supply</title></circle>;})}
   </g>
  </svg>
  {clusters.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10,marginBottom:8}}>{clusters.map((g,i)=><button key={i} type="button" style={{...action,borderColor:groupFilter===String(i)?"#ffb58b":"#43536a"}} onClick={()=>{setGroupFilter(String(i));setSelected(null);}}>Group {i+1}: {g.members.length} wallets · {g.sharePct.toFixed(2)}% observed supply</button>)}</div>}
  <button type="button" style={{...action,fontSize:12,marginTop:8}} onClick={()=>setShowGuide(v=>!v)} aria-expanded={showGuide}>{showGuide?"Hide map legend":"Map legend & interpretation"}</button>
  {showGuide&&<p style={{fontSize:12,color:"#a9b6c9",lineHeight:1.5}}>Tap a bubble to inspect a wallet. Green lines indicate evidence-verified pairs; amber lines indicate candidates. Teal bubbles have no detected connections in the current investigation. Connections do not establish common ownership or coordinated trading.</p>}
  {active?<div aria-live="polite" style={{background:"#172537",borderRadius:10,padding:12,overflowWrap:"anywhere",fontSize:13}}>
   <strong>Wallet #{active.rank} · {active.sharePct.toFixed(2)}% observed supply</strong>
   <p><a href={solscan("account",active.wallet)} target="_blank" rel="noopener noreferrer" style={{color:"#9cdcff"}}>{active.wallet} ↗</a></p>
   <strong>{activeEdges.length} candidate relationship(s)</strong>
   {activeEdges.length===0?<p>No direct relationships detected in the currently available investigation.</p>:activeEdges.map(e=><div key={e.key} style={{borderTop:"1px solid #34465c",marginTop:10,paddingTop:10}}>
    <div>With <a href={solscan("account",e.walletA===active.wallet?e.walletB:e.walletA)} target="_blank" rel="noopener noreferrer" style={{color:"#9cdcff"}}>{short(e.walletA===active.wallet?e.walletB:e.walletA)} ↗</a> · {e.signatures.length} signature reference(s) · {verifiedKeys.has(e.key)?"Verified transfer evidence":"Candidate — validation pending or unavailable"}</div>
    <details style={{marginTop:5}}><summary style={{cursor:"pointer"}}>View transaction evidence</summary>
     {e.signatures.length===0?<p>No signatures attached to this relationship.</p>:<ul style={{paddingLeft:20}}>{e.signatures.map(sig=><li key={sig}><a href={solscan("tx",sig)} target="_blank" rel="noopener noreferrer" style={{color:"#9cdcff"}}>{short(sig)} ↗</a></li>)}</ul>}
    </details>
   </div>)}
  </div>:<p style={{fontSize:12,color:"#a9b6c9"}}>Select a wallet to inspect observed holdings, counterparties and transaction references.</p>}
 </section>;
}
