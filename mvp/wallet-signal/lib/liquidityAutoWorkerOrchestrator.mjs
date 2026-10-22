import {planLiquidityHistoryCycle} from './liquidityAutoWorkerDecision.mjs';
export function planOfflineLiquidityAutomation({candidates,pool,maxCycles=1}){
 if(!Array.isArray(candidates)||!candidates.length)throw Error('NO_AUTOMATION_CHECKPOINTS');
 if(!Number.isSafeInteger(maxCycles)||maxCycles!==1)throw Error('AUTOMATION_CYCLE_BOUND_REQUIRED');
 const sorted=[...candidates].sort((a,b)=>b.runId-a.runId);
 if(sorted.some(x=>!Number.isSafeInteger(x.runId)||!x.state))throw Error('INVALID_AUTOMATION_SOURCE');
 const latest=sorted[0];
 if(latest.runId!==39729408869 && latest.runId<39729408869)throw Error('UNTRUSTED_AUTOMATION_BASELINE');
 const plan=planLiquidityHistoryCycle({runId:latest.runId,state:latest.state,pool});
 return {...plan,concurrencyGroup:'glitch-liquidity-history-worker',maxCycles:1,liveExecutionEnabled:false,schedulingEnabled:false,checkpointPromotionEnabled:false};
}
