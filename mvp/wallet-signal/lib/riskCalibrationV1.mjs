/** DOOM404 V1 policy, not an industry standard. Severity never changes risk points. */
const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
export function concentrationSeverity(value,individual=false){
 if(!valid(value))return null;
 const bands=individual?[[20,'critical'],[10,'high'],[5,'elevated'],[0,'limited']]:[[50,'critical'],[40,'high'],[30,'elevated'],[15,'moderate'],[0,'limited']];
 return bands.find(([floor])=>value>=floor)[1];
}
export function exitSeverity(value){return !valid(value)?null:value>=20?'critical':value>=10?'high':value>=5?'elevated':value>=2?'moderate':'limited';}
export function coverageColor(value){return !valid(value)||value===0?'#92999f':value<50?'#d98287':value<80?'#efbd63':value<100?'#a5cba9':'#62ca84';}
export function riskColor(value){return !valid(value)?'#92999f':value>=60?'#ff6570':value>=30?'#efbd63':'#a5cba9';}
/** One metric and provenance selection for every report panel. */
export function canonicalQuote(q){
 if(!q)return {value:null,label:'Unavailable',basis:'unavailable',severity:null,proceeds:null};
 const terminal=q.executable===false;
 const fields=[['impactIncludingFeesPct','fee-inclusive exit estimate'],['quoteRecoveryShortfallPct','quote recovery shortfall'],['providerPriceImpactPct','provider-reported price impact']];
 const selected=terminal?null:fields.find(([field])=>valid(q[field]));
 const value=selected?q[selected[0]]:null,basis=selected?.[1]||q.failureReason||'unavailable';
 const spot=q.valuationBasis==='spot_quote_notional'||q.measurement!=='reference_quote_recovery'&&q.measurement!=='provider_reported_price_impact'&&q.referenceNotionalSol===Number(q.referenceNotional)&&typeof q.quoteOutputRaw==='string'&&typeof q.baseInputRaw==='string';
 return {value,basis,label:value===null?'Unavailable':value.toFixed(2)+'%',severity:exitSeverity(value),feeVerified:selected?.[0]==='impactIncludingFeesPct',proceeds:selected?.[0]==='impactIncludingFeesPct'&&spot?Number(q.referenceNotional)*(1-value/100):null,executionStatus:terminal?(q.failureReason||'assessed_route_execution_limitation'):value===null?'unresolved':'quoted'};
}
export function calibratedFlags({share,largest,quotes=[]}={}){
 const flags=[];
 for(const [id,value,individual] of [['high_holder_concentration',share,false],['largest_holder_concentration',largest,true]]){
  const severity=concentrationSeverity(value,individual);
  if(severity&&severity!=='limited')flags.push({id,severity,detail:individual?`Largest assessed eligible wallet holds ${value}% of observed mint supply. Classification is bounded; freely transferable control and beneficial ownership require supporting evidence.`:`Assessed eligible wallets hold at least ${value}% of observed mint supply; incomplete samples are not extrapolated.`});
 }
 for(const q of quotes){const c=canonicalQuote(q);if(['high','critical'].includes(c.severity))flags.push({id:'reference_exit_'+q.referenceNotional,severity:c.severity,detail:`${q.referenceNotional} ${q.quoteSymbol||'SOL'}-equivalent sale: ${c.value}% ${c.basis}.${c.feeVerified?' Applicable protocol fees included.':' Fee coverage unverified.'}`,quoteSize:q.referenceNotional,quoteBasis:c.basis});}
 if(concentrationSeverity(share)&&share>=30&&quotes.some(q=>canonicalQuote(q).value>=5))flags.push({id:'concentration_liquidity_interaction',severity:'high',detail:'Substantial observed holder concentration coexists with elevated quote costs. Large holder sales into the assessed liquidity could amplify price declines; coordination or an actual sale is not established.'});
 return flags;
}
