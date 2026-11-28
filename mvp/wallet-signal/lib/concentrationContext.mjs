// RPC-reported ratio alignment only; not authenticity, ownership or completeness.
const slot = value => Number.isSafeInteger(value) && value >= 0;
export function hasAlignedConcentrationContext(evidence) {
 const c=evidence?.ratioContext;
 return c?.commitment==='confirmed' && slot(c.largestAccountsSlot) && slot(c.supplySlot) && c.largestAccountsSlot===c.supplySlot;
}
// Legacy and context-unbound responses retain raw observations, never percentages.
export function withConcentrationContext(evidence) {
 if(!evidence || hasAlignedConcentrationContext(evidence))return evidence;
 return {...evidence,largestAccountSharePct:null,top5TokenAccountSharePct:null,
  top10TokenAccountSharePct:null,top20TokenAccountSharePct:null,
  ...(Array.isArray(evidence.accounts)?{accounts:evidence.accounts.map(row=>({...row,sharePct:null}))}:{}),
  ...(evidence.ownership?{ownership:{...evidence.ownership,
   ...(Array.isArray(evidence.ownership.observedOwnerGroups)?{observedOwnerGroups:evidence.ownership.observedOwnerGroups.map(row=>({...row,sharePct:null}))}:{})}}:{})};
}
