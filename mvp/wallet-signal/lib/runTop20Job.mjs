import {createTop20Vault} from './top20Vault.mjs';
import {discoverSolRelationships} from './historicalSolRelationships.mjs';
export async function runTop20Job({snapshotId,rpcUrl,url,serviceRoleKey,discover=discoverSolRelationships,vault}={}){
 if(!/^[a-f0-9]{64}$/.test(snapshotId??'')||!rpcUrl)throw new TypeError('Invalid job parameters');
 const store=vault??createTop20Vault({url,serviceRoleKey});
 const frozen=await store.getFrozen(snapshotId);
 const holders=frozen.holder_ranking;
 if(!Array.isArray(holders)||holders.length!==20)throw new Error('Invalid frozen ranking');
 const existing=await store.getBatches(snapshotId);
 const recorded=new Map(existing.map(b=>[b.start_index,b]));
 const summary=[];
 for(const startIndex of [0,5,10,15]){
  if(recorded.has(startIndex)){
   const batch=recorded.get(startIndex);
   if(!['complete','partial'].includes(batch.status)||!Array.isArray(batch.wallet_results)||batch.wallet_results.length!==5||
    batch.wallet_results.some((r,i)=>r.wallet!==holders[startIndex+i].wallet))
    throw new Error('Stored checkpoint does not match frozen holder ranking');
   summary.push({startIndex,status:batch.status,reused:true});
   continue;
  }
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
  summary.push({startIndex,status:complete?'complete':'partial',reused:false});
 }
 return {status:'sampled_not_final',snapshotId,batches:summary.length,partialBatches:summary.filter(x=>x.status==='partial').length,summary};
}
