// Controlled, read-only Helius staged diagnostic. Never prints endpoint or credentials.
// Stages are limited to 2/5/8 getSlot requests per second, with a pause between stages.
export async function runStagedDiagnostic({rpc,wait=ms=>new Promise(r=>setTimeout(r,ms)),stages=[2,5,8]}={}){
 if(typeof rpc!=='function'||!Array.isArray(stages)||stages.length<1||stages.some(n=>![2,5,8].includes(n)))throw TypeError('Invalid staged diagnostic');
 const report=[];
 for(const rate of stages){
  const results=await Promise.all(Array.from({length:rate},async(_,i)=>{
   const start=Date.now();
   try{const outcome=await rpc(i);return {...outcome,latencyMs:Date.now()-start};}
   catch{return {success:false,rateLimited:false,latencyMs:Date.now()-start};}
  }));
  const successes=results.filter(x=>x.success).length;
  const rateLimited=results.filter(x=>x.rateLimited).length;
  const latencies=results.map(x=>x.latencyMs).sort((a,b)=>a-b);
  const item={targetRps:rate,requests:rate,successes,rateLimited,errors:rate-successes,
   medianLatencyMs:latencies[Math.floor(latencies.length/2)],maxLatencyMs:latencies.at(-1)};
  report.push(item);
  if(item.errors>0||item.rateLimited>0)break;
  if(rate!==stages.at(-1))await wait(2000);
 }
 return {status:report.some(x=>x.errors>0)?'stopped_on_error':'completed',stages:report,
  scope:'getSlot only; no historical worker changes; burst concurrency is not sustained throughput'};
}
