export function assessLiquidityCycleBudget({requestCount,limit=60,activeWorkers=1,cycleCount=1}){
 if(!Number.isSafeInteger(limit)||limit!==60)throw Error('LQ08_FIXED_BUDGET_REQUIRED');
 if(!Number.isSafeInteger(requestCount)||requestCount<0||requestCount>limit)throw Error('LQ08_REQUEST_BUDGET_EXCEEDED');
 if(!Number.isSafeInteger(activeWorkers)||activeWorkers!==1)throw Error('LQ08_SINGLE_WORKER_REQUIRED');
 if(!Number.isSafeInteger(cycleCount)||cycleCount!==1)throw Error('LQ08_SINGLE_CYCLE_REQUIRED');
 return {requestsRemaining:limit-requestCount,action:requestCount===limit?'STOP_REQUEST_BUDGET':'WITHIN_BUDGET',concurrencyGroup:'glitch-liquidity-history-worker'};
}
