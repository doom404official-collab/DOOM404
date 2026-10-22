import {attributes,version} from "./glitchScoringV11.mjs";
const round=n=>Math.round(n*100)/100;
const valid=(n,max=100)=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=max;
const linear=(x,full,zero,max)=>round(max*Math.max(0,Math.min(1,(x-zero)/(full-zero))));
const component=(id,max,points,reason)=>({id,max,points:max===0?null:valid(points,max)?round(points):null,...(reason?{reason}:{})});
function result(id,parts,{calibrated=false}={}){
 const eligible=parts.filter(p=>p.max>0);
 const complete=eligible.length>0&&eligible.every(p=>p.points!==null);
 const assessed=eligible.reduce((s,p)=>s+(p.points!==null?p.max:0),0);
 const maximum=eligible.reduce((s,p)=>s+p.max,0);
 return {version,attribute:id,components:parts,score:complete?round(eligible.reduce((s,p)=>s+p.points,0)*100/maximum):null,complete,calibrated,coveragePct:maximum?round(assessed*100/maximum):0};
}
export function scoreTokenSecurity({tokenProgram,authoritiesParsed=false,mintAuthority,freezeAuthority,feeExtensionVerified=false,feeApplicable,feePercent,feeConfigAuthorityReported=false,feeConfigAuthority}={}){
 const feeNA=tokenProgram==="spl-token"||(feeExtensionVerified&&feeApplicable===false);
 const schedule=feeNA?null:valid(feePercent)?feePercent===0?25:feePercent<=1?20:feePercent<=3?12:feePercent<=5?5:0:null;
 const parts=[
  component("transfer_fee_schedule",feeNA?0:25,schedule,feeNA?"not_applicable":undefined),
  component("fee_configuration_authority",feeNA?0:25,feeNA?null:feeConfigAuthorityReported?(feeConfigAuthority?0:25):null,feeNA?"not_applicable":undefined),
  component("mint_authority",25,authoritiesParsed&&mintAuthority!==undefined?(mintAuthority?0:25):null),
  component("freeze_authority",25,authoritiesParsed&&freezeAuthority!==undefined?(freezeAuthority?0:25):null)
 ];
 return result("token_security",parts);
}
export function scoreHolderIntelligence({top20SharePct,networkScore,creatorTeamExposurePct,independencePoints,historyComplete=false,classificationComplete=false,creatorAttributionComplete=false}={}){
 return result("holder_intelligence",[
  component("top20_holder_concentration",35,valid(top20SharePct)?linear(top20SharePct,15,65,35):null),
  component("connected_wallet_network",35,historyComplete&&valid(networkScore,35)?networkScore:null),
  component("creator_team_exposure",20,creatorAttributionComplete&&valid(creatorTeamExposurePct)?linear(creatorTeamExposurePct,1,20,20):null),
  component("holder_breadth_independence",10,historyComplete&&classificationComplete&&valid(independencePoints,10)?independencePoints:null)
 ]);
}
export function scoreCreatorIntelligence({creatorVerified=false,holdingsPct,creatorHistoryComplete=false,soldPct1h,soldPct24h,soldPct7d,previousLaunchPoints,previousLaunchHistoryComplete=false}={}){
 const sale=(x)=>valid(x)?linear(x,0,50,10):null;
 const sells=creatorHistoryComplete===true?[sale(soldPct1h),sale(soldPct24h),sale(soldPct7d)]:[null,null,null];
 return result("creator_intelligence",[
  component("creator_identification",20,creatorVerified===true?20:null),
  component("creator_holdings",20,creatorVerified===true&&valid(holdingsPct)?linear(holdingsPct,2,20,20):null),
  component("creator_selling",30,sells.every(x=>x!==null)?round(sells.reduce((s,x)=>s+x,0)):null),
  component("previous_launches",30,previousLaunchHistoryComplete===true&&valid(previousLaunchPoints,30)?previousLaunchPoints:null)
 ]);
}
export function scoreLiquidityQuality({verifiedDepthUsd,verifiedMarketCapUsd,lpSecurityPoints,lpVerified=false,largestIndependentPoolSharePct,impactPct,impactVerified=false,stabilityPoints,stabilityVerified=false}={}){
 const ratio=valid(verifiedDepthUsd,Number.MAX_SAFE_INTEGER)&&valid(verifiedMarketCapUsd,Number.MAX_SAFE_INTEGER)&&verifiedMarketCapUsd>0?100*verifiedDepthUsd/verifiedMarketCapUsd:null;
 return result("liquidity_quality_safety",[
  component("available_liquidity",25,valid(verifiedDepthUsd,Number.MAX_SAFE_INTEGER)?linear(verifiedDepthUsd,250000,10000,25):null),
  component("liquidity_market_cap_ratio",20,valid(ratio,Number.MAX_SAFE_INTEGER)?linear(ratio,20,2,20):null),
  component("lp_security",25,lpVerified&&valid(lpSecurityPoints,25)?lpSecurityPoints:null),
  component("liquidity_concentration",10,valid(largestIndependentPoolSharePct)?linear(largestIndependentPoolSharePct,40,100,10):null),
  component("trading_impact",10,impactVerified&&valid(impactPct)?linear(impactPct,1,15,10):null),
  component("liquidity_stability",10,stabilityVerified&&valid(stabilityPoints,10)?stabilityPoints:null)
 ]);
}
export const scoringComponents=attributes.map(a=>({id:a.id,weights:a.components}));
