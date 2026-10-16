// Bounded real-history RPC diagnostic. No token balances or production checkpoints are modified.
// Fixed 3 requests/second for 10 seconds, getSignaturesForAddress on a known mint.
const endpoint=process.env.HELIUS_RPC_URL;
const mint=process.env.TEST_TOKEN_MINT||'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
if(!endpoint?.startsWith('https://')||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)){console.error('Diagnostic configuration invalid');process.exit(2);}
const rate=3,seconds=10,results=[];
for(let second=0;second<seconds;second++){
 const started=Date.now();
 const batch=await Promise.all(Array.from({length:rate},async(_,i)=>{
  const t=Date.now();
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:second*rate+i+1,method:'getSignaturesForAddress',
     params:[mint,{limit:10}]}),signal:AbortSignal.timeout(8000)});
   const body=response.ok?await response.json():null;
   return {ok:response.ok&&Array.isArray(body?.result),rateLimited:response.status===429,latencyMs:Date.now()-t};
  }catch{return {ok:false,rateLimited:false,latencyMs:Date.now()-t};}
 }));
 results.push(...batch);
 if(batch.some(x=>!x.ok))break;
 const wait=Math.max(0,1000-(Date.now()-started));
 if(wait)await new Promise(r=>setTimeout(r,wait));
}
const sorted=results.map(x=>x.latencyMs).sort((a,b)=>a-b);
const output={method:'getSignaturesForAddress',requestedRps:rate,plannedSeconds:seconds,
 attempted:results.length,success:results.filter(x=>x.ok).length,
 rateLimited:results.filter(x=>x.rateLimited).length,errors:results.filter(x=>!x.ok).length,
 medianLatencyMs:sorted[Math.floor(sorted.length/2)]??null,maxLatencyMs:sorted.at(-1)??null,
 scope:'read-only bounded diagnostic; no historical worker or checkpoint changes'};
console.log(JSON.stringify(output));
if(output.errors)process.exitCode=1;
