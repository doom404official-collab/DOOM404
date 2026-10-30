// One bounded GET read. No retries, worker starts or credential access.
export async function readDashboardEvidenceResponse(mint,{signal,fetchImpl=fetch,timeoutMs=12000}={}){
 const controller=new AbortController();let timer,cancel;
 const abort=()=>controller.abort();
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const cancelled=new Promise((_,reject)=>{cancel=()=>reject(Error('DASHBOARD_EVIDENCE_UNAVAILABLE'));if(controller.signal.aborted)cancel();else controller.signal.addEventListener('abort',cancel,{once:true});});
 try{
  timer=setTimeout(abort,timeoutMs);
  return await Promise.race([(async()=>{
   if(controller.signal.aborted)throw Error('DASHBOARD_EVIDENCE_UNAVAILABLE');
   const response=await fetchImpl('/api/scoring-evidence?mint='+encodeURIComponent(mint),{cache:'no-store',signal:controller.signal});
   if(controller.signal.aborted)throw Error('DASHBOARD_EVIDENCE_UNAVAILABLE');
   const data=await response.json();
   if(controller.signal.aborted||!response.ok||data?.mint!==mint)throw Error('DASHBOARD_EVIDENCE_UNAVAILABLE');
   return data;
  })(),cancelled]);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',cancel);}
}
