// Dynamic observations expire independently of verified immutable receipts.
export const EVIDENCE_MAX_AGE_MS=Object.freeze({current_balances:60000,holder_distribution:60000,mint_authorities:300000,liquidity_reserves:60000,executable_quotes:60000,current_allocation_controls:60000,pool_inventory:60000});
export function isFreshEvidence(observedAt,kind,now=Date.now()){
 const at=Date.parse(observedAt);
 if(!Number.isFinite(at)||at>now)return false;
 if(kind==='immutable_transaction')return true;
 const max=EVIDENCE_MAX_AGE_MS[kind];
 return Number.isFinite(max)&&now-at<=max;
}
