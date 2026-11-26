import {scoreLiquidityQuality} from './glitchAttributeEnginesV11.mjs';
const fields={verifiedDepthUsd:Number.MAX_SAFE_INTEGER,verifiedMarketCapUsd:Number.MAX_SAFE_INTEGER,
 lpSecurityPoints:25,largestIndependentPoolSharePct:100,impactPct:100,stabilityPoints:10};
const flags=['lpVerified','impactVerified','stabilityVerified'];
const proofKinds={verifiedDepthUsd:['simulation'],verifiedMarketCapUsd:['onchain_account'],
 lpSecurityPoints:['onchain_account','transaction'],lpVerified:['onchain_account','transaction'],
 largestIndependentPoolSharePct:['onchain_account'],impactPct:['simulation'],impactVerified:['simulation'],
 stabilityPoints:['reserve_history'],stabilityVerified:['reserve_history']};
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
/** Versioned server evidence contract. Recompute the approved formula, never
 * promote persisted aggregate scores or infer verification from pool counts.
 * Producers remain responsible for retaining independently validated proofs. */
export function projectLiquidityScoring(e,mint){
 const s=e?.scoringEvidence;
 if(e?.schemaVersion!==2||!object(s)||s.version!==1||s.methodology!=='LIQUIDITY_QUALITY_V1_1'||
  s.mint!==mint||!date(s.observedAt)||s.observedAt!==e.observedAt||
  !/^[a-f0-9]{64}$/.test(s.evidenceId||'')||!object(s.inputs)||!object(s.coverage)||
  s.coverage.complete!==true||s.coverage.scope!=='all_reported_pools'||
  !Array.isArray(s.coverage.poolAddresses)||!s.coverage.poolAddresses.length||
  new Set(s.coverage.poolAddresses).size!==s.coverage.poolAddresses.length||
  s.coverage.poolAddresses.some(p=>typeof p!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p))||
  !Array.isArray(s.provenance)||!s.provenance.length||s.provenance.length>100||
  typeof e.verifiedDepth!=='boolean'||typeof e.lpSecurityVerified!=='boolean')
  throw Error('LIQUIDITY_SCORING_EVIDENCE_INVALID');
 const inputs={};
 for(const [key,value] of Object.entries(s.inputs)){
  if(Object.hasOwn(fields,key)){
   if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>fields[key])throw Error('LIQUIDITY_SCORING_VALUE_INVALID');
  }else if(flags.includes(key)){
   if(typeof value!=='boolean')throw Error('LIQUIDITY_SCORING_FLAG_INVALID');
  }else throw Error('LIQUIDITY_SCORING_FIELD_UNSUPPORTED');
  inputs[key]=value;
 }
 const proofFields=new Set();
 const provenance=s.provenance.map(p=>{
  if(!object(p)||!['helius','alchemy','solscan','validated_protocol_decoder'].includes(p.source)||
   !['onchain_account','transaction','simulation','reserve_history'].includes(p.kind)||
   p.mint!==mint||!date(p.observedAt)||Date.parse(p.observedAt)>Date.parse(s.observedAt)||
   !/^[a-zA-Z0-9:_-]{16,128}$/.test(p.reference||'')||
   !Array.isArray(p.fields)||!p.fields.length||p.fields.some(f=>!Object.hasOwn(s.inputs,f)||!proofKinds[f]?.includes(p.kind))||
   p.validated!==true||p.coverageComplete!==true)
   throw Error('LIQUIDITY_PROVENANCE_INVALID');
  p.fields.forEach(f=>proofFields.add(f));
  return {source:p.source,kind:p.kind,reference:p.reference,observedAt:p.observedAt,fields:[...p.fields]};
 });
 if(Object.keys(inputs).some(f=>!proofFields.has(f)))throw Error('LIQUIDITY_INPUT_PROOF_MISSING');
 if((Object.hasOwn(inputs,'verifiedDepthUsd')&&e.verifiedDepth!==true)||
  (Object.hasOwn(inputs,'lpSecurityPoints')&&inputs.lpVerified!==true)||
  (Object.hasOwn(inputs,'impactPct')&&inputs.impactVerified!==true)||
  (Object.hasOwn(inputs,'stabilityPoints')&&inputs.stabilityVerified!==true)||
  e.lpSecurityVerified!==(inputs.lpVerified===true))throw Error('LIQUIDITY_VERIFICATION_MISMATCH');
 const assessment=scoreLiquidityQuality(inputs);
 if(e.finalScore!==assessment.score||
  (e.status==='complete'&&!assessment.complete)||!['partial','complete'].includes(e.status))
  throw Error('LIQUIDITY_SCORE_MISMATCH');
 return {version:1,methodology:s.methodology,evidenceId:s.evidenceId,observedAt:s.observedAt,
  inputs,coverage:{complete:true,scope:s.coverage.scope,poolAddresses:[...s.coverage.poolAddresses]},provenance,
  assessment};
}
