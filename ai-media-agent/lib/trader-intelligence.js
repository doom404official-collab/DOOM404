"use strict";
// V14 evidence-only aggregation. No RPC calls; never infer beneficial ownership.
const validPct=v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100;
function aggregate({mint,holders,relationships,context,creator,credibility,sceneCandidates=[]}={}){
 if(typeof mint!=="string"||!mint)throw Error("MINT_REQUIRED");
 for(const x of [holders,relationships,context,creator,credibility])if(x&&x.mint!==mint)throw Error("MINT_MISMATCH");
 const findings=[],gaps=[];
 const add=(id,priority,observation,implication,evidence)=>findings.push({id,priority,observation,implication,evidence});
 const p=holders?.top20TokenAccountSharePercent;
 if(validPct(p))add("account-concentration",p>=50?90:p>=25?60:30,"Top 20 token accounts hold "+p+"% of supply.","Account concentration is not beneficial ownership; investigate pool inventory and linked owners.",{source:"owners",observedAt:holders.observedAt,slot:holders.largestAccountsSlot});
 else gaps.push("Account concentration unavailable");
 const rows=Array.isArray(holders?.accounts)?holders.accounts:[];
 const groups=new Map();
 for(const a of rows){if(!a.ownerVerified||!a.tokenOwner||!validPct(a.sharePercent)||["PUMP_FUN_BONDING_CURVE_INFRASTRUCTURE","VERIFIED_PUMPSWAP_POOL_VAULT","VERIFIED_RAYDIUM_POOL_VAULT","VERIFIED_ORCA_POOL_VAULT"].includes(a.classification))continue;groups.set(a.tokenOwner,(groups.get(a.tokenOwner)||0)+a.sharePercent)}
 const ranked=[...groups].map(([owner,share])=>({owner,share})).sort((a,b)=>b.share-a.share);
 const nonExcluded=holders?.nonExcludedTop20SharePercent;
 if(validPct(nonExcluded))add("non-excluded-concentration",nonExcluded>=50?92:nonExcluded>=25?62:32,"Non-excluded sampled accounts hold "+nonExcluded+"% of supply.","Verified pool and bonding inventory is separated; remaining accounts are not proven independent.",{source:"owners",slot:holders.largestAccountsSlot,raw:holders.reconciliation});
 if(validPct(holders?.classifiedInfrastructureSharePercent)&&holders.classifiedInfrastructureSharePercent>0)add("verified-infrastructure",65,"Verified infrastructure holds "+holders.classifiedInfrastructureSharePercent+"% of supply in the sample.","Pool inventory is not a discretionary wallet holding; this classification does not establish withdrawal safety.",{source:"owners",accounts:rows.filter(a=>a.classificationEvidence).map(a=>a.classificationEvidence)});
 const security=context?.security;
 if(security&&Object.hasOwn(security,"mintAuthority")&&Object.hasOwn(security,"freezeAuthority")){
 const active=[["mint",security.mintAuthority],["freeze",security.freezeAuthority]].filter(([,v])=>typeof v==="string"&&v.length).map(([k])=>k);
 if(active.length)add("active-authorities",100,"Active "+active.join(" and ")+" authority observed.","Check who controls these permissions before trading.",{source:"token-context",slot:security.slot});
 else if(security.mintAuthority===null&&security.freezeAuthority===null)add("disabled-authorities",20,"Mint and freeze authorities are disabled.","These settings reduce two standard token risks but do not establish overall safety.",{source:"token-context",slot:security.slot});
 else gaps.push("Authority values unresolved");
 }else gaps.push("Token authority evidence unavailable");
 const market=context?.market;
 if(typeof market?.liquidityUsd==="number"&&Number.isFinite(market.liquidityUsd)&&market.liquidityUsd>=0)add("reported-liquidity",market.liquidityUsd<10000?80:40,"Selected pair reports $"+market.liquidityUsd+" liquidity.","Reported liquidity is not executable sell depth or proof of withdrawal safety.",{source:"DexScreener",pairAddress:market.pairAddress,observedAt:context.observedAt});
 gaps.push("Executable exit depth and withdrawal authorization not established");
 const roundTrips=relationships?.manipulationIndicators?.roundTrips;
 if(relationships?.scope?.transactionsRetrieved>0&&Array.isArray(roundTrips)&&roundTrips.length)add("round-trips",75,roundTrips.length+" matched transaction-net round-trip indicators in the sample.","Investigate economic purpose; this is not proof of wash trading.",{source:"relationships",scope:relationships.scope.transactionsRetrieved});
 else gaps.push("Manipulation not established by available sample");
 if(!creator?.creator)gaps.push("Creator identity and reputation unresolved");
 if(credibility?.utilityAttribution?.status==="TOKEN_TRANSFER_CAPABILITY_OBSERVED")gaps.push("Token transfers observed; project-specific utility not established");
 gaps.push("Beneficial ownership and holder independence not established");
 const references=[];
 const visit=x=>{if(!x||typeof x!=="object")return;if(x.signature&&Number.isInteger(x.slot))references.push({signature:x.signature,slot:x.slot,url:"https://solscan.io/tx/"+x.signature});for(const v of Object.values(x))if(v&&typeof v==="object")Array.isArray(v)?v.forEach(visit):visit(v)};
 visit(relationships);visit(creator);
 for(const a of rows)if(a.classificationEvidence)references.push({...a.classificationEvidence,url:"https://solscan.io/account/"+a.tokenAccount});
 // Existing editorial observations already carry protocol and transaction filtering.
 // Reuse these observations without repeating RPC work or changing scene rendering.
 for(const scene of sceneCandidates){if(!scene||!Number.isFinite(scene.priority)||typeof scene.caption!=="string")continue;add("editorial-"+scene.label,scene.priority,scene.caption,"Review the linked evidence and bounded sample before acting.",{source:scene.source||"existing universal evidence",references});}
 const sorted=findings.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
 const rankedScenes=sceneCandidates.slice().sort((a,b)=>b.priority-a.priority);
 return {mint,version:"V14_EVIDENCE_AGGREGATOR_2",findings:sorted,topInsights:rankedScenes.length?rankedScenes.slice(0,3).map(s=>sorted.find(f=>f.id==="editorial-"+s.label)):sorted.slice(0,3),rankedScenes,holderGroups:ranked,holderGroupScope:"Resolved non-excluded token accounts within sampled Top 20; not economic ownership",references:[...new Map(references.map(r=>[(r.signature||r.tokenAccount)+":"+(r.slot||r.verifiedSlot),r])).values()],coverage:{security:!!security,holders:!!holders,relationships:!!relationships,liquidity:!!market,creator:!!creator,credibility:!!credibility,historicalFunding:!!relationships?.sharedFundingObservations?.length},prioritization:{type:"EDITORIAL_HEURISTIC",validatedRiskScore:false,thresholds:{concentrationPercent:[25,50],reportedLiquidityUsd:10000},limitation:"Review thresholds prioritize evidence; they are not calibrated probabilities or scientifically validated risk scores."},gaps:[...new Set(gaps)]};
}
if(typeof module!=="undefined"&&module.exports)module.exports={aggregate};
else window.doom404TraderIntelligence={aggregate};
