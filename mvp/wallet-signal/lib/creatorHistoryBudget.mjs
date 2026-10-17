/** Shared request budget for bounded historical creator investigations.
 * Every provider attempt, including retries, consumes one unit.
 */
export function createCreatorHistoryBudget({maxRequests=500, minIntervalMs=250, now=()=>Date.now(), sleep=(ms)=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>500)throw Error("INVALID_CREATOR_BUDGET");
 if(!Number.isInteger(minIntervalMs)||minIntervalMs<0||minIntervalMs>5000)throw Error("INVALID_INTERVAL");
 let used=0,last=0;
 return {
  get used(){return used},
  get remaining(){return maxRequests-used},
  async take(){
   if(used>=maxRequests)throw Error("CREATOR_REQUEST_BUDGET_EXHAUSTED");
   const wait=Math.max(0,minIntervalMs-(now()-last));
   if(wait)await sleep(wait);
   last=now();used++;
   return used;
  }
 };
}
