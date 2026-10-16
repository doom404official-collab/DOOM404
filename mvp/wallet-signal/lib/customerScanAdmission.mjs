// Testable customer admission orchestration; no browser-controlled identity or RPC URL.
export async function admitCustomerScan({mint,authorization,enabled,verifyUser,store,lockManager,quota,prepareSnapshot}={}){
 if(!enabled)return {status:503,body:{status:'disabled'}};
 if(!mint)return {status:400,body:{error:'invalid_mint'}};
 const user=await verifyUser(authorization);
 if(!user?.id)return {status:401,body:{error:'authentication_required'}};
 const active=['queued','running','partial'];
 const existing=await store.getLatest(mint);
 if(existing&&active.includes(existing.status))
  return {status:202,body:{mint,status:existing.status,jobId:existing.id,reused:true}};
 const lock=await lockManager.acquire(mint);
 if(!lock)return {status:202,body:{mint,status:'preparing',reused:true}};
 try{
  const current=await store.getLatest(mint);
  if(current&&active.includes(current.status))
   return {status:202,body:{mint,status:current.status,jobId:current.id,reused:true}};
  if(!await quota.admit({requesterId:user.id,mint}))
   return {status:429,body:{error:'scan_quota_exceeded'}};
  const snapshot=await prepareSnapshot(mint);
  const job=await store.createOrReuse(snapshot);
  return {status:202,body:{mint,status:job.status,jobId:job.id,reused:false}};
 }finally{
  // Lock release failure must not conceal successful persistence.
  try{await lockManager.release(lock);}catch{ /* TTL provides recovery */ }
 }
}
