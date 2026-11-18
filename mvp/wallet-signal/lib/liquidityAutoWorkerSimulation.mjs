import {planOfflineLiquidityAutomation} from './liquidityAutoWorkerOrchestrator.mjs';
import {assessOfflineEvidencePreservation} from './liquidityAutoWorkerEvidenceGate.mjs';
export function simulateLiquidityHistoryCycles({pool,baseline,successors=[],maxCycles=10}){
 if(!baseline||!Number.isSafeInteger(baseline.runId)||!Number.isSafeInteger(maxCycles)||maxCycles<1||maxCycles>10)throw Error('INVALID_SIMULATION_BOUNDS');
 if(!Array.isArray(successors)||successors.length>maxCycles)throw Error('INVALID_SIMULATION_SUCCESSORS');
 const evidence=[baseline],steps=[];
 for(let i=0;i<=successors.length;i++){
  const decision=planOfflineLiquidityAutomation({pool,candidates:evidence,maxCycles:1});
  if(decision.action!=='READY_FOR_SEPARATELY_AUTHORIZED_RUN'){steps.push({cycle:i,action:decision.action,requests:0});return {steps,finalRunId:evidence.at(-1).runId,liveExecutionEnabled:false};}
  if(i===successors.length){steps.push({cycle:i,action:'WAIT_FOR_AUTHORIZATION',requests:0});break;}
  const next=successors[i];
  if(!Number.isSafeInteger(next?.runId)||next.runId<=evidence.at(-1).runId)throw Error('NON_MONOTONIC_SUCCESSOR');
  const gate=assessOfflineEvidencePreservation({prior:evidence.at(-1).state,next:next.state,artifactName:next.artifactName});
  if(!gate.checkpointEligible){steps.push({cycle:i,action:'PAUSE_PARTIAL_EVIDENCE',requests:0});break;}
  evidence.push({runId:next.runId,state:next.state});
  steps.push({cycle:i,action:'VALIDATED_OFFLINE_SUCCESSOR',requests:0});
 }
 return {steps,finalRunId:evidence.at(-1).runId,liveExecutionEnabled:false};
}
