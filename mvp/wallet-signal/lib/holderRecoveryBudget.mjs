const deadlineChecks=new WeakMap();
// Recheck immediately before transport after synchronous request serialization.
export function assertHolderBudgetSignal(signal){
 if(!signal)return;
 deadlineChecks.get(signal)?.();
 signal.throwIfAborted();
}
// Shared Holder deadlines; recovery may also supply an absolute window expiry.
// The 60s route retains 10s platform/CPU margin.
// Stop provider work at 30s, reserving 20s for renewal, commit and serialization.
export const HOLDER_RECOVERY_TIMING=Object.freeze({totalMs:50000,providerMs:30000,requestMs:8000});
export function createHolderRecoveryBudget({now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,notAfter=Infinity,wallNow=Date.now}={}){
 const started=now();
 return Object.freeze({
  async run(label,operation,{provider=false,maxOperationMs=HOLDER_RECOVERY_TIMING.requestMs}={}){
   if(!Number.isSafeInteger(maxOperationMs)||maxOperationMs<1||maxOperationMs>HOLDER_RECOVERY_TIMING.requestMs)throw Error("INVALID_OPERATION_BUDGET");
   const deadline=Math.min(started+(provider?HOLDER_RECOVERY_TIMING.providerMs:HOLDER_RECOVERY_TIMING.totalMs),now()+maxOperationMs,now()+Math.max(0,notAfter-wallNow()));
   const error=new Error('RECOVERY_'+label+'_TIMEOUT');
   if(now()>=deadline||wallNow()>=notAfter)throw error;
   const controller=new AbortController();
   deadlineChecks.set(controller.signal,()=>{if(now()>=deadline||wallNow()>=notAfter)controller.abort(error);});
   let timer;
   const timeout=new Promise((_,reject)=>{timer=schedule(()=>{controller.abort(error);reject(error);},Math.max(0,deadline-now()));});
   try{
    const value=await Promise.race([Promise.resolve().then(()=>{
     if(now()>=deadline||wallNow()>=notAfter){controller.abort(error);throw error;}
     return operation(controller.signal);
    }),timeout]);
    // Timers cannot preempt synchronous JSON parsing or a delayed event loop.
    if(now()>=deadline||wallNow()>=notAfter){controller.abort(error);throw error;}
    return value;
   }finally{cancel(timer);}
  }
 });
}
