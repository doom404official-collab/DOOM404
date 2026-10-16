// Small, read-only Helius smoke test. Never logs endpoint or credentials.
// Intentionally capped at one request/second to avoid disturbing historical workers.
const endpoint=process.env.HELIUS_RPC_URL;
if(!endpoint||!endpoint.startsWith('https://')){console.error('HELIUS_RPC_URL missing');process.exit(2);}
const count=8,delay=1000,results=[];
for(let i=0;i<count;i++){
 const started=Date.now();
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:i+1,method:'getSlot',params:[{commitment:'confirmed'}]}),
   signal:AbortSignal.timeout(8000)});
  const body=response.ok?await response.json():null;
  results.push({status:response.status,latencyMs:Date.now()-started,
   success:response.ok&&Number.isInteger(body?.result),rateLimited:response.status===429});
 }catch{results.push({status:'network_error',latencyMs:Date.now()-started,success:false,rateLimited:false});}
 if(i<count-1)await new Promise(resolve=>setTimeout(resolve,delay));
}
const latencies=results.map(r=>r.latencyMs).sort((a,b)=>a-b);
const output={status:'measured',method:'getSlot',requests:count,success:results.filter(r=>r.success).length,
 rateLimited:results.filter(r=>r.rateLimited).length,errors:results.filter(r=>!r.success).length,
 medianLatencyMs:latencies[Math.floor(count/2)],maxLatencyMs:latencies.at(-1),
 scope:'read-only, 1 request/second, no historical worker configuration changes'};
console.log(JSON.stringify(output));
if(output.errors)process.exitCode=1;
