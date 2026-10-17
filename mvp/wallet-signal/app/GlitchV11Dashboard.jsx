"use client";
import React from "react";
import {attributes} from "../lib/glitchScoringV11.mjs";
import {summarizeHistoricalHolderPreview} from "../lib/holderHistoricalPreviewV11.mjs";
import {scoreTokenSecurity,scoreHolderIntelligence,scoreCreatorIntelligence,scoreLiquidityQuality} from "../lib/glitchAttributeEnginesV11.mjs";
const pretty=s=>s.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
/** Preview only. Historical investigations continue independently; no invented completion. */
export default function GlitchV11Dashboard({result,extensions,concentration,creatorEvidence,liquidity,historicalHolders,holderSnapshotCompatible=false}){
 const parsed=!!result&&result.authorityDetailsStatus!=="not_parsed"&&Object.hasOwn(result,"mintAuthority")&&Object.hasOwn(result,"freezeAuthority");
 const fee=extensions?.transferFee;
 const security=scoreTokenSecurity({
  tokenProgram:result?.tokenProgram,authoritiesParsed:parsed,
  mintAuthority:result?.mintAuthority,freezeAuthority:result?.freezeAuthority,
  feeExtensionVerified:extensions?.verified===true,
  feeApplicable:fee?.status==="observed"?true:undefined,
  feePercent:typeof fee?.newerFee?.percentage==="number"?fee.newerFee.percentage:undefined,
  feeConfigAuthorityReported:fee?.configAuthorityReported===true,
  feeConfigAuthority:fee?.configAuthority
 });
 const holders=scoreHolderIntelligence({top20SharePct:typeof concentration?.top20TokenAccountSharePct==="number"?concentration.top20TokenAccountSharePct:undefined});
 const creator=scoreCreatorIntelligence({creatorVerified:creatorEvidence?.status==="VERIFIED"&&!!creatorEvidence?.creator});
 const pools=scoreLiquidityQuality({});
 const scores={token_security:security,holder_intelligence:holders,creator_intelligence:creator,liquidity_quality_safety:pools};
 const historical=summarizeHistoricalHolderPreview({historical:historicalHolders,compatible:holderSnapshotCompatible});
 return <section aria-label="GLITCH v1.1 attribute preview" style={{background:"#10141d",border:"1px solid #354156",borderRadius:16,padding:16,marginBottom:18}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
   <div><strong style={{fontSize:19,color:"#f3f5ff"}}>GLITCH // Intelligence v1.1</strong><p style={{color:"#aebbd0",fontSize:12,margin:"5px 0"}}>4 attributes · 18 checks · Evidence-first preview</p></div>
   <span style={{color:"#ffbf86",fontSize:13}}>Overall score: Pending calibration</span>
  </div>
  {historical.available&&<div style={{background:"#202532",border:"1px solid #394456",borderRadius:10,padding:12,marginTop:12,color:"#d4dbea",fontSize:12}}><strong>Historical holder investigation</strong><p style={{margin:"5px 0"}}>{historical.holderCount} wallets · {historical.directPairs??"—"} observed direct pairs · {historical.connectedWallets??"—"} connected wallets · History {historical.historyComplete?"reported complete":"still partial"}</p><p style={{margin:0,color:"#aebbd0"}}>{historical.note}</p></div>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12,marginTop:12}}>
  {attributes.map(a=>{const s=scores[a.id];return <article key={a.id} style={{background:"#1a202c",border:"1px solid #394456",borderRadius:12,padding:14}}>
   <div style={{color:"#e8efff",fontWeight:700}}>{a.name}</div>
   <div style={{fontSize:12,color:"#aebbd0",margin:"6px 0 12px"}}>{a.weight}% overall weight · {s.coveragePct}% scoring inputs assessed</div>
   <div style={{fontSize:24,fontWeight:800,color:"#f3c66b"}}>{s.score===null?"—":s.score+"/100"} <span style={{fontSize:11,fontWeight:400,color:"#aebbd0"}}>{s.score===null?"Insufficient evidence":"Uncalibrated preview"}</span></div>
   <div style={{height:5,background:"#30394b",borderRadius:6,margin:"10px 0"}}><div style={{width:s.coveragePct+"%",height:"100%",background:"#dc5757",borderRadius:6}}/></div>
   {s.components.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:11,padding:"5px 0",borderBottom:"1px solid #2d3646",color:"#cbd4e4"}}>
    <span>{pretty(c.id)}</span><span style={{whiteSpace:"nowrap"}}>{c.reason==="not_applicable"?"N/A":c.points===null?"Pending":c.points+" / "+c.max}</span>
   </div>)}
  </article>})}
  </div>
  <p style={{fontSize:11,color:"#aebbd0",margin:"12px 0 0"}}>Observed checks can appear before historical scans finish. Pending does not mean safe or risky. Creator and liquidity scores require verified behavioral and pool evidence. No investment or fraud probability is implied.</p>
 </section>;
}
