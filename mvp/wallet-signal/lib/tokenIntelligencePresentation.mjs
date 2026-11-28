import {formatMetric} from './evidenceHudPresentation.mjs';
import {RISK_WEIGHTS} from './riskMethodology.mjs';
export const attributeNames={token_security:'Token Security',holder_intelligence:'Holder Intelligence',liquidity_quality_safety:'Liquidity & Safety',creator_intelligence:'Creator Intelligence'};
export function riskContributions(scores){const rows=Object.entries(RISK_WEIGHTS).map(([id,weight])=>({id,name:attributeNames[id],weighted:(Number.isFinite(scores[id]?.riskScore)?scores[id].riskScore:0)*weight}));const total=rows.reduce((n,r)=>n+r.weighted,0);return rows.map(r=>({...r,percentage:total>0?r.weighted/total*100:0})).sort((a,b)=>b.weighted-a.weighted);}
export function tokenInsights(assessment){const s=assessment.scores,h=s.holder_intelligence.metrics,l=s.liquidity_quality_safety.metrics,c=s.creator_intelligence.metrics,rows=[];const add=(name,value,detail)=>{if(Number.isFinite(value))rows.push({name,detail:detail(value)});};
for(const f of assessment.flags.filter(f=>f.severity==='critical'||f.id==='creator_disposition_unresolved'))rows.push({name:f.severity==='critical'?'Critical finding':'Creator disposition unresolved',detail:f.detail});
const q=l.quotes?.find(q=>q.referenceNotional===100);if(q?.executable!==false)add('Trading exit cost',q?.impactIncludingFeesPct,v=>`A 100 ${q.quoteSymbol}-equivalent sale costs an estimated ${formatMetric(v,'%')}, including applicable protocol fees.`);
add('Holder concentration',h.top20Pct,v=>`${Number.isSafeInteger(h.eligibleObservedWallets)?h.eligibleObservedWallets:'Top-20'} assessed eligible wallets hold ${formatMetric(v,'%')} of supply.`);
add('Largest holder exposure',h.largestPct,v=>`The largest assessed eligible holder holds ${formatMetric(v,'%')} of supply.`);
add('Liquidity backing',l.liquidityToFullyDilutedValuePct,v=>`Assessed liquidity is ${formatMetric(v,'%')} of fully diluted value.`);
add('Creator holdings',c.currentWalletSharePct,v=>`The attributed creator directly holds ${formatMetric(v,'%')} of supply.`);
return rows.slice(0,3);}
