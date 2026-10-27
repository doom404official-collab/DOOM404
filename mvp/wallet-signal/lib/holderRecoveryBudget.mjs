// Recovery-only deadlines. The 60s route retains 10s platform/CPU margin.
// Stop provider work at 30s, reserving 20s for renewal, commit and serialization.
export const HOLDER_RECOVERY_TIMING=Object.freeze({totalMs:50000,providerMs:30000,requestMs:8000});
export function createHolderRecoveryBudget({now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 const started=now();
 return Object.freeze({
  async run(label,operation,{provider=false}={}){
   const deadline=Math.min(started+(provider?HOLDER_RECOVERY_TIMING.providerMs:HOLDER_RECOVERY_TIMING.totalMs),now()+HOLDER_RECOVERY_TIMING.requestMs);
   const error=new Error('RECOVERY_'+label+'_TIMEOUT');
   if(now()>=deadline)throw error;
   const controller=new AbortController();
   let timer;
   const timeout=new Promise((_,reject)=>{timer=schedule(()=>{controller.abort(error);reject(error);},Math.max(0,deadline-now()));});
   try{
    const value=await Promise.race([Promise.resolve().then(()=>{
     if(now()>=deadline){controller.abort(error);throw error;}
     return operation(controller.signal);
    }),timeout]);
    // Timers cannot preempt synchronous JSON parsing or a delayed event loop.
    if(now()>=deadline){controller.abort(error);throw error;}
    return value;
   }finally{cancel(timer);}
  }
 });
}
