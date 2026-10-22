import {planOfflineLiquidityAutomation} from './liquidityAutoWorkerOrchestrator.mjs';
import {assessLiquidityCycleBudget} from './liquidityAutoWorkerBudget.mjs';
export function evaluateLiquidityRuntimeContract({pool,candidates,requestCount=0,activeWorkers=1}){
 const budget=assessLiquidityCycleBudget({requestCount,activeWorkers,cycleCount:1,limit:60});
 const decision=planOfflineLiquidityAutomation({pool,candidates,maxCycles:1});
 if(budget.action==='STOP_REQUEST_BUDGET')return {action:'STOP_REQUEST_BUDGET',requestsAllowed:0,sourceRunId:decision.sourceRunId??null};
 if(decision.action!=='READY_FOR_SEPARATELY_AUTHORIZED_RUN')return {action:decision.action,requestsAllowed:0,sourceRunId:decision.sourceRunId??null};
 return {action:'DRY_RUN_ONLY',requestsAllowed:Math.min(decision.requests,budget.requestsRemaining),sourceRunId:decision.sourceRunId,liveExecutionEnabled:false,checkpointPromotionEnabled:false};
}
