import {scoreHolderIntelligence} from './glitchAttributeEnginesV11.mjs';
import {readFrozenHolderSnapshot} from './frozenHolderSnapshot.mjs';
// Owner-approved view only; not a snapshot migration, scoring calibration or release.
export const HOLDER_RETAIN19_POLICY=Object.freeze({
 id:'HOLDER_FROZEN_RETAIN19_V1',
 snapshotId:'1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153',
 mint:'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',slot:457305617,
 infrastructurePool:'6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA',
 approvalReference:'Sentinel_066b8879683c8191b27bf71130e93a9e',approvedAt:'2026-10-27T10:16:40Z'
});
const incinerator='1nc1nerator11111111111111111111111111111111';
/** Pure approved eligibility projection. Never edits historical inputs or computes a score. */
export function buildApprovedHolderEligibleView(snapshot){
 const {snapshotIdentity}=readFrozenHolderSnapshot(snapshot),policy=HOLDER_RETAIN19_POLICY;
 if(snapshot.id!==policy.snapshotId||snapshot.mint!==policy.mint||snapshot.slot!==policy.slot||
  snapshot.holder_ranking[0].wallet!==policy.infrastructurePool||snapshot.excluded_wallets.length!==1||snapshot.excluded_wallets[0]!==incinerator)
  throw Error('RETAIN19_POLICY_SCOPE_MISMATCH');
 const exclusions=[incinerator,policy.infrastructurePool];
 const eligibleRanking=snapshot.holder_ranking.filter(h=>!exclusions.includes(h.wallet));
 if(eligibleRanking.length!==19)throw Error('RETAIN19_ELIGIBLE_COUNT_MISMATCH');
 return {policy:{...policy},scope:'19 eligible holders within the original frozen top-20 ranking',
  snapshotId:snapshot.id,snapshotIdentity,frozenRanking:structuredClone(snapshot.holder_ranking),
  eligibleRanking:structuredClone(eligibleRanking),frozenHolderCount:20,eligibleHolderCount:19,
  originalExcludedWallets:[...snapshot.excluded_wallets],eligibleExcludedWallets:exclusions,
  supplyRaw:snapshot.supply_raw,replacementApplied:false,supplyRescaled:false,
  snapshotModified:false,checkpointModified:false,scorePromoted:false,finalScore:null,
  historyComplete:false,calibrated:false,historicalStateVerified:false,snapshotProvenanceVerified:false,
  note:'Owner approval establishes eligibility policy only. Historical evidence, calibration and score promotion remain separate gates.'};
}

export const HOLDER_ELIGIBLE_CONCENTRATION_POLICY=Object.freeze({
 id:'HOLDER_ELIGIBLE_CONCENTRATION_V1',label:'Eligible-holder concentration',
 approvalReference:'Sentinel_77826a37be548191a0dd3d299d208769',approvedAt:'2026-10-27T10:25:56Z'
});
/** Scoped observed component only; original frozen top-20 measurement is retained separately. */
export function assessApprovedHolderEligibleConcentration(snapshot){
 const view=buildApprovedHolderEligibleView(snapshot),supply=BigInt(view.supplyRaw);
 const measure=ranking=>{const raw=ranking.reduce((sum,h)=>sum+BigInt(h.balance),0n);return {holderCount:ranking.length,numeratorRaw:String(raw),supplyRaw:view.supplyRaw,sharePct:Number(raw*1000000n/supply)/10000};};
 const originalTop20={label:'Original frozen top-20 concentration',...measure(view.frozenRanking)};
 const eligible={label:HOLDER_ELIGIBLE_CONCENTRATION_POLICY.label,...measure(view.eligibleRanking)};
 const points=scoreHolderIntelligence({top20SharePct:eligible.sharePct}).components[0].points;
 return {policy:{...HOLDER_ELIGIBLE_CONCENTRATION_POLICY},eligibilityPolicy:view.policy.id,snapshotId:view.snapshotId,snapshotIdentity:view.snapshotIdentity,
  originalTop20,eligible,component:{id:'eligible_holder_concentration',label:eligible.label,max:35,points,status:'observed_only'},
  score:null,finalScore:null,calibrated:false,historyComplete:false,scorePromoted:false,snapshotModified:false,checkpointModified:false,
  replacementApplied:false,supplyRescaled:false};
}
