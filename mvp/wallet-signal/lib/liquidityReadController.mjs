// One latest scoped read. No worker, retry, score or environment access.
export function createLiquidityReadController({fetchImpl=fetch,publish,timeoutMs=12000}={}){
 let scope='',generation=0,controller;
 function reset(mint='',silent=false){generation++;controller?.abort();scope=mint;if(!silent)publish({data:null,error:'',loading:false});}
 async function read(mint,{signal}={}){
  if(!mint||mint!==scope||signal?.aborted)return;
  const id=++generation;controller?.abort();const active=new AbortController();controller=active;
  const current=()=>generation===id&&scope===mint;
  const parentAbort=()=>active.abort();signal?.addEventListener('abort',parentAbort,{once:true});
  publish({data:null,error:'',loading:true});
  let timer,cancel;
  const aborted=new Promise((_,reject)=>{cancel=()=>reject(Object.assign(Error('Liquidity refresh timed out or cancelled'),{name:'AbortError'}));active.signal.addEventListener('abort',cancel,{once:true});});
  try{
   timer=setTimeout(()=>active.abort(),timeoutMs);
   const data=await Promise.race([(async()=>{
    const response=await fetchImpl('/api/token-liquidity?mint='+encodeURIComponent(mint),{cache:'no-store',signal:active.signal});
    if(active.signal.aborted)throw Error('cancelled');const value=await response.json();
    if(!response.ok||value?.mint!==mint||!['pools_reported','no_pools_reported'].includes(value.status))throw Error('Liquidity data unavailable');return value;
   })(),aborted]);
   if(current()&&!active.signal.aborted)publish({data,error:'',loading:false});
  }catch(error){if(current())publish({data:null,error:error.name==='AbortError'?'Liquidity refresh timed out':'Liquidity data unavailable',loading:false});}
  finally{signal?.removeEventListener('abort',parentAbort);clearTimeout(timer);active.signal.removeEventListener('abort',cancel);}
 }
 return {reset,read};
}
