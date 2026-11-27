/** Versioned overall aggregation only. Attribute criteria retain their v2 semantics. */
export const RISK_METHODOLOGY_VERSION='2.1.0';
export const RISK_WEIGHTS=Object.freeze({token_security:0.15,holder_intelligence:0.30,liquidity_quality_safety:0.35,creator_intelligence:0.20});
export const LEGACY_RISK_WEIGHTS=Object.freeze(Object.fromEntries(Object.keys(RISK_WEIGHTS).map(id=>[id,0.25])));
export const roundRisk=x=>Math.round((x+Number.EPSILON)*100)/100;
export function aggregateRisk(scores,weights=RISK_WEIGHTS){
 const sum=field=>roundRisk(Object.entries(weights).reduce((n,[id,w])=>{
  const x=scores[id]?.[field];if(!Number.isFinite(x)||x<0||x>100)throw Error('INVALID_ATTRIBUTE_ASSESSMENT');return n+x*w;
 },0));
 return {riskScore:sum('riskScore'),coveragePct:sum('coveragePct')};
}
export function tokenMaturity({mint,attribution,now=Date.now()}={}){
 const t=attribution?.creationTime;
 if(attribution?.mint!==mint||attribution?.verified!==true||attribution?.verification!=='transaction_local_protocol_creator'||!attribution.creationSignature||!Number.isSafeInteger(attribution.creationSlot)||!Number.isSafeInteger(t)||t<=0||t*1000>now)return {label:'Maturity not established',basis:null};
 const ageSeconds=(now-t*1000)/1000;
 // Half-open intervals; exactly 90 days remains established per owner table.
 const label=ageSeconds<3600?'Extremely early stage':ageSeconds<86400?'Newly launched':ageSeconds<7*86400?'Early stage':ageSeconds<30*86400?'Developing':ageSeconds<=90*86400?'Established trading history':'Longer trading history';
 return {label,ageSeconds,basis:'Verified mint creation; trading start not established',createdAt:new Date(t*1000).toISOString(),slot:attribution.creationSlot,signature:attribution.creationSignature};
}
