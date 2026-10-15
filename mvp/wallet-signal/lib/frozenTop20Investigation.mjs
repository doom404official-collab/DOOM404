// Deterministic frozen top-20 selection and resumable batch state.
// Storage adapters must persist this record atomically; never rebuild ranking on resume.
import {createHash} from 'node:crypto';
export function freezeTop20Snapshot({mint,snapshot,excludedWallets=[]}) {
 if(typeof mint!=='string'||!snapshot||!Number.isSafeInteger(snapshot.slot)||
   !Array.isArray(snapshot.holders)||!Number.isFinite(snapshot.circulatingSupply)||snapshot.circulatingSupply<=0)
  throw new TypeError('Invalid mint or snapshot');
 const excluded=new Set(excludedWallets);
 const eligible=snapshot.holders.filter(h=>h && typeof h.wallet==='string' && Number.isFinite(h.balance) && h.balance>0 && !excluded.has(h.wallet))
  .sort((a,b)=>b.balance-a.balance || a.wallet.localeCompare(b.wallet)).slice(0,20)
  .map(({wallet,balance},rank)=>({wallet,balance,rank:rank+1}));
 const canonical=JSON.stringify({mint,slot:snapshot.slot,supply:snapshot.circulatingSupply,eligible,excludedWallets:[...excluded].sort()});
 const id=createHash('sha256').update(canonical).digest('hex');
 return {id,mint,slot:snapshot.slot,supply:snapshot.circulatingSupply,
  holders:eligible,excludedWallets:[...excluded].sort(),status:'frozen',schemaVersion:1};
}
export function mergeInvestigationBatch(state,{snapshotId,startIndex,results}) {
 if(!state||snapshotId!==state.id||!Array.isArray(results)||!Number.isInteger(startIndex)||startIndex<0)
  throw new TypeError('Snapshot mismatch or invalid batch');
 const previous=new Map(Object.entries(state.results??{}));
 for(let i=0;i<results.length;i++){
  const target=state.holders[startIndex+i];
  if(!target || results[i]?.wallet!==target.wallet)throw new TypeError('Holder rank or wallet mismatch');
  if(previous.has(target.wallet))throw new Error('Batch already processed; explicit retry required');
  previous.set(target.wallet,results[i]);
 }
 return {...state,results:Object.fromEntries(previous),
  status:previous.size===state.holders.length?'sampled':'in_progress',
  processed:previous.size,total:state.holders.length};
}
