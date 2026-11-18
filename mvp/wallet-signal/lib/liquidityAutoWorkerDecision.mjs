import {assessAutomaticHistoryCheckpoint} from './liquidityAutomaticHistoryGate.mjs';
export const LQ08_BASELINE_RUN=39729408869;
export const LQ08_REQUEST_BUDGET=60;
export function planLiquidityHistoryCycle({runId,state,pool}){
 if(!Number.isSafeInteger(runId)||runId<LQ08_BASELINE_RUN)throw Error('LQ08_BASELINE_NOT_VERIFIED');
 if(state?.historyCoverageVerified===true&&state?.complete!==true)throw Error('INCONSISTENT_COVERAGE_CLAIM');
 const gate=assessAutomaticHistoryCheckpoint(state,pool);
 if(state.pendingSignatures?.length) return {action:'PAUSE_UNRESOLVED',requests:0};
 if(gate.action==='STOP_HISTORY_EXHAUSTED')return {action:'STOP_COMPLETE',requests:0};
 if(gate.action!=='CONTINUE_BOUNDED')return {action:'PAUSE_MANUAL_REVIEW',requests:0};
 if(state.historyCoverageVerified!==false||state.finalScore!==null||state.authorizationVerified!==false||state.withdrawalVerified!==false)throw Error('UNSAFE_LQ08_STATE');
 return {action:'READY_FOR_SEPARATELY_AUTHORIZED_RUN',requests:LQ08_REQUEST_BUDGET,sourceRunId:runId};
}
