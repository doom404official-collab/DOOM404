import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
export const CANONICAL_HOLDER_BASELINE=Object.freeze({mint:'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',snapshotId:'0596510d6dc07e1dce934fba0dcf96a5594b38807383bd6d829d9d6fe441177b',holderSetHash:'77f749040d291e057c546d1f4872f4de9432bdda4be512a0dc94bda14bc20daa',slot:474029636,sourceCommit:'317e5d7f63b1dbb8f35a1775175371be8a90123c',artifactId:15089958372});
const raw=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
// Rebuild capture field order after PostgreSQL jsonb normalization.
export function canonicalHolderObservationIdentity(s){
 const authority=a=>({programOwner:a.programOwner,executable:a.executable,contextSlot:a.contextSlot});
 const wallet=h=>({wallet:h.wallet,balance:h.balance,tokenAccounts:h.tokenAccounts.map(t=>({tokenAccount:t.tokenAccount,amountRaw:t.amountRaw,...(t.prefixSha256?{prefixSha256:t.prefixSha256}:{})}))});
 const c=s.contextSlots,p=s.providerProvenance;
 const base={schemaVersion:s.schemaVersion,mint:s.mint,observedAt:s.observedAt,commitment:s.commitment,
  contextSlots:{inventory:c.inventory,mint:c.mint,classifications:c.classifications},atomic:s.atomic,supplyRaw:s.supplyRaw,decimals:s.decimals,supplyDefinition:s.supplyDefinition,
  holderSetHash:s.holderSetHash,hashAlgorithm:s.hashAlgorithm,provider:s.provider,tokenProgram:s.tokenProgram,
  providerProvenance:{provider:p.provider,network:p.network,methods:p.methods,requestCount:p.requestCount},
  inventoryAccountCount:s.inventoryAccountCount,inventoryWalletCount:s.inventoryWalletCount,inventoryDigest:s.inventoryDigest,supplyReconciled:s.supplyReconciled,
  eligibleHolders:s.eligibleHolders.map(h=>({...wallet(h),rank:h.rank,classification:h.classification,authorityAccount:authority(h.authorityAccount)})),
  excludedWallets:s.excludedWallets.map(h=>({...wallet(h),reason:h.reason,authorityAccount:authority(h.authorityAccount)})),
  custodialClassificationComplete:s.custodialClassificationComplete,commonOwnershipEstablished:s.commonOwnershipEstablished,historyComplete:s.historyComplete};
 return createHash('sha256').update(JSON.stringify(base)).digest('hex');
}
/** Pinned reviewed baseline; legacy snapshots never become compatible implicitly. */
export function projectCanonicalHolderObservation(row,mint){
 const p=CANONICAL_HOLDER_BASELINE,s=row?.observation;
 if(!row)return {mint,status:'not_started'};
 if(mint!==p.mint||row.mint!==mint||row.id!==p.snapshotId||row.status!=='frozen'||row.snapshot_slot!==p.slot||s?.schemaVersion!==2||s.mint!==mint||s.holderSetHash!==p.holderSetHash||s.hashAlgorithm!=='sha256-ordered-eligible-wallet-token-accounts-v2'||s.commitment!=='finalized'||s.atomic!==false||s.contextSlots?.inventory!==p.slot||s.contextSlots?.mint!==p.slot||s.contextSlots?.classifications!==474029653||s.supplyRaw!==row.supply_raw||!raw(s.supplyRaw)||BigInt(s.supplyRaw)<=0n||s.decimals!==6||s.supplyDefinition!=='mint-total-supply-not-circulating'||!Number.isFinite(Date.parse(s.observedAt))||s.historyComplete!==false||s.commonOwnershipEstablished!==false||s.custodialClassificationComplete!==false||s.artifactProvenance?.sourceCommit!==p.sourceCommit||s.artifactProvenance?.artifactId!==p.artifactId||!Array.isArray(s.eligibleHolders)||s.eligibleHolders.length!==20||!Array.isArray(s.excludedWallets)||!Array.isArray(row.holder_ranking)||row.holder_ranking.length!==20)throw Error('CANONICAL_HOLDER_OBSERVATION_INVALID');
 if(canonicalHolderObservationIdentity(s)!==row.id)throw Error('CANONICAL_HOLDER_SNAPSHOT_DIGEST_MISMATCH');
 const wallets=new Set(),accounts=new Set();let total=0n;
 for(let i=0;i<20;i++){
  const h=s.eligibleHolders[i],r=row.holder_ranking[i];new PublicKey(h.wallet);
  if(wallets.has(h.wallet)||h.rank!==i+1||!raw(h.balance)||BigInt(h.balance)<=0n||!Array.isArray(h.tokenAccounts)||h.tokenAccounts.length<1||!PublicKey.isOnCurve(new PublicKey(h.wallet).toBytes())||!['SYSTEM_WALLET_CUSTODIAN_STATUS_UNRESOLVED','ABSENT_ON_CURVE_AUTHORITY_CUSTODIAN_STATUS_UNRESOLVED'].includes(h.classification)||h.authorityAccount.contextSlot!==s.contextSlots.classifications||!(h.authorityAccount.programOwner===null||h.authorityAccount.programOwner==='11111111111111111111111111111111')||r.wallet!==h.wallet||r.balance!==h.balance||r.rank!==h.rank)throw Error('CANONICAL_HOLDER_RANKING_INVALID');
  wallets.add(h.wallet);let balance=0n;
  for(const t of h.tokenAccounts){new PublicKey(t.tokenAccount);if(accounts.has(t.tokenAccount)||!raw(t.amountRaw))throw Error('CANONICAL_HOLDER_ACCOUNT_INVALID');accounts.add(t.tokenAccount);balance+=BigInt(t.amountRaw);}
  if(balance.toString()!==h.balance||i&&(BigInt(s.eligibleHolders[i-1].balance)<balance||BigInt(s.eligibleHolders[i-1].balance)===balance&&s.eligibleHolders[i-1].wallet>=h.wallet))throw Error('CANONICAL_HOLDER_RANKING_INVALID');total+=balance;
 }
 if(total>BigInt(s.supplyRaw))throw Error('CANONICAL_HOLDER_SUPPLY_INVALID');
 const hash=createHash('sha256').update(JSON.stringify({version:2,mint,holders:s.eligibleHolders.map(h=>[h.wallet,h.tokenAccounts.map(t=>t.tokenAccount)])})).digest('hex');
 if(hash!==p.holderSetHash)throw Error('CANONICAL_HOLDER_HASH_MISMATCH');
 return {schemaVersion:2,mint,status:'canonical_observation',snapshotId:p.snapshotId,holderSetHash:hash,observedAt:s.observedAt,contextSlots:s.contextSlots,commitment:'finalized',atomic:false,supplyRaw:s.supplyRaw,decimals:s.decimals,eligibleHolderCount:20,excludedAuthorityCount:s.excludedWallets.length,top20SharePct:Number(total*1000000n/BigInt(s.supplyRaw))/10000,historyComplete:false,scoreEligible:false,commonOwnershipEstablished:false,custodialClassificationComplete:false};
}
