import {planLiquidityHistoryCycle} from './liquidityAutoWorkerDecision.mjs';
import {selectLiquidityContinuationCheckpoint} from './liquidityAutomaticCheckpointSelector.mjs';
export function planOfflineLiquidityAutomation({candidates,pool,maxCycles=1}){
 if(!Array.isArray(candidates)||!candidates.length)throw Error('NO_AUTOMATION_CHECKPOINTS');
 if(!Number.isSafeInteger(maxCycles)||maxCycles!==1)throw Error('AUTOMATION_CYCLE_BOUND_REQUIRED');
 const latest=selectLiquidityContinuationCheckpoint(candidates,pool);
 if(latest.runId<39729408869)throw Error('UNTRUSTED_AUTOMATION_BASELINE');
 const plan=planLiquidityHistoryCycle({runId:latest.runId,state:latest.state,pool});
 return {...plan,concurrencyGroup:'glitch-liquidity-history-worker',maxCycles:1,liveExecutionEnabled:false,schedulingEnabled:false,checkpointPromotionEnabled:false};
}
