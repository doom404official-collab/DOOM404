import {verifyBoundedCreatorOrigin} from './boundedCreatorOriginV2.mjs';
import {traceEvent} from './scannerTrace.mjs';
const cache=new Map(),pending=new Map();
/** Process-local immutable creation evidence cache. It never caches balances,
 * authorities, prices or failed discovery. Durable worker observations remain
 * the separate cross-instance reuse path; this is not a distributed lease. */
export async function creatorOriginPage(mint,fetchPage,{now=Date.now}={}){
 const saved=cache.get(mint);
 if(saved&&now()-saved.at<7*86400000){traceEvent('creator_origin_cache_hit');return {data:[structuredClone(saved.tx)],paginationToken:null,source:'immutable_creation_cache'};}
 if(pending.has(mint)){traceEvent('creator_origin_shared_request');return pending.get(mint);}
 traceEvent('creator_origin_cache_miss');
 if(pending.size>=50)return fetchPage();
 const task=(async()=>{
  const page=await fetchPage();
  if(Array.isArray(page?.data)&&page.data.length<=12){
   const origins=page.data.map(tx=>({tx,proof:verifyBoundedCreatorOrigin(tx,mint)})).filter(x=>x.proof);
   if(origins.length&&new Set(origins.map(x=>x.proof.creator)).size===1){const tx=origins[0].tx;if(Buffer.byteLength(JSON.stringify(tx))<=131072){cache.set(mint,{at:now(),tx:structuredClone(tx)});if(cache.size>50)cache.delete(cache.keys().next().value);}}
  }
  return page;
 })();pending.set(mint,task);
 try{return await task;}finally{if(pending.get(mint)===task)pending.delete(mint);}
}
