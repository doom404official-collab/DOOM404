'use strict';
// Finalized transactions are immutable. Persisted fixtures are bundled separately
// from a bounded, per-process cache; no claim of cross-instance persistence.
const fixtures=require('../tests/fixtures/historical/index.json');
const cache=new Map(),pending=new Map();
const stats={rpcRequests:0,fixtureHits:0,cacheHits:0,deduplicated:0};
async function getTransaction(signature,rpc){
 if(fixtures[signature]){stats.fixtureHits++;return fixtures[signature].transaction;}
 if(cache.has(signature)){stats.cacheHits++;return cache.get(signature);}
 if(pending.has(signature)){stats.deduplicated++;return pending.get(signature);}
 const p=(async()=>{stats.rpcRequests++;const t=await rpc('getTransaction',[signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:1}]);if(t?.meta?.err===null){if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(signature,t);}return t;})();
 pending.set(signature,p);try{return await p}finally{pending.delete(signature)}
}
async function rpc(method,params){
 const r=await fetch(process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(8000)});
 const j=await r.json();if(!r.ok||j.error)throw Error('RPC unavailable');return j.result;
}
module.exports={getTransaction,rpc,stats};
