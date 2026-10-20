/** Optional Helius indexed archival lookup, oldest-first.
 * gTFA is a paid-plan RPC feature (100 provider credits per call).
 * Caller must explicitly opt in; results are candidates, not creator proof.
 */
export async function fetchHeliusOldestOriginCandidates({mint,rpcUrl,fetchImpl=fetch,budget,enabled=false,limit=10}={}){
 if(!enabled)return {status:'DISABLED',candidates:[],requests:0};
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint||'')||
 !/^https:\/\//.test(rpcUrl||'')||typeof budget?.take!=='function'||
 !Number.isInteger(limit)||limit<1||limit>100)throw Error('INVALID_INDEXED_PROVIDER_CONFIG');
 await budget.take();
 const response=await fetchImpl(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTransactionsForAddress',
   params:[mint,{transactionDetails:'signatures',sortOrder:'asc',limit,filters:{status:'succeeded'}}]}),
  cache:'no-store'});
 if(!response.ok)return {status:'PROVIDER_HTTP_ERROR',candidates:[],requests:1};
 const payload=await response.json();
 if(payload.error)return {status:'PROVIDER_UNAVAILABLE',candidates:[],requests:1};
 const data=payload.result?.data;
 if(!Array.isArray(data))return {status:'INVALID_PROVIDER_RESPONSE',candidates:[],requests:1};
 return {status:'CANDIDATES',requests:1,candidates:data.filter(x=>typeof x?.signature==='string')
  .map(x=>({mint,signature:x.signature,slot:x.slot,blockTime:x.blockTime,source:'helius-gtfa'})),
  providerPaginationToken:payload.result?.paginationToken||null,archiveComplete:false};
}
