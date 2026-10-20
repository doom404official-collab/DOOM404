"use client";
import {useState} from "react";
import HolderBubbleMap from "./HolderBubbleMap";
import {attributes,consolidate} from "../lib/glitchScoringV11.mjs";
import {adaptDashboardEvidence} from "../lib/glitchDashboardEvidenceV11.mjs";
import {summarizeHistoricalHolderPreview} from "../lib/holderHistoricalPreviewV11.mjs";

const fmt=(v,suffix="")=>typeof v==="number"&&Number.isFinite(v)?v.toLocaleString("en-US",{maximumFractionDigits:2})+suffix:"Pending";
const addr=v=>typeof v==="string"&&v? v.slice(0,6)+"…"+v.slice(-5):"Not verified";
const row=(name,value,detail)=>({name,value,detail});
const css=`
.g11{width:calc(100vw - 24px);max-width:1600px;position:relative;left:50%;transform:translateX(-50%);color:#f5f3f3;background:#08090c;border:1px solid #3b2429;border-radius:18px;padding:clamp(12px,2vw,22px);margin:18px 0;font-family:Inter,system-ui,sans-serif}
.g11 *{box-sizing:border-box}.g11-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
.g11-brand{color:#ff515a;font-size:12px;font-weight:900;letter-spacing:.14em}.g11 h2{margin:5px 0;font-size:clamp(23px,3vw,32px)}.g11 h3{margin:0;font-size:17px}
.g11-muted{color:#adb0ba}.g11-panel{background:linear-gradient(145deg,#1b1b21,#111217);border:1px solid #373039;border-radius:16px;padding:16px;min-width:0}
.g11-overview{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,2fr);gap:12px;margin-bottom:12px}
.g11-verdict{border-left:4px solid #ed4854}.g11-big{font-size:clamp(24px,3vw,32px);font-weight:800;margin:10px 0}
.g11-insights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
.g11-insights article{background:#242126;border:1px solid #383039;border-radius:10px;padding:11px;font-size:12px;line-height:1.5}
.g11-insights strong{display:block;color:#ff858e;margin-bottom:5px}
.g11-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:14px 0}
.g11-tab{background:#1c1b20;border:1px solid #3e343a;color:#e5e0e2;border-radius:11px;padding:12px;text-align:left;cursor:pointer;min-height:76px}
.g11-tab[aria-selected=true]{border-color:#ff515a;background:#2c191f;box-shadow:inset 0 0 0 1px #a83943}
.g11-tab strong{display:block;font-size:13px}.g11-tab span{display:block;color:#b7adb1;font-size:11px;margin-top:6px}
.g11-work{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.g11-work>.g11-panel{min-width:0}
.g11-data{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:13px}
.g11-data article{background:#201e23;border:1px solid #353039;border-radius:10px;padding:12px;min-width:0;min-height:116px}
.g11-data strong{display:block;font-size:16px;overflow-wrap:anywhere;margin:5px 0}.g11-data small{font-size:11px;color:#aaaab4;line-height:1.45}
.g11-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#b8aeb4}
.g11 button:focus-visible{outline:3px solid #ff6b75;outline-offset:2px}
.g11-map{margin-top:12px}.g11-inspector{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.g11-inspector>article{padding:10px;border:1px solid #373039;border-radius:10px;background:#201e23}.g11-inspector strong{display:block;margin:5px 0}.g11-attribute-select{background:#21171b;color:#f5f3f3;border:1px solid #76424a;border-radius:9px;padding:10px 12px;min-height:42px;max-width:100%;flex:1}.g11-attribute-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.g11-attribute-tabs .g11-action{font-size:12px;text-align:center;min-width:0}.g11-attribute-tabs [aria-current="page"]{border-color:#ff5967;background:#4a2029;box-shadow:inset 0 0 0 1px #a83d4c}.g11-action{border:1px solid #76424a;background:#281a20;color:#fff;border-radius:9px;padding:9px 12px;cursor:pointer;min-height:42px}.g11-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.g11-full{position:fixed;inset:0;z-index:9999;width:100vw;max-width:none;height:100dvh;overflow-y:auto;overscroll-behavior:contain;margin:0;border-radius:0;left:0;transform:none;padding:clamp(10px,2vw,22px)}body:has(.g11-full){overflow:hidden}.g11-foot{color:#b4abb0;font-size:11px;line-height:1.6;margin-top:12px}
@media(max-width:900px){.g11-attribute-tabs{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}.g11-attribute-tabs .g11-action{flex:0 0 auto;scroll-snap-align:start;white-space:nowrap}.g11-overview{grid-template-columns:1fr}.g11-insights{grid-template-columns:repeat(3,minmax(0,1fr))}.g11-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.g11-data{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.g11{width:calc(100vw - 12px);padding:9px}.g11-full{width:100vw;padding:10px}.g11-head{margin-bottom:9px}.g11 h2{font-size:23px}.g11-overview{gap:8px}.g11-panel{padding:12px}.g11-verdict .g11-big{font-size:20px;margin:5px 0}.g11-insights{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.g11-insights article{font-size:10px;padding:7px}.g11-insights strong{font-size:10px}.g11-tabs{gap:6px;margin:9px 0}.g11-tab{padding:9px;min-height:63px}.g11-tab strong{font-size:12px}.g11-data{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.g11-data article{padding:9px;min-height:108px}.g11-data strong{font-size:15px}.g11-data small{font-size:10px}.g11-kicker{font-size:10px}.g11-inspector{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.g11-inspector>article{padding:7px}.g11-inspector strong{font-size:12px;overflow-wrap:anywhere}.g11-inspector small{font-size:9px}}
`;
export default function GlitchV11Dashboard({result,extensions,concentration,creatorEvidence,liquidity,historicalHolders,holderSnapshotCompatible=false,verifiedHolderEnvelope,workerEvidence}){
 const [selected,setSelected]=useState("token_security");
 const [fullScreen,setFullScreen]=useState(false);
 const [holderView,setHolderView]=useState("overview");
 const parsed=!!result&&result.authorityDetailsStatus!=="not_parsed"&&Object.hasOwn(result,"mintAuthority")&&Object.hasOwn(result,"freezeAuthority");
 const fee=extensions?.mint===result?.mint?extensions.transferFee:null;
 const adapted=adaptDashboardEvidence({result,extensions,concentration,creatorEvidence,historicalHolders,verifiedHolderEnvelope,workerEvidence});
 const {scores,top20}=adapted;
 const feeNA=scores.token_security.components[0].reason==="not_applicable";
 const verifiedHolderAssessment=adapted.matchedHolder?verifiedHolderEnvelope?.assessment:null;
 const historical=summarizeHistoricalHolderPreview({historical:historicalHolders?.mint===result?.mint?historicalHolders:null,compatible:holderSnapshotCompatible});
 const overallAssessment=consolidate(scores);
 const overallScore=overallAssessment.score;
 const fields={
  token_security:[
   row("Transfer Fee Schedule",feeNA?"Not applicable":fee?.status==="observed"?fmt(fee?.newerFee?.percentage,"%") :"Pending","Newer configured schedule only; effective epoch and maximum fee unverified"),
   row("Fee Configuration Authority",feeNA?"Not applicable":fee?.configAuthorityReported?fee.configAuthority?addr(fee.configAuthority):"Revoked":"Pending","Can the fee schedule be changed?"),
   row("Mint Authority",parsed?result.mintAuthority?addr(result.mintAuthority):"Revoked":"Pending","Current mint permission"),
   row("Freeze Authority",parsed?result.freezeAuthority?addr(result.freezeAuthority):"Revoked":"Pending","Current freeze permission")
  ],
  holder_intelligence:[
   row("Top-20 Holder Concentration",fmt(top20,"%"),"Share of mint supply; owner classification may be incomplete"),
   row("Connected-Wallet Network",historical.available?fmt(historical.directPairs)+" wallet pairs":"Pending",historical.available?fmt(historical.connectedWallets)+" wallets appear in the observed transfer network. "+(historical.compatible?"Snapshot matches current holders.":"Based on a historical snapshot."):"Awaiting historical transaction evidence"),
   row("Creator/Team Exposure","Pending","Requires verified creator-linked top-20 holdings"),
   row("Holder Breadth & Independence",historical.available?fmt(historical.connectedWallets)+" connected wallets":"Pending",historical.available?"Connected wallets identified so far; independent wallet count awaits full history.":"Independent wallets not yet established")
  ],
  creator_intelligence:[
   row("Creator Identification",adapted.creatorVerified?addr(creatorEvidence.creator):"Not independently verified","Attribution status: "+(creatorEvidence?.status||"Unknown")),
   row("Creator Holdings",adapted.creator?.holdings?fmt(adapted.creator.holdings.supplySharePct,"% observed"):"Pending","Wallet balance observation only; linked-wallet attribution remains unscored. Observed: "+(adapted.creator?.holdings?.observedAt||"unknown")),
   row("Creator Selling",adapted.creatorCompatible&&adapted.creator?.selling?adapted.creator.selling.percentages.map(v=>fmt(v,"%")).join(" / "):"Pending","1h / 24h / 7d verified selling; transfers are not sales"),
   row("Previous Launches",adapted.creator?.previousLaunchCount!=null?fmt(adapted.creator.previousLaunchCount)+" attributed launches":"Pending","Observed launch count is not a comparable-outcomes score")
  ],
  liquidity_quality_safety:[
   row("Available Liquidity",liquidity?.mint===result?.mint&&liquidity?.reportedLiquidityUsd!=null?"$"+fmt(Number(liquidity.reportedLiquidityUsd)):"Pending","Provider-reported estimate; executable depth unverified"),
   row("Liquidity-to-Market-Cap Ratio","Pending","Requires verified liquidity and valuation denominator"),
   row("LP Security","Pending","Lock, burn, withdrawal rights and LP custody. Persisted pool checks: "+fmt(adapted.liquidity?.checkedPoolCount)),
   row("Liquidity Concentration",liquidity?.mint===result?.mint&&liquidity?.poolCountReturned!=null?fmt(liquidity.poolCountReturned)+" reported pools":"Pending","Independent pool control and reserve shares unverified"),
   row("Trading Impact","Pending","Executable reference sell quote and slippage"),
   row("Liquidity Stability","Pending","30-day verified reserve and withdrawal history")
  ]
 };
 const current=attributes.find(a=>a.id===selected)||null;
 const currentScore=current?scores[current.id]:null;
 const insight=[
  {name:"01 / Observed signal",detail:typeof top20==="number"?"Top-20 token accounts hold "+fmt(top20,"%")+" of mint supply.":"Top-20 concentration evidence is still being collected."},
  {name:"02 / Historical connections",detail:historical.available?fmt(historical.directPairs)+" wallet pairs have recorded transaction links involving "+fmt(historical.connectedWallets)+" wallets; "+(historical.compatible?"snapshot matches current holders.":"based on an earlier holder snapshot."):"Verified historical connections not yet available for this view."},
  {name:"03 / Evidence coverage",detail:"Historical scanning continues. Creator behavior and liquidity security require further verification."}
 ];
 return <section className={"g11"+(fullScreen?" g11-full":"")} aria-label="GLITCH Intelligence v1.1"><style>{css}</style>
  <header className="g11-head"><div><div className="g11-brand">DOOM404 / GLITCH</div><h2>Token Intelligence</h2><div className="g11-muted" style={{fontSize:13}}>Evidence-First Assessment</div></div><div className="g11-actions"><span style={{color:"#ffb1b7",background:"#392127",padding:"7px 11px",borderRadius:20,fontSize:11}}>DEVELOPMENT PREVIEW</span><button type="button" className="g11-action" onClick={()=>setFullScreen(x=>!x)} aria-label={fullScreen?"Exit full screen":"Open full screen"}>{fullScreen?"Exit full screen":"Full screen ↗"}</button></div></header>
  <div className="g11-overview"><article className="g11-panel g11-verdict"><div className="g11-kicker">GLITCH // OVERALL TOKEN ASSESSMENT</div><div className="g11-big">Overall Score: {overallScore===null?"Pending":fmt(overallScore)+"/100"}</div><div className="g11-muted" style={{fontSize:13}}>Combined assessment of Token Security, Holder Intelligence, Creator Intelligence, and Liquidity Quality &amp; Safety.</div></article>
  <article className="g11-panel"><h3>Top 3 Overall Findings</h3><div className="g11-insights">{insight.map(x=><article key={x.name}><strong>{x.name}</strong>{x.detail}</article>)}</div></article></div>
  <nav className="g11-attribute-tabs" aria-label="Attribute navigation">{attributes.map(a=><button type="button" key={a.id} aria-current={selected===a.id?"page":undefined} className="g11-action" onClick={()=>{setSelected(a.id);setHolderView("overview");}}>{a.name}</button>)}</nav>
  {current&&<div className="g11-work"><div className="g11-panel"><div className="g11-head"><h3>{current.name}</h3><span style={{color:"#ff929b",fontSize:12}}>Final score: {currentScore.complete&&currentScore.calibrated?fmt(currentScore.score)+"/100":"Pending"}</span></div>{selected==="holder_intelligence"&&historical.available&&<div className="g11-actions" style={{marginTop:10}}><button type="button" className="g11-action" aria-pressed={holderView==="overview"} onClick={()=>setHolderView("overview")}>Overview</button><button type="button" className="g11-action" aria-pressed={holderView==="map"} onClick={()=>setHolderView("map")}>Connection map</button></div>}
  {holderView!=="map"&&<div className="g11-data">{fields[current.id].map(x=><article key={x.name}><span className="g11-kicker">{x.name}</span><strong>{x.value}</strong><small>{x.detail}</small></article>)}</div>}
  {selected==="holder_intelligence"&&historical.available&&holderView==="map"&&<div className="g11-map"><h3>Connection map & evidence inspector</h3><p className="g11-muted" style={{fontSize:12}}>Historical evidence · {historical.compatible?"Snapshot reconciled":"Historical snapshot only"} · No ownership inference</p><HolderBubbleMap holders={historicalHolders.holders||[]} groups={historicalHolders.connectedGroups||[]} scanStatus={historicalHolders.scanStatus||"partial"} transactionsChecked={historicalHolders.transactionsChecked} walletHistoriesReached={historicalHolders.walletHistoriesReached} verifiedAssessment={verifiedHolderAssessment||null}/></div>}
  </div><div className="g11-inspector" aria-label="Evidence summary"><article><span className="g11-kicker">Attribute status</span><strong>{currentScore.complete?"Inputs assessed":"In progress"}</strong><small className="g11-muted">Final score pending</small></article><article><span className="g11-kicker">Evidence coverage</span><strong>{fmt(currentScore.coveragePct,"%")}</strong><small className="g11-muted">Not a risk score</small></article><article><span className="g11-kicker">Methodology</span><strong>GLITCH v1.1</strong><small className="g11-muted">Backend calculation</small></article></div></div>}
  {currentScore&&<p className="g11-foot">Pending components: {currentScore.components.filter(c=>c.max>0&&c.points===null).map(c=>(c.reason||c.id).replaceAll("_"," ").toLowerCase()).join("; ")||"None; calibration acceptance still required"}</p>}
  <p className="g11-foot">{selected==="creator_intelligence"?"Still needed: "+adapted.creatorMissing.join("; "):selected==="liquidity_quality_safety"?"Still needed: "+adapted.liquidityMissing.join("; "):"Final scores require complete evidence and calibration."}</p>
  <p className="g11-foot">Transfers establish observed interactions, not common ownership. Reported liquidity is not verified executable depth. Pending values are not scored as safe or unsafe.</p>
 </section>;
}
