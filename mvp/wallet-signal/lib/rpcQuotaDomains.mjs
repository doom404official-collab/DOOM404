// Distinct quota domains. Admission is never used to throttle pagination or worker RPC calls.
export const QUOTA_DOMAINS=Object.freeze({
 publicAdmission:'glitch_admit_deep_scan',
 historicalWorker:'historical_rpc',
 customerWorker:'customer_rpc'
});
export function planRpcCapacity({providerRps,sharedReservePct=0.2,activeHistoricalWorkers=0,activeCustomerWorkers=0}={}){
 if(!Number.isFinite(providerRps)||providerRps<=0||sharedReservePct<0||sharedReservePct>=1||
  !Number.isInteger(activeHistoricalWorkers)||activeHistoricalWorkers<0||
  !Number.isInteger(activeCustomerWorkers)||activeCustomerWorkers<0)
  throw new TypeError('Invalid RPC capacity inputs');
 const budget=Math.max(1,Math.floor(providerRps*(1-sharedReservePct)));
 const workers=activeHistoricalWorkers+activeCustomerWorkers;
 return {budgetRps:budget,workers,perWorkerRps:workers?budget/workers:budget,
  note:'Planning only: actual cross-process enforcement requires shared distributed RPC admission'};
}
