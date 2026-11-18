// Provider work stops before the existing 90s tick limit to reserve persistence
// time. This does not renew or extend the existing 180s database lease.
const checks=new WeakMap();
export function assertCreatorSignal(signal){checks.get(signal)?.();signal?.throwIfAborted();}
export function createCreatorExecutionBudget({maxDurationMs=90000,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 if(!Number.isSafeInteger(maxDurationMs)||maxDurationMs<1||maxDurationMs>90000)throw Error('INVALID_CREATOR_DURATION');
 const started=now(),end=started+maxDurationMs,providerEnd=started+Math.max(0,maxDurationMs-15000);
 return {async run(label,operation,{provider=false,signal}={}){
  const deadline=Math.min(provider?providerEnd:end,now()+15000);
  const error=new Error('CREATOR_'+label+'_TIMEOUT'),controller=new AbortController();
  const check=()=>{
   try{assertCreatorSignal(signal);}catch(reason){controller.abort(reason);}
   if(now()>=deadline)controller.abort(error);
  };
  checks.set(controller.signal,check);
  const abort=()=>controller.abort(signal.reason);
  let rejectAbort;
  const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',rejectAbort,{once:true});});
  const timer=schedule(()=>controller.abort(error),Math.max(0,deadline-now()));
  // Race cancellation itself: a fetch/store implementation need not cooperate.
  // Attach the race before testing an already-aborted parent to avoid orphaned
  // rejection promises. The operation checks cancellation before any work.
  const pending=Promise.race([cancelled,Promise.resolve().then(()=>{assertCreatorSignal(controller.signal);return operation(controller.signal);})]);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  try{
   const value=await pending;
   assertCreatorSignal(controller.signal);return value;
  }finally{cancel(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);}
 }};
}
