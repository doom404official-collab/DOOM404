import {scannerContext,ScannerDenied,isScannerDenied} from './scannerRequestContext.mjs';
function classify(input,init){
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(url.protocol!=='https:')throw new ScannerDenied('PROVIDER_HTTPS_REQUIRED');
 const host=url.hostname;
 if(host.endsWith('.supabase.co'))return null;
 let body;try{if(typeof init?.body==='string'&&init.body.length<=2000000)body=JSON.parse(init.body);}catch{}
 const rpc=Array.isArray(body)?body:body?.jsonrpc==='2.0'?[body]:[];
 if(rpc.length&&rpc.every(x=>x?.jsonrpc==='2.0'&&typeof x.method==='string'))return {kind:'rpc',provider:host.includes('alchemy')?'alchemy':host.includes('helius')?'helius':'configured_rpc',calls:rpc.length};
 if(host==='api.dexscreener.com')return {kind:'market',provider:'market',calls:1};
 return {kind:'other',provider:'other',calls:1};
}
export async function guardedProviderFetch(original,input,init){
 const ctx=scannerContext.getStore();
 if(!ctx)throw new ScannerDenied('UNADMITTED_PROVIDER_OPERATION');
 if(ctx.closed||ctx.controller.signal.aborted)throw ctx.denial||new ScannerDenied('REQUEST_DEADLINE');
 let charge;
 try{
  charge=classify(input,init);
  if(charge){
   const result=await ctx.store.debit({p_id:ctx.lease,p_kind:charge.kind,p_provider:charge.provider,p_calls:charge.calls});
   if(result.status!=='ADMITTED')throw new ScannerDenied(result.status||'PROVIDER_BUDGET',result.status==='LEASE_EXPIRED'?503:429,result.retryAfter||5);
  }
  if(ctx.closed||ctx.controller.signal.aborted)throw new ScannerDenied('REQUEST_DEADLINE');
  return await original(input,{...init,signal:AbortSignal.any([ctx.controller.signal,init?.signal,input?.signal].filter(Boolean))});
 }catch(error){
  if(isScannerDenied(error)){ctx.denial=error;ctx.controller.abort(error);}
  throw error;
 }
}
export function installScannerProviderGuard(){
 const key=Symbol.for('doom404.scanner.provider-guard.v1');
 if(globalThis[key])return;
 const original=globalThis.fetch;
 // Only serverless Scanner handlers import this module. CLI workers opt in via bootstrap.
 globalThis.fetch=(input,init)=>guardedProviderFetch(original,input,init);
 globalThis[key]={installed:true};
}
export {classify as classifyScannerProvider};
