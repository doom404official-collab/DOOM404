"use client";
import PracticalAssessmentPanel from "./PracticalAssessmentPanel";
import {practicalAssessmentV2} from "../lib/practicalScoringV2.mjs";
import {mintAuthorityEvidence,normalizeMintAuthority} from "../lib/mintAuthorityEvidence.mjs";
import {useEffect,useRef,useState} from "react";
import {HOLDER_RETAIN19_POLICY,HOLDER_ELIGIBLE_CONCENTRATION_POLICY} from "../lib/holderEligibleViewPolicy.mjs";
import {isVerifiedHolderCollectionLineage} from "../lib/holderCollectionLineage.mjs";
import HolderBubbleMap from "./HolderBubbleMap";
import {assessmentBounds} from "../lib/assessmentBounds.mjs";
import {attributes,consolidate} from "../lib/glitchScoringV11.mjs";
import {adaptDashboardEvidence,liquidityAccountObservationAt} from "../lib/glitchDashboardEvidenceV11.mjs";
import {summarizeHistoricalHolderPreview} from "../lib/holderHistoricalPreviewV11.mjs";

const fmt=(v,suffix="")=>typeof v==="number"&&Number.isFinite(v)?v.toLocaleString("en-US",{maximumFractionDigits:2})+suffix:"Pending";
const addr=v=>typeof v==="string"&&v? v.slice(0,6)+"…"+v.slice(-5):"Not verified";
const row=(name,value,detail)=>({name,value,detail});
const css=`
.g11{box-sizing:border-box;width:calc(100vw - 24px);max-width:1600px;position:relative;left:50%;transform:translateX(-50%);color:#f5f3f3;background:#08090c;border:1px solid #3b2429;border-radius:18px;padding:clamp(12px,2vw,22px);margin:18px 0;font-family:Inter,system-ui,sans-serif}
.g11 *{box-sizing:border-box}.g11-attribute-tabs button{min-height:44px}.g11-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
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
.g11 summary:focus-visible,.g11 a:focus-visible,.g11 button:focus-visible{outline:3px solid #ff6b75;outline-offset:2px}
.g11-map{margin-top:12px}.g11-inspector{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.g11-inspector>article{padding:10px;border:1px solid #373039;border-radius:10px;background:#201e23}.g11-inspector strong{display:block;margin:5px 0}.g11-attribute-select{background:#21171b;color:#f5f3f3;border:1px solid #76424a;border-radius:9px;padding:10px 12px;min-height:42px;max-width:100%;flex:1}.g11-attribute-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0}.g11-attribute-tabs .g11-action{font-size:12px;text-align:center;min-width:0}.g11-attribute-tabs [aria-current="page"]{border-color:#ff5967;background:#4a2029;box-shadow:inset 0 0 0 1px #a83d4c}.g11-action{border:1px solid #76424a;background:#281a20;color:#fff;border-radius:9px;padding:9px 12px;cursor:pointer;min-height:42px}.g11-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.g11-full{position:fixed;inset:0;z-index:9999;width:100vw;max-width:none;height:100dvh;overflow-y:auto;overscroll-behavior:contain;margin:0;border-radius:0;left:0;transform:none;padding:clamp(10px,2vw,22px)}.doom-token-inspect:has(.g11-full){transform:none;left:0;width:100%}body:has(.g11-full){overflow:hidden}.g11-foot{color:#b4abb0;font-size:11px;line-height:1.6;margin-top:12px}
@media(max-width:900px){.g11-attribute-tabs{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}.g11-attribute-tabs .g11-action{flex:0 0 auto;scroll-snap-align:start;white-space:nowrap}.g11-overview{grid-template-columns:1fr}.g11-insights{grid-template-columns:repeat(3,minmax(0,1fr))}.g11-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.g11-data{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.g11{box-sizing:border-box;width:calc(100vw - 12px);padding:9px}.g11-full{width:100vw;padding:10px}.g11-head{margin-bottom:9px}.g11 h2{font-size:23px}.g11-overview{gap:8px}.g11-panel{padding:12px}.g11-verdict .g11-big{font-size:20px;margin:5px 0}.g11-insights{grid-template-columns:1fr;gap:7px}.g11-insights article{font-size:12px;padding:10px}.g11-insights strong{font-size:12px}.g11-tabs{gap:6px;margin:9px 0}.g11-tab{padding:9px;min-height:63px}.g11-tab strong{font-size:12px}.g11-data{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.g11-data article{padding:9px;min-height:108px}.g11-data strong{font-size:15px}.g11-data small{font-size:10px}.g11-kicker{font-size:10px}.g11-inspector{grid-template-columns:1fr;gap:7px}.g11-inspector>article{padding:10px}.g11-inspector strong{font-size:14px;overflow-wrap:anywhere}.g11-inspector small{font-size:12px}}
`;
export default function GlitchV11Dashboard({result,extensions,concentration,creatorEvidence,liquidity,liquidityError="",liquidityRefreshing=false,historicalHolders,holderSnapshotCompatible=false,verifiedHolderEnvelope,workerEvidence,holderEvidenceState="unknown",frozenHolderObservation=null,currentLiquidity=null,currentCreator=null,providerUsage=null,inspectionTiming=null,onRequestLegacyEvidence=null,children}){
 // Re-render at the existing freshness boundary, even without polling or interaction.
 const [clockRevision,refreshClock]=useState(0);
 const observedAt=liquidity?.observedAt,storedAt=liquidityAccountObservationAt(workerEvidence?.liquidity);
 const feeAt=extensions?.observedAt,creatorAt=workerEvidence?.creator?.updatedAt,holderAt=verifiedHolderEnvelope?.updatedAt;
 useEffect(()=>{
  const now=Date.now(),deadlines=[observedAt,storedAt,feeAt,creatorAt,holderAt].map(x=>typeof x==='string'?Date.parse(x):NaN).filter(x=>Number.isFinite(x)&&x<=now&&x+3600001>now);
  const timer=deadlines.length?setTimeout(()=>refreshClock(x=>x+1),Math.min(...deadlines)+3600001-now):null;
  const visible=()=>{if(document.visibilityState==='visible')refreshClock(x=>x+1);};
  document.addEventListener('visibilitychange',visible);
  return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
 },[observedAt,storedAt,feeAt,creatorAt,holderAt,clockRevision]);
 const [selected,setSelected]=useState("overall");
 const [copyStatus,setCopyStatus]=useState('');
 async function copyMint(){try{await navigator.clipboard.writeText(result?.mint||'');setCopyStatus('Copied');}catch{setCopyStatus('Copy unavailable');}}
 const selectAttribute=id=>{setSelected(id);dashboardRef.current?.scrollIntoView?.({block:'start',behavior:'instant'});};
 const [fullScreen,setFullScreen]=useState(false);
 const dashboardRef=useRef(null),fullScreenToggleRef=useRef(null);
 useEffect(()=>{dashboardRef.current?.scrollIntoView?.({block:"start",behavior:"instant"});},[result?.mint]);
 useEffect(()=>{
  if(!fullScreen)return;
  const panel=dashboardRef.current,toggle=fullScreenToggleRef.current;
  if(!panel)return;
  const focusable=()=>Array.from(panel.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]'))
   .filter(node=>node.tabIndex>=0&&!node.matches(':disabled')&&!node.closest('[inert]')&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden');
  const focusInside=()=>{if(!panel.contains(document.activeElement))(focusable()[0]||panel).focus();};
  const keydown=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setFullScreen(false);return;}
   if(event.key!=='Tab')return;
   const nodes=focusable(),first=nodes[0],last=nodes[nodes.length-1],active=document.activeElement;
   if(!first){event.preventDefault();panel.focus();return;}
   if(!nodes.includes(active)){event.preventDefault();(event.shiftKey?last:first).focus();}
   else if(event.shiftKey&&active===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&active===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',keydown,true);
  document.addEventListener('focusin',focusInside);
  toggle?.focus();
  return ()=>{
   document.removeEventListener('keydown',keydown,true);
   document.removeEventListener('focusin',focusInside);
   if(toggle?.isConnected)toggle.focus();
  };
 },[fullScreen]);
 const [holderView,setHolderView]=useState("overview");
 const authorities=mintAuthorityEvidence(result,{parsed:!!result?.mint&&result.authorityDetailsStatus!=="not_parsed"});
 const parsed=authorities.authorityDetailsStatus==="available";
 const adapted=adaptDashboardEvidence({liquidity,result,extensions,concentration,creatorEvidence,historicalHolders,verifiedHolderEnvelope,workerEvidence});
 const {scores,top20,fee,effectiveFee}=adapted;
 const feeAuthority=normalizeMintAuthority(fee?.configAuthority);
 const feeNA=scores.token_security.components[0].reason==="not_applicable";
 const verifiedHolderAssessment=adapted.matchedHolder?verifiedHolderEnvelope?.assessment:null;
 const historical=summarizeHistoricalHolderPreview({historical:historicalHolders?.mint===result?.mint?historicalHolders:null,compatible:holderSnapshotCompatible});
 const frozenComponent=frozenHolderObservation?.snapshotId===HOLDER_RETAIN19_POLICY.snapshotId&&
  frozenHolderObservation?.policy?.id===HOLDER_ELIGIBLE_CONCENTRATION_POLICY.id&&
  frozenHolderObservation?.eligibilityPolicy===HOLDER_RETAIN19_POLICY.id&&
  frozenHolderObservation?.component?.id==='eligible_holder_concentration'&&
  frozenHolderObservation.component.status==='observed_only'&&frozenHolderObservation.component.max===35&&
  typeof frozenHolderObservation.component.points==='number'&&Number.isFinite(frozenHolderObservation.component.points)&&
  frozenHolderObservation.component.points>=0&&frozenHolderObservation.component.points<=35&&
  frozenHolderObservation.score===null&&frozenHolderObservation.finalScore===null&&frozenHolderObservation.scorePromoted===false&&
  frozenHolderObservation.calibrated===false?frozenHolderObservation.component:null;
 const overallAssessment=consolidate(scores);
 const overallScore=overallAssessment.score;
 const fields={
  token_security:[
   row("Transfer Fee Schedule",feeNA?"Not applicable":effectiveFee?fmt(effectiveFee.percentage,"%") :"Pending",feeNA?"Verified program/extension evidence: no transfer-fee extension applies.":effectiveFee?`Observed epoch ${effectiveFee.observedEpoch}; maximum ${effectiveFee.maximumFeeRaw} raw token units. Amount-dependent fee rounds up and is capped. Transfer behavior not verified; scoring pending.`:"Awaiting fresh, epoch-resolved fee evidence"),
   row("Fee Configuration Authority",feeNA?"Not applicable":fee?.configAuthorityReported===true&&feeAuthority!==undefined?feeAuthority===null?"Revoked":addr(feeAuthority):"Pending","Can the fee schedule be changed?"),
   row("Mint Authority",parsed?authorities.mintAuthority===null?"Revoked":addr(authorities.mintAuthority):"Pending","Current mint permission"),
   row("Freeze Authority",parsed?authorities.freezeAuthority===null?"Revoked":addr(authorities.freezeAuthority):"Pending","Current freeze permission")
  ],
  holder_intelligence:[
   row("Top-20 Holder Concentration",fmt(top20,"%"),"Share of mint supply; owner classification may be incomplete"),
   row("Connected-Wallet Network",historical.available?fmt(historical.directPairs)+" wallet pairs":"Pending",historical.available?fmt(historical.connectedWallets)+" wallets appear in the observed transfer network. "+(historical.compatible?"Snapshot matches current holders.":"Based on a historical snapshot."):"Awaiting historical transaction evidence"),
   row("Creator/Team Exposure","Pending","Requires verified creator-linked top-20 holdings"),
   row("Holder Breadth & Independence",historical.available?fmt(historical.connectedWallets)+" connected wallets":"Pending",historical.available?"Connected wallets identified so far; independent wallet count awaits full history.":"Independent wallets not yet established")
  ],
  creator_intelligence:[
   row("Creator Identification",adapted.creatorVerified?addr(creatorEvidence.creator):"Not independently verified","Attribution status: "+(creatorEvidence?.status||"Unknown")),
   row("Creator Holdings",adapted.creatorCompatible&&adapted.creator?.holdings?fmt(adapted.creator.holdings.supplySharePct,"% observed"):"Pending","Wallet balance observation only; linked-wallet attribution remains unscored. Observed: "+(adapted.creator?.holdings?.observedAt||"unknown")),
   row("Creator Selling",adapted.creatorCompatible&&adapted.creator?.selling?adapted.creator.selling.percentages.map(v=>fmt(v,"%")).join(" / "):"Pending","1h / 24h / 7d verified selling; transfers are not sales"),
   row("Previous Launches",adapted.creatorCompatible&&adapted.creator?.previousLaunchCount!=null?fmt(adapted.creator.previousLaunchCount)+" attributed launches":"Pending","Observed launch count is not a comparable-outcomes score")
  ],
  liquidity_quality_safety:[
   row("Available Liquidity",adapted.reportedLiquidity.amount!==null?"$"+fmt(adapted.reportedLiquidity.amount):"Unknown","Provider-reported estimate; executable depth unverified"),
   row("Liquidity-to-Market-Cap Ratio","Pending","Requires verified liquidity and valuation denominator"),
   row("LP Security","Pending","Lock, burn, withdrawal rights and LP custody. Persisted pool checks: "+fmt(adapted.liquidity?.checkedPoolCount)),
   row("Liquidity Concentration",adapted.reportedLiquidity.poolCount!==null?fmt(adapted.reportedLiquidity.poolCount)+" reported pools":"Pending","Independent pool control and reserve shares unverified"),
   row("Trading Impact","Pending","Executable reference sell quote and slippage"),
   row("Liquidity Stability","Pending","30-day verified reserve and withdrawal history")
  ]
 };
 const source=liquidity?.mint===result?.mint?liquidity:null;
 const observationTime=typeof source?.observedAt==='string'&&Number.isFinite(Date.parse(source.observedAt))?new Date(source.observedAt).toISOString():null;
 const liquidityReason=liquidityRefreshing?'Loading provider observations':liquidityError?'Provider unavailable':!source?'No matching provider observation':!observationTime?'Observation time unavailable':!adapted.reportedLiquidity.poolCount&&adapted.reportedLiquidity.poolCount!==0?'Observation expired, future-dated or unavailable':(Array.isArray(source.pools)&&source.pools.some(p=>p?.evidenceConflict===true))?'Conflicting pool observations':adapted.reportedLiquidity.amount===null?'No numeric liquidity estimate returned':'Observed only; executable depth is Unknown';
 const countText=value=>Number.isSafeInteger(value)&&value>=0?String(value):'Unknown';
 const current=attributes.find(a=>a.id===selected)||null;
 const currentScore=current?scores[current.id]:null;
 const practical=practicalAssessmentV2({result,extensions,workerEvidence,creatorEvidence,concentration,currentLiquidity,currentCreator,reportedLiquidity:liquidity});
 const bounds=assessmentBounds(scores);
 const insight=[
  {name:"Observed concentration",detail:typeof top20==="number"?(adapted.canonicalHolderObservation?"Eligible Top-20 wallets hold ":"Top-20 token accounts hold ")+fmt(top20,"%")+" of mint supply.":"Top-20 concentration evidence is unavailable."},
  {name:"Historical connections",detail:historical.available?fmt(historical.directPairs)+" wallet pairs have recorded transaction links involving "+fmt(historical.connectedWallets)+" wallets; "+(historical.compatible?"snapshot matches current holders.":"based on an earlier holder snapshot."):"Verified historical connections not yet available for this view."},
  {name:"Evidence coverage",detail:"Historical coverage is incomplete or unverified. Creator behavior and liquidity security require further verification."}
 ];
 return <section ref={dashboardRef} tabIndex={-1} role={fullScreen?"dialog":undefined} aria-modal={fullScreen?true:undefined} className={"g11"+(fullScreen?" g11-full":"")} aria-label="GLITCH Intelligence v1.1"><style>{css}</style>
  <header className="g11-head"><div className="g11-identity"><img className="g11-mascot" src="/doom404-mascot.png..jpeg" width="52" height="52" alt="DOOM404 official red-hooded robot mascot"/><div className="g11-token"><div className="g11-brand">DOOM404 / GLITCH</div><h2>Token Intelligence</h2><div className="g11-mint"><code title={result?.mint}>{addr(result?.mint)}</code><button type="button" className="g11-copy" onClick={copyMint} aria-label="Copy full mint address">{copyStatus==='Copied'?'Copied':'Copy'}</button></div><span className="g11-observed">Mint observed {result?.observedAt&&Number.isFinite(Date.parse(result?.observedAt))?<time dateTime={result?.observedAt}>{new Date(result?.observedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'})}</time>:'time unavailable'}</span><span role="status" className="g11-observed">{copyStatus==='Copy unavailable'?'Copy unavailable · expand the address below':''}</span></div></div><div className="g11-actions"><span className="g11-preview">DEVELOPMENT PREVIEW</span><button ref={fullScreenToggleRef} type="button" className="g11-action" onClick={()=>setFullScreen(x=>!x)} aria-label={fullScreen?"Exit full screen":"Open full screen"}>{fullScreen?"Exit full screen":"Full screen"}</button></div></header>
  <nav className="g11-attribute-tabs" aria-label="Attribute navigation">{[{id:"overall",name:"Overall"},... ["token_security","holder_intelligence","liquidity_quality_safety","creator_intelligence"].map(id=>attributes.find(a=>a.id===id))].map(a=><button type="button" key={a.id} aria-label={a.id==="liquidity_quality_safety"?"Liquidity & Safety":a.name} aria-current={selected===a.id?"page":undefined} className="g11-action" onClick={()=>selectAttribute(a.id)}><span className="g11-nav-full">{a.id==="liquidity_quality_safety"?"Liquidity & Safety":a.name}</span><span className="g11-nav-short" aria-hidden="true">{{overall:'Overall',token_security:'Security',holder_intelligence:'Holders',liquidity_quality_safety:'Liquidity',creator_intelligence:'Creator'}[a.id]}</span></button>)}</nav>
  <PracticalAssessmentPanel assessment={practical} selected={selected} providerUsage={providerUsage} inspectionTiming={inspectionTiming} onSelect={selectAttribute} decimals={result?.decimals}/>
  <details className="g11-foot"><summary>Token address and mint observation</summary><p><code>{result?.mint??'Not established'}</code></p><p>Observed {result?.observedAt??'time unavailable'} · slot {result?.contextSlot??'not established'}. Each supporting evidence section retains its own observation time.</p></details>
  <details className="g11-foot"><summary>Historical methodology and retained observations</summary>
  <div className="g11-overview"><article className="g11-panel g11-verdict"><div className="g11-kicker">GLITCH // OVERALL TOKEN ASSESSMENT</div><div className="g11-big">{overallScore===null?"Limited assessment: "+fmt(bounds.lower)+"–"+fmt(bounds.upper)+"/100":"Overall Score: "+fmt(overallScore)+"/100"}</div><div className="g11-muted" style={{fontSize:13}}>{overallScore===null?"Range reflects unresolved criteria. Evidence coverage: "+fmt(bounds.coveragePct,"%")+". Missing evidence earns no safety points. Calibration pending.":"Combined assessment of the four approved attributes."}</div></article>
  {selected==="overall"&&<article className="g11-panel"><h3>Evidence observations · not ranked</h3><div className="g11-insights">{insight.map(x=><article key={x.name}><strong>{x.name}</strong>{x.detail}</article>)}</div></article>}</div>
  </details>
  <details className="g11-foot" onToggle={event=>{if(event.currentTarget.open)onRequestLegacyEvidence?.();}}><summary>Expand retained evidence and historical connection map</summary>
  {current&&<div className="g11-work"><div className="g11-panel"><div className="g11-head"><h3>{current.name}</h3><span style={{color:"#ff929b",fontSize:12}}>{currentScore.complete&&currentScore.calibrated?"Final score: "+fmt(currentScore.score)+"/100":currentScore.complete?"Provisional score: "+fmt(currentScore.score)+"/100 · calibration pending":"Assessed points: "+fmt(currentScore.components.reduce((n,c)=>n+(c.points??0),0))+" / "+fmt(currentScore.components.reduce((n,c)=>n+c.max,0))+" · incomplete"}</span></div>{selected==="holder_intelligence"&&historical.available&&<div className="g11-actions" style={{marginTop:10}}><button type="button" className="g11-action" aria-pressed={holderView==="overview"} onClick={()=>setHolderView("overview")}>Overview</button><button type="button" className="g11-action" aria-pressed={holderView==="map"} onClick={()=>setHolderView("map")}>Connection map</button></div>}
  {(selected!=="holder_intelligence"||holderView!=="map")&&<div className="g11-data">{fields[current.id].map(x=><article key={x.name}><span className="g11-kicker">{x.name}</span><strong>{x.value}</strong><small>{x.detail}</small></article>)}</div>}
  {selected==="token_security"&&extensions?.mint===result?.mint&&extensions?.mintControls&&<div role="status" className="g11-foot"><p>Mint configuration observed at slot {extensions.mintControls.slot}. {extensions.mintControls.scope}</p>{extensions.mintControls.flags.map(flag=><p key={flag.id}><strong>Critical control warning: </strong>{flag.detail}</p>)}{!extensions.mintControls.additionalControlsResolved&&<p>The authority score does not assess these additional controls. Do not interpret it as a complete security assessment.</p>}</div>}
  {selected==="holder_intelligence"&&<div role="status" className="g11-foot">{holderEvidenceState==="loading"?"Loading Holder evidence…":holderEvidenceState==="error"?"Holder evidence provider unavailable. Any retained observations may be stale; verification is Unknown.":"Observed relationships do not establish common ownership. Historical coverage is incomplete; concentration can be assessed separately."}{result?.mint===HOLDER_RETAIN19_POLICY.mint&&<details><summary>Preserved October snapshot · historical evidence only</summary><p>Approved scope for frozen Snapshot #2 at slot 457305617: original ranking 20; eligible view 19 after pool exclusion. No replacement or supply rescaling. The map below shows the supplied historical job, not an automatically verified frozen snapshot. Eligible-holder concentration is approved separately from the original top-20 measurement. {frozenHolderObservation?.snapshotId===HOLDER_RETAIN19_POLICY.snapshotId?<span data-testid="frozen-concentration">Stored Snapshot #2 observation: Original frozen top-20 concentration {fmt(frozenHolderObservation.originalTop20.sharePct,"%")} (20 holders); Eligible-holder concentration {fmt(frozenHolderObservation.eligible.sharePct,"%")} (19 holders; HOLDER_ELIGIBLE_CONCENTRATION_V1). Unchanged raw mint supply: {frozenHolderObservation.eligible.supplyRaw}. {frozenComponent&&<span data-testid="frozen-concentration-component">Observed eligible-holder concentration component: {fmt(frozenComponent.points)}/35. Component only — not a Holder or Overall score. </span>}{isVerifiedHolderCollectionLineage(frozenHolderObservation.collectionLineage)?<span data-testid="frozen-collection-lineage">Collection-to-persistence lineage verified: matching canonical row hash and reviewed <a href="https://github.com/doom404official-collab/DOOM404/actions/runs/38769967061" target="_blank" rel="noreferrer">historical run receipt</a> (<a href="https://github.com/doom404official-collab/DOOM404/commit/0fa974337ae4bdfd657628ec674be5555433fd9a" target="_blank" rel="noreferrer">source commit</a>). This is not raw provider or cryptographic execution proof. </span>:<span>Collection lineage unverified. </span>}Exact-slot account-state certification and historical-job association remain unverified; final score remains Pending.</span>:"Eligible-holder concentration: Unknown — matching frozen raw inputs are unavailable."}</p></details>}</div>}
  {selected==="holder_intelligence"&&historical.available&&holderView==="map"&&<div className="g11-map"><h3>Connection map & evidence inspector</h3><p className="g11-muted" style={{fontSize:12}}>Historical evidence · {historical.compatible?"Snapshot reconciled":"Historical snapshot only"} · No ownership inference</p><HolderBubbleMap key={historicalHolders.jobId||historicalHolders.mint} identityKey={(historicalHolders.jobId||historicalHolders.mint)+":"+(historicalHolders.updatedAt||"")} holders={historicalHolders.holders||[]} groups={historicalHolders.connectedGroups||[]} scanStatus={historicalHolders.scanStatus||"partial"} transactionsChecked={historicalHolders.transactionsChecked} walletHistoriesReached={historicalHolders.walletHistoriesReached} verifiedAssessment={verifiedHolderAssessment||null}/></div>}
  </div><div className="g11-inspector" aria-label="Evidence summary"><article><span className="g11-kicker">Attribute status</span><strong>{currentScore.complete?"Inputs assessed":"In progress"}</strong><small className="g11-muted">{currentScore.complete?"Calibration pending":"Unassessed criteria receive no points; this is not a complete score"}</small></article><article><span className="g11-kicker">Evidence coverage</span><strong>{fmt(currentScore.coveragePct,"%")}</strong><small className="g11-muted">Not a risk score</small></article><article><span className="g11-kicker">Methodology</span><strong>GLITCH v1.1</strong><small className="g11-muted">Backend calculation</small></article></div></div>}
  {currentScore&&<p className="g11-foot">Pending components: {currentScore.components.filter(c=>c.max>0&&c.points===null).map(c=>(c.reason||c.id).replaceAll("_"," ").toLowerCase()).join("; ")||"None; calibration acceptance still required"}</p>}
  {selected==='liquidity_quality_safety'&&(liquidityRefreshing||liquidityError)&&<p role="status">{liquidityRefreshing?'Loading provider liquidity observations…':'Liquidity provider unavailable; estimates withheld.'}</p>}
  {selected==='liquidity_quality_safety'&&<details className="g11-foot" data-testid="liquidity-evidence"><summary>Liquidity observation evidence</summary>
   <p role="status">{liquidityReason}. Final calibrated score remains Pending.</p>
   <p>Source: {typeof source?.provider==='string'?source.provider:'Unknown'}. Provider observation time: {observationTime?<time dateTime={observationTime}>{observationTime}</time>:'Unknown'}. Provider reports are not independently verified reserves.</p>
   <p>Persisted account checks: {adapted.liquidity?`${adapted.liquidity.status.replaceAll('_',' ')}; ${countText(adapted.liquidity.checkedPoolCount)} checked / ${countText(adapted.liquidity.reportedPoolCount)} reported pools; ${countText(adapted.liquidity.failedBatchCount)} failed batches`:'Unknown — missing, stale or unavailable'}. Account checks do not establish complete historical coverage. Historical withdrawal coverage: Unknown.</p>
   {adapted.lpObservation&&<p>Current LP observation: {adapted.lpObservation.holders.length} nonzero accounts; {adapted.lpObservation.observedBalanceSumEqualsSupply?'observed balances reconcile to LP mint supply':'LP supply remains unreconciled'}. Custody, locks and withdrawal control remain unverified. Observed {adapted.lpObservation.observedAt}; separate discovery and account-read slots.</p>}
   {adapted.lq09Observation&&<p>Historical fee collection at slot {adapted.lq09Observation.transactionSlot}: transfer amounts reconcile. Protocol recipient: {adapted.lq09Observation.protocolRecipientMatchesHistoricalState?'matches historical configuration':'unresolved mismatch'}. Creator recipient: {adapted.lq09Observation.creatorRecipientMatchesHistoricalState?'matches historical pool state':'differs from historical pool creator'}. Instruction authorization remains unresolved; this is not confirmed liquidity withdrawal evidence.</p>}
   <p>Reported pool records below are supporting observations, not verified custody or withdrawal evidence. Expired records are retained for provenance only.</p>
   <ul>{(Array.isArray(source?.pools)?source.pools:[]).slice(0,30).map((pool,index)=><li key={index}>{typeof pool?.pairAddress==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pool.pairAddress)?<a href={'https://solscan.io/account/'+pool.pairAddress} target="_blank" rel="noopener noreferrer">Pool {pool.pairAddress}</a>:'Pool identity Unknown'} — {pool?.evidenceConflict===true?'Conflicting observations; amount Unknown':'Provider record only; reserves and authority Unknown'}</li>)}</ul>
  </details>}
  {selected==='liquidity_quality_safety'&&adapted.reserveObservation&&<div className="g11-foot"><p>Verified pool reserves at finalized slot {adapted.reserveObservation.slot}: {fmt(Number(adapted.reserveObservation.baseReserveRaw)/10**adapted.reserveObservation.baseDecimals)} tokens and {fmt(Number(adapted.reserveObservation.quoteReserveRaw)/1e9)} SOL. Observed {adapted.reserveObservation.observedAt}.</p>{adapted.reserveObservation.limitations.map(x=><p key={x}>{x}</p>)}</div>}
  {selected==='holder_intelligence'&&adapted.canonicalHolderObservation&&<p className="g11-foot">Canonical eligible Top-20 observation: {adapted.canonicalHolderObservation.top20SharePct}% of mint supply at finalized inventory slot {adapted.canonicalHolderObservation.contextSlots.inventory}. {adapted.canonicalHolderObservation.excludedAuthorityCount} infrastructure, program or incinerator authorities excluded before ranking. Observed {adapted.canonicalHolderObservation.observedAt}; authority classifications use a separate slot. Custodian classification and historical independence remain unresolved.</p>}
  {selected==='creator_intelligence'&&adapted.creatorWalletObservation&&<p className="g11-foot">Current attributed creator wallet: raw balance {adapted.creatorWalletObservation.rawBalance} across {adapted.creatorWalletObservation.accountCount} token account(s), finalized slot {adapted.creatorWalletObservation.slot}; observed {adapted.creatorWalletObservation.observedAt}. Linked-wallet holdings and selling coverage are unassessed. The older percentage above is a historical observation.</p>}
  {selected==='creator_intelligence'&&adapted.creatorLaunchObservation&&<p className="g11-foot">Launch transaction evidence: {Number(adapted.creatorLaunchObservation.purchasedRaw)/1e6} tokens purchased by the attributed creator at slot {adapted.creatorLaunchObservation.slot}. Direct launch issuance to that wallet: {adapted.creatorLaunchObservation.zeroDirectLaunchAllocationVerified?'zero, verified separately from the purchase':'unresolved'}. Historical selling coverage remains incomplete.</p>}
  <p className="g11-foot">{selected==="creator_intelligence"?"Still needed: "+adapted.creatorMissing.join("; "):selected==="liquidity_quality_safety"?"Still needed: "+adapted.liquidityMissing.join("; "):"Final scores require complete evidence and calibration."}</p>
  <p className="g11-foot">Transfers establish observed interactions, not common ownership. Reported liquidity is not verified executable depth. Pending values are not scored as safe or unsafe.</p></details>
 {children}
 <footer className="g11-disclaimer"><p>GLITCH Scanner provides evidence-based risk assessments using available on-chain data. Scores reflect observed risks within the stated evidence coverage and do not guarantee safety or future performance. For informational purposes only; not financial advice.</p></footer>
 </section>;
}

