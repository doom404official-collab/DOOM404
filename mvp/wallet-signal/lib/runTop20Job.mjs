import {createTop20Vault} from './top20Vault.mjs';
import {discoverSolRelationships} from './historicalSolRelationships.mjs';
export async function runTop20Job({snapshotId,rpcUrl,url,serviceRoleKey,discover=discoverSolRelationships,vault}={}){
 if(!/^[a-f0-9]{64}$/.test(snapshotId??'')||!rpcUrl)throw new TypeError('Invalid job parameters');
 const store=vault??createTop20Vault({url,serviceRoleKey});
 const frozen=await store.getFrozen(snapshotId);
 const holders=frozen.holder_ranking;
 if(!Array.isArray(holders)||holders.length!==20)throw new Error('Invalid frozen ranking');
 const existing=await store.getBatches(snapshotId);
 const completed=new Set(existing.filter(b=>b.status==='complete').map(b=>b.start_index));
 for(const startIndex of [0,5,10,15]){
  if(completed.has(startIndex))continue;
  if(existing.some(b=>b.start_index===startIndex))return {status:'needs_recovery',snapshotId,startIndex};
  const results=[];
  for(const h of holders.slice(startIndex,startIndex+5)){
   try{
    const history=await discover({rpcUrl,wallet:h.wallet,limit:10,maxPages:2});
    results.push({wallet:h.wallet,edges:history.edges,coverage:history.coverage});
   }catch{
    results.push({wallet:h.wallet,edges:[],coverage:{errorCode:'HISTORY_UNAVAILABLE'}});
   }
  }
  const complete=results.every(r=>!r.coverage.errorCode&&r.coverage.failed===0&&!r.coverage.failedPage);
  await store.saveBatch({snapshotId,startIndex,results,coverage:{complete},status:complete?'complete':'partial'});
  if(!complete)return {status:'partial',snapshotId,startIndex};
 }
 return {status:'sampled_not_final',snapshotId,batches:4};
}
