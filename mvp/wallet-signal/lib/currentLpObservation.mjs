const address=x=>typeof x==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
const raw=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
export function projectCurrentLpObservation(e,mint){
 if(!e)return null;
 if(e.schemaVersion!==1||e.mint!==mint||!address(e.lpMint)||!address(e.pool)||e.source!=='alchemy'||
  e.commitment!=='finalized'||!Number.isFinite(Date.parse(e.observedAt))||e.atomic!==false||
  !Number.isSafeInteger(e.discoverySlot)||e.discoverySlot<0||!Number.isSafeInteger(e.observationSlot)||e.observationSlot<e.discoverySlot||
  !Array.isArray(e.holders)||!e.holders.length||e.holders.length>20||!raw(e.mintSupplyRaw)||!raw(e.observedRaw)||
  e.inventoryComplete!==false||e.withdrawalRightsVerified!==false||e.lpSecurityVerified!==false||e.scoreEligible!==false||e.historicalOwnershipVerified!==false)
  throw Error('LP_OBSERVATION_INVALID');
 const seen=new Set();let sum=0n;
 const holders=e.holders.map(h=>{
  if(!address(h?.tokenAccount)||!address(h.owner)||seen.has(h.tokenAccount)||!raw(h.amountRaw)||BigInt(h.amountRaw)===0n)throw Error('LP_OBSERVATION_ACCOUNT_INVALID');
  seen.add(h.tokenAccount);sum+=BigInt(h.amountRaw);return {tokenAccount:h.tokenAccount,owner:h.owner,amountRaw:h.amountRaw};
 });
 if(sum.toString()!==e.observedRaw||sum>BigInt(e.mintSupplyRaw))throw Error('LP_OBSERVATION_SUPPLY_INVALID');
 return {schemaVersion:1,mint,lpMint:e.lpMint,pool:e.pool,source:e.source,commitment:e.commitment,observedAt:e.observedAt,
  discoverySlot:e.discoverySlot,observationSlot:e.observationSlot,atomic:false,holders,
  observedRaw:e.observedRaw,mintSupplyRaw:e.mintSupplyRaw,observedBalanceSumEqualsSupply:sum===BigInt(e.mintSupplyRaw),
  inventoryComplete:false,withdrawalRightsVerified:false,lpSecurityVerified:false,scoreEligible:false,historicalOwnershipVerified:false};
}
