"use strict";
// V14 evidence-only aggregation. No RPC calls; never infer beneficial ownership.
const validPct=v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100;
function aggregate({mint,holders,relationships,context,creator,credibility}={}){
 if(typeof mint!=="string"||!mint)throw Error("MINT_REQUIRED");
 for(const x of [holders,relationships,context,creator,credibility])if(x&&x.mint!==mint)throw Error("MINT_MISMATCH");
 const findings=[],gaps=[];
 const add=(id,priority,observation,implication,evidence)=>findings.push({id,priority,observation,implication,evidence});
 const p=holders?.top20TokenAccountSharePercent;
 if(validPct(p))add("account-concentration",p>=50?90:p>=25?60:30,"Top 20 token accounts hold "+p+"% of supply.","Account concentration is not beneficial ownership; investigate pool inventory and linked owners.",{source:"owners",observedAt:holders.observedAt,slot:holders.largestAccountsSlot});
 else gaps.push("Account concentration unavailable");
 const rows=Array.isArray(holders?.accounts)?holders.accounts:[];
 const groups=new Map();
 for(const a of rows){if(!a.ownerVerified||!a.tokenOwner||!validPct(a.sharePercent)||a.classification==="PUMP_FUN_BONDING_CURVE_INFRASTRUCTURE")continue;groups.set(a.tokenOwner,(groups.get(a.tokenOwner)||0)+a.sharePercent)}
 const ranked=[...groups].map(([owner,share])=>({owner,share})).sort((a,b)=>b.share-a.share);
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
 return {mint,version:"V14_EVIDENCE_AGGREGATOR_1",findings:findings.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)),topInsights:findings.slice(0,3),holderGroups:ranked,holderGroupScope:"Resolved non-excluded token accounts within sampled Top 20; not economic ownership",gaps};
}
module.exports={aggregate};
