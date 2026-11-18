import {extractHolderNetworkTransfers} from './holderNetworkTransfers.mjs';
import {scoreTop20Network} from './top20NetworkScore.mjs';
// Operational retention bounds, not scoring thresholds. Hitting either bound
// is explicit missing evidence, never a truncated graph awarded full points.
export const NETWORK_RETENTION_LIMITS=Object.freeze({signatures:20000,transfers:20000});
export const holderNetworkSnapshotIdentity=c=>JSON.stringify({mint:c.mint,snapshot:c.snapshot??null,holders:(c.holders??[]).map(h=>({ownerWallet:h.ownerWallet,tokenAccount:h.tokenAccount,amountRaw:h.amountRaw,sharePct:h.sharePct}))});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function recordHolderNetworkTransaction(checkpoint,{transaction,signature}={}){
 if(checkpoint.signatures?.[signature]!=='checked')throw Error('NETWORK_SIGNATURE_NOT_CHECKED');
 const evidence=checkpoint.networkEvidence??={version:1,snapshotIdentity:holderNetworkSnapshotIdentity(checkpoint),processed:{},transfers:[],retentionLimited:false};
 if(evidence.version!==1||evidence.retentionLimited||evidence.snapshotIdentity!==holderNetworkSnapshotIdentity(checkpoint))return;
 if(Object.hasOwn(evidence.processed,signature))return;
 const parsed=extractHolderNetworkTransfers({transaction,signature});
 if(Object.keys(evidence.processed).length>=NETWORK_RETENTION_LIMITS.signatures||evidence.transfers.length+parsed.transfers.length>NETWORK_RETENTION_LIMITS.transfers){evidence.retentionLimited=true;return;}
 evidence.processed[signature]={valid:parsed.valid,unresolvedTokenTransfers:parsed.unresolvedTokenTransfers??0,transferCount:parsed.transfers.length};
 if(parsed.valid)evidence.transfers.push(...parsed.transfers);
}
export function summarizeHolderNetworkCheckpoint(checkpoint,{snapshotProvenanceVerified=false}={}){
 const unavailable=reason=>({status:'unavailable',score:null,reason,methodology:'TOP20_NETWORK_V1',historyComplete:false,calibrated:false,commonOwnershipEstablished:false});
 if(snapshotProvenanceVerified!==true)return unavailable('SNAPSHOT_PROVENANCE_UNVERIFIED');
 const e=checkpoint.networkEvidence;
 if(!e||e.version!==1||!object(e.processed)||!Array.isArray(e.transfers))return unavailable('NETWORK_TRANSFER_EVIDENCE_MISSING');
 if(e.snapshotIdentity!==holderNetworkSnapshotIdentity(checkpoint))return unavailable('NETWORK_SNAPSHOT_IDENTITY_MISMATCH');
 if(e.retentionLimited!==false||Object.keys(e.processed).length>NETWORK_RETENTION_LIMITS.signatures||e.transfers.length>NETWORK_RETENTION_LIMITS.transfers)return unavailable('NETWORK_EVIDENCE_RETENTION_LIMIT');
 const checked=Object.entries(checkpoint.signatures??{}).filter(([,s])=>s==='checked').map(([s])=>s);
 if(!checked.length||checked.some(s=>!object(e.processed[s])||e.processed[s].valid!==true))return unavailable('NETWORK_CHECKED_TRANSACTION_EVIDENCE_MISSING');
 if(checked.some(s=>e.processed[s].unresolvedTokenTransfers!==0))return unavailable('NETWORK_TOKEN_OWNERS_UNRESOLVED');
 const counts=new Map();for(const t of e.transfers)counts.set(t?.signature,(counts.get(t?.signature)??0)+1);
 if(checked.some(s=>!Number.isSafeInteger(e.processed[s].transferCount)||e.processed[s].transferCount<0||e.processed[s].transferCount!==(counts.get(s)??0)))return unavailable('NETWORK_RETAINED_TRANSFERS_MISSING');
 const checkedSet=new Set(checked);
 if(Object.keys(e.processed).some(s=>!checkedSet.has(s))||e.transfers.some(t=>!checkedSet.has(t?.signature)))return unavailable('NETWORK_SIGNATURE_IDENTITY_MISMATCH');
 try{
  if(typeof checkpoint.snapshot?.supplyRaw!=='string')return unavailable('NETWORK_RAW_SUPPLY_MISSING');
  const holders=new Map();
  for(const h of checkpoint.holders??[]){
   if(typeof h.amountRaw!=="string"||!/^\d+$/.test(h.amountRaw))return unavailable("NETWORK_RAW_BALANCE_MISSING");
   const old=holders.get(h.ownerWallet)??{sharePct:0,amountRaw:0n};
   holders.set(h.ownerWallet,{sharePct:old.sharePct+h.sharePct,amountRaw:old.amountRaw+BigInt(h.amountRaw)});
  }
  const result=scoreTop20Network({holders:[...holders].map(([wallet,h])=>({wallet,sharePct:h.sharePct,amountRaw:String(h.amountRaw)})),supplyRaw:checkpoint.snapshot?.supplyRaw,transfers:e.transfers,
   infrastructureWallets:['1nc1nerator11111111111111111111111111111111']});
  return {...result,coverage:{checkedTransactions:checked.length,retainedTransfers:e.transfers.length,
   pendingTransactions:Object.values(checkpoint.signatures??{}).filter(s=>s==='pending').length,
   failedTransactions:Object.values(checkpoint.signatures??{}).filter(s=>s==='failed').length,
   scope:'Parsed instructions in inspected holder-history transactions only; intermediary histories are not independently scanned.'}};
 }catch{return unavailable('NETWORK_EVIDENCE_INVALID');}
}
