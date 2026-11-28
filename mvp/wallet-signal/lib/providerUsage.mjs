import {traceSpan} from './scannerTrace.mjs';
import {randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
const slot=Symbol.for('doom404.scanner.provider-usage.v2');
if(!globalThis[slot]){
 const storage=new AsyncLocalStorage(),original=globalThis.fetch;
 globalThis[slot]={storage,original};
 globalThis.fetch=async function(input,init){
  const usage=storage.getStore();
  if(usage){
   let body;try{body=typeof init?.body==='string'&&init.body.length<2000000?JSON.parse(init.body):null;}catch{}
   const calls=Array.isArray(body)?body:[body],rpc=calls.filter(x=>x?.jsonrpc==='2.0'&&typeof x.method==='string');
   if(rpc.length){const host=new URL(typeof input==='string'?input:input.url).hostname;const provider=host.includes('alchemy')?'alchemy':host.includes('helius')?'helius':'configured_rpc';usage.providers[provider]=(usage.providers[provider]||0)+1;usage.rpcHttpRequests++;usage.rpcLogicalCalls+=rpc.length;for(const r of rpc)usage.methods[r.method]=(usage.methods[r.method]||0)+1;}
   else if(typeof input==='string'&&input.startsWith('https://api.dexscreener.com/'))usage.marketDataRequests++;
   else if(typeof input==='string'&&new URL(input).hostname==='solana-mainnet.g.alchemy.com'&&new URL(input).pathname.endsWith('/swap/v2/order')){usage.quoteHttpRequests++;usage.providers.alchemy=(usage.providers.alchemy||0)+1;}
   else if(typeof input==='string'&&/\b(helius|alchemy|solscan)\b/.test(new URL(input).hostname))usage.providerHttpRequests++;
  }
  let span='provider_other';try{const u=new URL(typeof input==='string'?input:input.url);if(u.hostname.endsWith('.supabase.co'))span=init?.method==='POST'?'vault_write':'vault_read';else if(u.hostname==='api.dexscreener.com')span='market_data';else if(u.pathname.endsWith('/swap/v2/order'))span='executable_quote';else if(typeof init?.body==='string'&&init.body.includes('jsonrpc')){const payload=JSON.parse(init.body);const m=Array.isArray(payload)?'batch':payload.method;span=({getAccountInfo:'rpc_account',getMultipleAccounts:'rpc_account_batch',getTokenLargestAccounts:'rpc_holders',getTokenAccountsByOwner:'rpc_owner_accounts',getTransaction:'rpc_transaction',getTransactionsForAddress:'rpc_indexed_history',getSignaturesForAddress:'rpc_signatures',getAsset:'rpc_metadata'}[m]||'rpc_other');}}catch{}
  return traceSpan(span,()=>original(input,init));
 };
}
export async function withProviderUsage(handler,request){
 const usage={requestId:randomUUID(),rpcHttpRequests:0,rpcLogicalCalls:0,marketDataRequests:0,quoteHttpRequests:0,providerHttpRequests:0,methods:{},providers:{}};
 return globalThis[slot].storage.run(usage,async()=>{
  let response;try{response=await handler(request);}finally{console.info('GLITCH_PROVIDER_USAGE',JSON.stringify({...usage,route:new URL(request.url).pathname}));}
  response.headers.set('X-Glitch-Usage-Id',usage.requestId);
  response.headers.set('X-Glitch-Rpc-Requests',String(usage.rpcHttpRequests));
  response.headers.set('X-Glitch-Provider-Http-Requests',String(usage.providerHttpRequests));
  response.headers.set('X-Glitch-Quote-Requests',String(usage.quoteHttpRequests));
  response.headers.set('X-Glitch-Rpc-Calls',String(usage.rpcLogicalCalls));
  response.headers.set('X-Glitch-Market-Requests',String(usage.marketDataRequests));
  response.headers.set('X-Glitch-Usage-Scope','this-response-provider-attempts');
  return response;
 });
}
