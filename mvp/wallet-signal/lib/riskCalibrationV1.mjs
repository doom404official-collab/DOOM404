/** DOOM404 V1 policy, not an industry standard. Severity never changes risk points. */
const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
export function concentrationSeverity(value,individual=false){
 if(!valid(value))return null;
 const bands=individual?[[20,'critical'],[10,'high'],[5,'elevated'],[0,'limited']]:[[50,'critical'],[40,'high'],[30,'elevated'],[15,'moderate'],[0,'limited']];
 return bands.find(([floor])=>value>=floor)[1];
}
export function exitSeverity(value){return !valid(value)?null:value>=20?'critical':value>=10?'high':value>=5?'elevated':value>=2?'moderate':'limited';}
export function coverageColor(value){return !valid(value)||value===0?'#92999f':value<50?'#d98287':value<80?'#efbd63':value<100?'#a5cba9':'#62ca84';}
export const RISK_SCORE_BANDS=Object.freeze([
 Object.freeze({min:80,severity:'critical',label:'Critical',color:'#DC2626'}),
 Object.freeze({min:60,severity:'high',label:'High',color:'#EF4444'}),
 Object.freeze({min:40,severity:'elevated',label:'Elevated',color:'#F97316'}),
 Object.freeze({min:20,severity:'moderate',label:'Moderate',color:'#EAB308'}),
 Object.freeze({min:0,severity:'low',label:'Low observed risk',color:'#35C759'})
]);
export function riskBand(value){return valid(value)?RISK_SCORE_BANDS.find(b=>value>=b.min):{severity:'unassessed',label:'Insufficient evidence',color:'#808080'};}
export function riskColor(value){return riskBand(value).color;}
/** Low scores with incomplete/materially unresolved evidence use neutral grey.
 * A verified critical finding overrides presentation only, never the numeric score. */
export function scorePresentation({score,coverage=0,unresolved=false,critical=false}={}){
 const band=riskBand(score),assessed=band.severity!=='unassessed'&&coverage>0;
 if(!assessed)return {...riskBand(null),numericBand:band.severity,critical};
 if(critical)return {...band,color:'#EF4444',label:'Critical finding present',numericBand:band.severity,critical:true};
 if(band.severity==='low'&&(coverage<100||unresolved))return {...band,color:'#808080',label:'Low observed risk',numericBand:band.severity,neutral:true};
 return {...band,numericBand:band.severity};
}
export function findingPresentation(f={}){
 if(f.unresolved)return {severity:'unresolved',label:'Unresolved evidence',color:'#808080',icon:'?',rank:6};
 if(f.category==='Unscored contextual observation')return {severity:'contextual',label:'Contextual observation',color:'#808080',icon:'ⓘ',rank:5};
 const map={critical:['Critical risk','#EF4444',0],high:['High risk','#FB633B',1],elevated:['Elevated risk','#F97316',2],moderate:['Moderate risk','#EAB308',3],low:['Low observed risk','#9CA3AF',4],limited:['Low observed risk','#9CA3AF',4]};
 const item=map[f.severity];return item?{severity:f.severity==='limited'?'low':f.severity,label:item[0],color:item[1],icon:f.severity==='low'||f.severity==='limited'?'•':'warning',rank:item[2]}:{severity:'observed',label:'Observed risk factor',color:'#9CA3AF',icon:'•',rank:4};
}
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
