// Server-only Supabase persistence adapter. Never expose service-role credentials to clients.
// REST writes use the snapshot ID as an idempotency key; rank data is immutable after insertion.
export function createTop20Vault({url,serviceRoleKey,fetchImpl=fetch}={}) {
 if(!/^https:\/\//.test(url??'')||!serviceRoleKey)throw new TypeError('Supabase URL and server-side key required');
 const endpoint=url.replace(/\/$/,'')+'/rest/v1/';
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,'Content-Type':'application/json'};
 async function request(table,{method='GET',query='',body,prefer}={}){
  const response=await fetchImpl(endpoint+table+query,{method,headers:{...headers,...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw new Error('VAULT_'+table.toUpperCase()+'_HTTP_'+response.status);
  const text=await response.text();
  return text?JSON.parse(text):null;
 }
 return {
  async saveFrozen(snapshot){
   const row={id:snapshot.id,mint:snapshot.mint,snapshot_slot:snapshot.slot,
    supply_raw:String(snapshot.supply),holder_ranking:snapshot.holders,
    excluded_wallets:snapshot.excludedWallets??[],status:'frozen'};
   await request('glitch_top20_snapshots',{method:'POST',body:row,prefer:'resolution=ignore-duplicates,return=minimal'});
   const stored=await request('glitch_top20_snapshots',{query:'?id=eq.'+encodeURIComponent(snapshot.id)+'&select=id,mint,snapshot_slot,supply_raw,holder_ranking'});
   if(stored?.length!==1||JSON.stringify(stored[0].holder_ranking)!==JSON.stringify(snapshot.holders)||
    stored[0].mint!==snapshot.mint||String(stored[0].supply_raw)!==String(snapshot.supply))
    throw new Error('Frozen snapshot persistence mismatch');
   return snapshot.id;
  },
  async saveBatch({snapshotId,startIndex,results,coverage,status='complete'}){
   if(![0,5,10,15].includes(startIndex)||!['complete','partial','failed'].includes(status))
    throw new TypeError('Invalid batch');
   if(!Array.isArray(results)||!coverage||typeof coverage!=='object')throw new TypeError('Invalid batch evidence');
   const existing=await request('glitch_top20_batches',{query:'?snapshot_id=eq.'+encodeURIComponent(snapshotId)+'&start_index=eq.'+startIndex+'&select=status,wallet_results,coverage'});
   if(existing?.length){
    if(existing.length!==1 || existing[0].status!==status ||
      JSON.stringify(existing[0].wallet_results)!==JSON.stringify(results) ||
      JSON.stringify(existing[0].coverage)!==JSON.stringify(coverage))
      throw new Error('Existing batch differs; explicit retry/version handling required');
    return {status:'already_saved'};
   }
   await request('glitch_top20_batches',{method:'POST',
    body:{snapshot_id:snapshotId,start_index:startIndex,batch_size:5,status,wallet_results:results,coverage},
    prefer:'return=minimal'});
   return {status:'saved'};
  },
  async getBatches(snapshotId){
   return request('glitch_top20_batches',{query:'?snapshot_id=eq.'+encodeURIComponent(snapshotId)+'&select=*&order=start_index.asc'});
  }
 };
}
