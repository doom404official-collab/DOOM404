// Quota domains must remain independent: customer admission is NOT an RPC throttle.
export const QUOTA_DOMAINS=Object.freeze({
 publicAdmission:'glitch_admit_deep_scan',
 historicalWorker:'historical_rpc',
 customerWorker:'customer_rpc'
});
export function planRpcCapacity({providerRps,sharedReservePct=0.2,activeHistoricalWorkers=0,activeCustomerWorkers=0}={}){
 if(!Number.isFinite(providerRps)||providerRps<=0||!Number.isFinite(sharedReservePct)||
 sharedReservePct<0||sharedReservePct>=1||
 !Number.isInteger(activeHistoricalWorkers)||activeHistoricalWorkers<0||
 !Number.isInteger(activeCustomerWorkers)||activeCustomerWorkers<0)
 throw new TypeError('Invalid RPC capacity inputs');
 const budget=Math.max(1,Math.floor(providerRps*(1-sharedReservePct)));
 const workers=activeHistoricalWorkers+activeCustomerWorkers;
 return {budgetRps:budget,workers,perWorkerRps:workers?budget/workers:budget,
 note:'Planning only. Shared distributed RPC enforcement must be implemented before enabling parallel public scans.'};
}
