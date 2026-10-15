// Server-only Supabase persistence adapter. Never expose service-role credentials to clients.
// REST writes use the snapshot ID as an idempotency key; rank data is immutable after insertion.
export function createTop20Vault({url,serviceRoleKey,fetchImpl=fetch}={}) {
 if(!/^https:\/\//.test(url??'')||!serviceRoleKey)throw new TypeError('Supabase URL and server-side key required');
 const parsed=new URL(url);
 if(parsed.pathname!=='/' || parsed.search || parsed.hash || parsed.username || parsed.password)
  throw new TypeError('SUPABASE_URL must be the project origin without path or query');
 const endpoint=parsed.origin+'/rest/v1/';
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,'Content-Type':'application/json'};
 async function request(table,{method='GET',query='',body,prefer}={}){
  const response=await fetchImpl(endpoint+table+query,{method,headers:{...headers,...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok){
   let providerCode='UNKNOWN';
   try {const payload=await response.json();if(/^PGRST[0-9]{3}$/.test(payload?.code??''))providerCode=payload.code;}catch{}
   throw new Error('VAULT_'+table.toUpperCase()+'_HTTP_'+response.status+'_'+providerCode);
  }
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
   if(stored?.length!==1)throw new Error('Frozen snapshot row count mismatch');
   const row=stored[0];
   if(row.id!==snapshot.id||row.mint!==snapshot.mint||Number(row.snapshot_slot)!==snapshot.slot||
    String(row.supply_raw)!==String(snapshot.supply)||!Array.isArray(row.holder_ranking)||
    row.holder_ranking.length!==snapshot.holders.length||
    row.holder_ranking.some((h,i)=>h.wallet!==snapshot.holders[i].wallet||
      Number(h.balance)!==snapshot.holders[i].balance||Number(h.rank)!==snapshot.holders[i].rank))
    throw new Error('Frozen snapshot persistence mismatch');
   return snapshot.id;
  },
  async getFrozen(snapshotId){
   const rows=await request('glitch_top20_snapshots',{query:'?id=eq.'+encodeURIComponent(snapshotId)+'&select=id,mint,snapshot_slot,supply_raw,holder_ranking,excluded_wallets,status'});
   if(rows?.length!==1)throw new Error('Frozen snapshot not found');
   return rows[0];
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
