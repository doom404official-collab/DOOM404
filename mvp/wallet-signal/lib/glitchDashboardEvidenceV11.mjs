import {mintAuthorityEvidence} from './mintAuthorityEvidence.mjs';
import {scoreTokenSecurity,scoreHolderIntelligence,scoreCreatorIntelligence,scoreLiquidityQuality} from './glitchAttributeEnginesV11.mjs';
import {resolveEpochFee,consistentEpochContext} from './tokenTransferFeeEvidence.mjs';
import {attributes} from './glitchScoringV11.mjs';
import {reconcileHolderSnapshot} from './reconcileHolderSnapshot.mjs';
const finite=(v,max=100)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
// Match the existing token-insights stale/undated presentation boundary. This is
// only an evidence display guard, not a changed scoring threshold.
export function evidenceFresh(updatedAt,now=Date.now()){
 const at=typeof updatedAt==='string'?Date.parse(updatedAt):NaN;
 return Number.isFinite(at)&&at<=now&&now-at<=60*60*1000;
}
export function adaptDashboardEvidence({liquidity:reportedLiquidity,result,extensions,concentration,creatorEvidence,historicalHolders,verifiedHolderEnvelope,workerEvidence,now=Date.now()}={}){
 const mint=result?.mint;
 const same=x=>Boolean(mint&&x?.mint===mint);
 const authorities=mintAuthorityEvidence(result,{parsed:!!mint&&result.authorityDetailsStatus!=='not_parsed'});
 const parsed=authorities.authorityDetailsStatus==='available';
 const ext=['token-2022','spl-token-2022'].includes(result?.tokenProgram)&&same(extensions)&&extensions?.verified===true&&evidenceFresh(extensions.observedAt,now)?extensions:null,fee=ext?.transferFee;
 const context=ext?.epochContext;
 const epochVerified=context?.commitment==='confirmed'&&consistentEpochContext({epoch:context.epoch,absoluteSlot:context.beforeSlot},{epoch:context.epoch,absoluteSlot:context.afterSlot},context.accountSlot);
 const effectiveFee=fee?.status==='observed'&&epochVerified?resolveEpochFee({...fee,epoch:context.epoch}):null;
 const security=scoreTokenSecurity({tokenProgram:result?.tokenProgram,authoritiesParsed:parsed,mintAuthority:authorities.mintAuthority,freezeAuthority:authorities.freezeAuthority,
  feeExtensionVerified:ext?.verified===true,feeApplicable:fee?.status==='observed'?true:fee?.status==='not_observed'?false:undefined,
  // Resolved schedule is evidence, not verified transfer behavior or a cap-adjusted score.
  feeConfigAuthorityReported:ext?.verified===true&&fee?.configAuthorityReported===true,feeConfigAuthority:fee?.configAuthority});
 const top20=same(concentration)&&finite(concentration.top20TokenAccountSharePct)?concentration.top20TokenAccountSharePct:undefined;
 let holder=scoreHolderIntelligence({top20SharePct:top20});
 const matchedHolder=same(historicalHolders)&&same(verifiedHolderEnvelope)&&
  !!historicalHolders.jobId&&historicalHolders.jobId===verifiedHolderEnvelope.jobId&&
  historicalHolders.updatedAt===verifiedHolderEnvelope.updatedAt&&
  evidenceFresh(verifiedHolderEnvelope.updatedAt,now)&&
  reconcileHolderSnapshot(concentration?.accounts,historicalHolders.holders).compatible&&
  concentration.accounts.every(live=>historicalHolders.holders.some(saved=>saved.tokenAccount===live.tokenAccount&&saved.ownerWallet===live.ownerWallet&&saved.sharePct===live.sharePct));
 const assessment=matchedHolder?verifiedHolderEnvelope.assessment:null;
 // Consume the real v1.1 backend assessment, not graph counts or legacy scores.
 const expected=attributes.find(a=>a.id==='holder_intelligence').components;
 if(assessment?.version==='1.1'&&assessment.attribute==='holder_intelligence'&&Array.isArray(assessment.components)&&
  assessment.components.length===Object.keys(expected).length&&Object.entries(expected).every(([id,max])=>assessment.components.filter(c=>c.id===id&&c.max===max&&(c.points===null||finite(c.points,max))).length===1)){
  const components=holder.components.map(c=>c.id==='top20_holder_concentration'?c:assessment.components.find(p=>p.id===c.id));
  holder={...holder,components,score:null,complete:components.every(c=>c.points!==null),calibrated:false,
   coveragePct:components.reduce((n,c)=>n+(c.points!==null?c.max:0),0)};
 }
 const creatorVerified=same(creatorEvidence)&&creatorEvidence.status==='VERIFIED'&&creatorEvidence.independentlyReviewed===true&&!!creatorEvidence.creator;
 const bridge=workerEvidence?.version==='1.1'&&same(workerEvidence)?workerEvidence:null;
 const creator=bridge?.creator,liquidity=bridge?.liquidity;
 const creatorCompatible=creatorVerified&&same(creator)&&creator.creator===creatorEvidence.creator&&evidenceFresh(creator.updatedAt,now);
 const selling=creatorCompatible&&creator.selling?.historyComplete===true&&Array.isArray(creator.selling.percentages)&&creator.selling.percentages.length===3&&creator.selling.percentages.every(x=>finite(x))?creator.selling.percentages:null;
 const creatorScore=scoreCreatorIntelligence({creatorVerified,creatorHistoryComplete:!!selling,soldPct1h:selling?.[0],soldPct24h:selling?.[1],soldPct7d:selling?.[2]});
 const providerLiquidity=same(reportedLiquidity)&&evidenceFresh(reportedLiquidity.observedAt,now)&&['pools_reported','no_pools_reported'].includes(reportedLiquidity.status)?reportedLiquidity:null;
 const reported={amount:finite(providerLiquidity?.reportedLiquidityUsd,Number.MAX_SAFE_INTEGER)?providerLiquidity.reportedLiquidityUsd:null,poolCount:Number.isSafeInteger(providerLiquidity?.poolCountReturned)&&providerLiquidity.poolCountReturned>=0?providerLiquidity.poolCountReturned:null};
 const freshLiquidity=same(liquidity)&&evidenceFresh(liquidity.updatedAt,now)&&['partial','account_checks_completed'].includes(liquidity.status)?liquidity:null;
 const liquidityScore=scoreLiquidityQuality({}); // Stage-1 producer explicitly has no verified scoring inputs.
 return {scores:{token_security:security,holder_intelligence:holder,creator_intelligence:creatorScore,liquidity_quality_safety:liquidityScore},
  fee, effectiveFee, top20,creatorVerified,matchedHolder,creator:creatorVerified&&same(creator)&&creator.creator===creatorEvidence.creator?creator:null,liquidity:freshLiquidity,
  reportedLiquidity:reported,creatorCompatible,creatorMissing:creator?.missing||['Persisted creator evidence unavailable'],liquidityMissing:freshLiquidity?.missing||['Persisted liquidity evidence unavailable or stale']};
}
