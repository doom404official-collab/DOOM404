/** Bounded checkpoints must not silently erase evidence or unfinished work.
 * A blocked checkpoint needs explicit replay/restoration, never an automatic reset.
 */
export const CREATOR_RETENTION_LIMIT=5000;
const fields=['creatorVerifiedAcquisitionEvents','creatorAcquisitionMovements',
 'creatorTransferDirections','creatorProcessedSignatures','creatorPendingSignatures','verifiedLaunchDistributions'];
export function assertCreatorRetention(state,{legacy=false}={}){
 let reason=state.creatorRetentionBlocked?.reason||null;
 const originLimits={indexedOriginCandidates:50,indexedOriginChecked:1000,indexedOriginDeferred:1000,deferredSignatures:1000,originEvidence:100};
 for(const [field,limit] of Object.entries(originLimits)){
  if(state[field]!==undefined&&!Array.isArray(state[field]))reason='INVALID_CHECKPOINT_HISTORY';
  const count=state[field]?.length||0;
  if(count>limit)reason='CHECKPOINT_CAPACITY_EXCEEDED';
  else if(legacy&&state.creatorOriginRetentionVersion!==1&&count===limit)reason='LEGACY_RETENTION_INTEGRITY_UNPROVEN';
 }
 for(const field of fields){
  if(state[field]!==undefined&&!Array.isArray(state[field]))reason='INVALID_CHECKPOINT_HISTORY';
  const count=(state[field]||[]).length;
  if(count>CREATOR_RETENTION_LIMIT)reason='CHECKPOINT_CAPACITY_EXCEEDED';
  else if(legacy&&state.creatorRetentionVersion!==1&&count===CREATOR_RETENTION_LIMIT)
   reason='LEGACY_RETENTION_INTEGRITY_UNPROVEN';
 }
 if(reason){const error=new Error('CREATOR_RETENTION_BLOCKED');error.code=error.message;error.reason=reason;throw error;}
}
export function blockCreatorRetention(previous,reason){
 return {...previous,creatorRetentionBlocked:{reason,recoveryRequired:true},
  launchDistributionCoverageComplete:false,
  initialAllocationEvidence:{...(previous.initialAllocationEvidence||{}),status:'RETENTION_RECOVERY_REQUIRED',initialAttributableRaw:null,coverageComplete:false,zeroAllocationVerified:false},
  creatorHistoryComplete:false,creatorSwapVerificationComplete:false,
  creatorHistoricalCoverage:{...(previous.creatorHistoricalCoverage||{}),historyComplete:false,status:'RETENTION_RECOVERY_REQUIRED'},
  creatorAcquisitionLedger:{...(previous.creatorAcquisitionLedger||{}),status:'INCOMPLETE',historyComplete:false,scoreEligible:false,sellThroughPct:null},
  selling:{...(previous.selling||{}),creatorSellingScoreEligible:false,
   windows:(previous.selling?.windows||[]).map(window=>({...window,historyComplete:false,scoreEligible:false,sellThroughPct:null}))},
  sellingStatus:'RETENTION_RECOVERY_REQUIRED'};
}
