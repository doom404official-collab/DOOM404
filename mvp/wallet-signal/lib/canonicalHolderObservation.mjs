import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
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
/** Revalidate a stored schema2 observation by mint, slot, exact raw balances and
 * canonical content/holder-set hashes. Provenance remains separate from chain proof. */
export function projectCanonicalHolderObservation(row,mint){
 const s=row?.observation;
 if(!row)return {mint,status:'not_started'};
 if(row.mint!==mint||!/^[a-f0-9]{64}$/.test(row.id||'')||row.status!=='frozen'||!Number.isSafeInteger(row.snapshot_slot)||row.snapshot_slot<0||s?.schemaVersion!==2||s.mint!==mint||!/^[a-f0-9]{64}$/.test(s.holderSetHash||'')||s.hashAlgorithm!=='sha256-ordered-eligible-wallet-token-accounts-v2'||s.commitment!=='finalized'||s.atomic!==false||s.contextSlots?.inventory!==row.snapshot_slot||s.contextSlots?.mint!==row.snapshot_slot||!Number.isSafeInteger(s.contextSlots?.classifications)||s.contextSlots.classifications<row.snapshot_slot||s.supplyRaw!==row.supply_raw||!raw(s.supplyRaw)||BigInt(s.supplyRaw)<=0n||(!Number.isInteger(s.decimals)||s.decimals<0||s.decimals>255)||s.supplyDefinition!=='mint-total-supply-not-circulating'||!Number.isFinite(Date.parse(s.observedAt))||s.historyComplete!==false||s.commonOwnershipEstablished!==false||s.custodialClassificationComplete!==false||!/^[a-f0-9]{40}$/.test(s.artifactProvenance?.sourceCommit||'')||!Number.isSafeInteger(s.artifactProvenance?.artifactId)||s.artifactProvenance.artifactId<=0||!Array.isArray(s.eligibleHolders)||s.eligibleHolders.length!==20||!Array.isArray(s.excludedWallets)||!Array.isArray(row.holder_ranking)||row.holder_ranking.length!==20)throw Error('CANONICAL_HOLDER_OBSERVATION_INVALID');
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
 if(hash!==s.holderSetHash)throw Error('CANONICAL_HOLDER_HASH_MISMATCH');
 return {schemaVersion:2,mint,status:'canonical_observation',snapshotId:row.id,holderSetHash:hash,observedAt:s.observedAt,contextSlots:s.contextSlots,commitment:'finalized',atomic:false,supplyRaw:s.supplyRaw,decimals:s.decimals,largestHolderSharePct:Number(BigInt(s.eligibleHolders[0].balance)*1000000n/BigInt(s.supplyRaw))/10000,eligibleHolderCount:20,excludedAuthorityCount:s.excludedWallets.length,top20SharePct:Number(total*1000000n/BigInt(s.supplyRaw))/10000,historyComplete:false,scoreEligible:false,commonOwnershipEstablished:false,custodialClassificationComplete:false};
}
