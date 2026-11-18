import {evaluateLiquidityRuntimeContract} from './liquidityAutoWorkerRuntimeContract.mjs';
import {assessOfflineEvidencePreservation} from './liquidityAutoWorkerEvidenceGate.mjs';

/** Offline-only execution contract. Caller supplies a synthetic cycle function; no RPC or artifact writes. */
export async function simulateBoundedExecution({pool,candidates,requestCount=0,activeWorkers=1,cycle,artifactName}){
 if(typeof cycle!=='function')throw Error('OFFLINE_CYCLE_REQUIRED');
 const decision=evaluateLiquidityRuntimeContract({pool,candidates,requestCount,activeWorkers});
 const predecessor=candidates.find(c=>c.runId===decision.sourceRunId);
 if(decision.action!=='DRY_RUN_ONLY')return {status:decision.action,requests:0,sourceRunId:decision.sourceRunId??null,checkpointEligible:false};
 if(!predecessor)throw Error('VALIDATED_PREDECESSOR_MISSING');
 // Keep the validated baseline independent of caller mutation across the awaited cycle.
 const sourceRunId=predecessor.runId;
 const prior=structuredClone(predecessor.state);
 const remaining=decision.requestsAllowed;
 let result;
 try{result=await cycle({maxRequests:remaining,source:structuredClone(prior)});}
 catch{return {status:'PAUSE_CYCLE_FAILURE',requests:0,sourceRunId,checkpointEligible:false};}
 if(!result||!Number.isSafeInteger(result.requests)||result.requests<0||result.requests>remaining)throw Error('CYCLE_REQUEST_ACCOUNTING_INVALID');
 const gate=assessOfflineEvidencePreservation({prior,next:result.state,artifactName});
 return {status:gate.action,requests:result.requests,sourceRunId,checkpointEligible:gate.checkpointEligible,liveExecutionEnabled:false,automaticSchedulingEnabled:false};
}
