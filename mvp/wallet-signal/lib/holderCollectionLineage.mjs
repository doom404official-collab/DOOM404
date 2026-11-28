// Generic content/receipt consistency, not independently authenticated chain proof.
const verified=new WeakSet();
const unavailable=()=>Object.freeze({status:'unverified',scope:'collection_to_persistence'});
const dense=(a,n)=>Array.isArray(a)&&a.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const address=x=>typeof x==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
const uint=x=>{
 if(typeof x!=='string'||!/^(0|[1-9][0-9]*)$/.test(x))throw Error('INVALID_LINEAGE_INTEGER');
 const n=Number(x);if(!Number.isSafeInteger(n)||n<0||String(n)!==x)throw Error('INVALID_LINEAGE_INTEGER');return n;
};
// Exact historical freezer field order and numeric representation. No inferred ranks.
export function canonicalHolderCollectionRow(s,receipt=s?.collectionReceipt){
 if(!s||!receipt||s.id!==receipt.snapshotId||s.mint!==receipt.mint||s.slot!==receipt.slot||s.status!=='frozen'||
 s.supply_definition!=='mint-total-supply-not-circulating'||!dense(s.holder_ranking,20)||
 !dense(s.excluded_wallets,1)||s.excluded_wallets[0]!=='1nc1nerator11111111111111111111111111111111')throw Error('INVALID_LINEAGE_SCOPE');
 const supply=uint(s.supply_raw);if(supply<=0)throw Error('INVALID_LINEAGE_SUPPLY');
 const seen=new Set();let total=0n;
 const eligible=s.holder_ranking.map((h,i)=>{
  if(!h||h.rank!==i+1||!address(h.wallet)||seen.has(h.wallet)||s.excluded_wallets.includes(h.wallet))throw Error('INVALID_LINEAGE_RANKING');
  seen.add(h.wallet);const balance=uint(h.balance);if(balance<=0)throw Error('INVALID_LINEAGE_BALANCE');total+=BigInt(balance);
  return {wallet:h.wallet,balance,rank:h.rank};
 });
 if(total>BigInt(supply))throw Error('INVALID_LINEAGE_SUPPLY');
 return JSON.stringify({mint:s.mint,slot:s.slot,supply,eligible,excludedWallets:[...s.excluded_wallets].sort()});
}
export async function verifyHolderCollectionLineage(snapshot,{signal,receipt=snapshot?.collectionReceipt}={}){
 try{
  if(signal?.aborted||!globalThis.crypto?.subtle?.digest||!receipt||!/^[a-f0-9]{40}$/.test(receipt.sourceCommit||'')||!/^\d{1,20}$/.test(receipt.runId||'')||!/^\d{1,20}$/.test(receipt.jobId||'')||!Number.isFinite(Date.parse(receipt.receiptObservedAt)))return unavailable();
  const bytes=new TextEncoder().encode(canonicalHolderCollectionRow(snapshot,receipt));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  if(signal?.aborted)return unavailable();
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==receipt.snapshotId)return unavailable();
  const result=Object.freeze({...receipt,status:'verified',canonicalRowHashVerified:true,
   exactSlotAccountStateCertified:false,jobAssociationVerified:false});
  verified.add(result);return result;
 }catch{return unavailable();}
}
// Only a locally computed result can render the positive claim; serialized flags
// and caller-created lookalikes must be revalidated against the actual row.
export const isVerifiedHolderCollectionLineage=value=>verified.has(value);
