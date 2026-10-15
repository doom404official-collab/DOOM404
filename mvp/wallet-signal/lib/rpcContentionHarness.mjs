// Deterministic concurrent reservation harness. No Helius traffic is generated.
export async function simulateRpcContention({reserve,workers=4,requestsPerWorker=20}={}){
 if(typeof reserve!=='function'||!Number.isInteger(workers)||workers<1||!Number.isInteger(requestsPerWorker)||requestsPerWorker<1)
  throw new TypeError('Invalid contention test parameters');
 const results=await Promise.all(Array.from({length:workers},async(_,worker)=>{
  let granted=0,denied=0;
  for(let i=0;i<requestsPerWorker;i++){
   if(await reserve({worker,index:i}))granted++;else denied++;
  }
  return {worker,granted,denied};
 }));
 return {workers,attempted:workers*requestsPerWorker,granted:results.reduce((s,r)=>s+r.granted,0),
 denied:results.reduce((s,r)=>s+r.denied,0),results};
}
