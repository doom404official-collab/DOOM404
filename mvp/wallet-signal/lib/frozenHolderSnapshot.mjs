import {validNetworkAddress} from './holderNetworkTransfers.mjs';
// Validate raw inputs without rounding through Number or changing frozen ranking.
export function readFrozenHolderSnapshot(snapshot){
 if(!snapshot||snapshot.status!=='frozen'||typeof snapshot.id!=='string'||!snapshot.id||!validNetworkAddress(snapshot.mint)||!Number.isSafeInteger(snapshot.slot)||snapshot.slot<0||
  !Array.isArray(snapshot.holder_ranking)||snapshot.holder_ranking.length!==20||!Array.isArray(snapshot.excluded_wallets)||
  !snapshot.excluded_wallets.every(validNetworkAddress)||new Set(snapshot.excluded_wallets).size!==snapshot.excluded_wallets.length)throw Error('INVALID_FROZEN_SNAPSHOT');
 if(typeof snapshot.supply_raw!=='string'||!/^\d+$/.test(snapshot.supply_raw)||BigInt(snapshot.supply_raw)<=0n)throw Error('INVALID_FROZEN_SUPPLY');
 const supply=BigInt(snapshot.supply_raw);let sum=0n;
 const holders=snapshot.holder_ranking.map(h=>{
  if(!validNetworkAddress(h?.wallet)||typeof h.balance!=='string'||!/^\d+$/.test(h.balance))throw Error('INVALID_FROZEN_HOLDER');
  sum+=BigInt(h.balance);
  return {wallet:h.wallet,amountRaw:h.balance,sharePct:Number(BigInt(h.balance)*1000000n/supply)/10000};
 });
 if(sum>supply||new Set(holders.map(h=>h.wallet)).size!==20)throw Error('INVALID_FROZEN_HOLDER_SUPPLY');
 // Identity is a comparison value, not an attestation or permission to attach it.
 const snapshotIdentity=JSON.stringify({id:snapshot.id,mint:snapshot.mint,slot:snapshot.slot,supplyRaw:snapshot.supply_raw,ranking:snapshot.holder_ranking,excludedWallets:snapshot.excluded_wallets});
 return {holders,snapshotIdentity};
}
