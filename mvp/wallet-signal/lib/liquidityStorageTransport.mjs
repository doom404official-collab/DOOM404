// Client deadlines do not cancel a committed server write. Never retry here.
export function validateLiquidityStorage({url,serviceRoleKey}={}){
 if(!url||typeof serviceRoleKey!=='string'||!serviceRoleKey.trim())throw Error('LIQUIDITY_STORAGE_NOT_CONFIGURED');
 let target;try{target=new URL(url);}catch{throw Error('INVALID_LIQUIDITY_STORAGE_URL');}
 if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash||target.pathname!=='/')throw Error('INVALID_LIQUIDITY_STORAGE_URL');
 return target.origin;
}
export async function liquidityStorageRequest(endpoint,options,{fetchImpl=fetch,signal,timeoutMs=12000,json=false,label='LIQUIDITY_STORAGE',now=()=>performance.now()}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>12000)throw Error('INVALID_LIQUIDITY_STORAGE_TIMEOUT');
 const controller=new AbortController(),deadline=now()+timeoutMs;let dispatched=false,timer,abortListener;
 const mutation=options.method==='POST';
 const failure=message=>Object.assign(Error(message+(mutation&&dispatched?'_OUTCOME_UNKNOWN':'')),{reconciliationRequired:mutation&&dispatched,requestDispatched:dispatched,retries:0});
 const check=()=>{if(signal?.aborted||controller.signal.aborted||now()>=deadline)throw failure(label+'_TIMEOUT_OR_CANCELLED');};
 const cancel=()=>controller.abort();
 const cancelled=new Promise((_,reject)=>{abortListener=()=>reject(failure(label+'_TIMEOUT_OR_CANCELLED'));controller.signal.addEventListener('abort',abortListener,{once:true});});
 if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 timer=setTimeout(cancel,timeoutMs);
 try{
  return await Promise.race([cancelled,Promise.resolve().then(async()=>{
   check();dispatched=true;
   const response=await fetchImpl(endpoint,{...options,signal:controller.signal,redirect:'error'});
   check();if(response?.ok!==true)throw failure(label+'_FAILED_'+(Number.isInteger(response?.status)?response.status:'INVALID_RESPONSE'));
   const value=json?await response.json():true;check();return value;
  })]);
 }catch(error){
  // Never propagate endpoint, token or provider body from transport errors.
  if(error?.requestDispatched!==undefined)throw error;
  throw failure(label+'_TRANSPORT_FAILED');
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',abortListener);}
}
