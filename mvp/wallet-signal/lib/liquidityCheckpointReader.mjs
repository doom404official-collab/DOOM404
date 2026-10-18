export async function readLiquidityCheckpoint(mint, options = {}) {
 const {url, serviceRoleKey, fetchImpl=fetch}=options;
 if(!url || !serviceRoleKey) throw Error("LIQUIDITY_STORAGE_NOT_CONFIGURED");
 const endpoint=url.replace(/\/$/,"")+"/rest/v1/liquidity_evidence_checkpoints?mint=eq."+encodeURIComponent(mint)+"&select=evidence&limit=1";
 const response=await fetchImpl(endpoint,{
  headers:{apikey:serviceRoleKey,authorization:"Bearer "+serviceRoleKey},
  signal:AbortSignal.timeout(12000)
 });
 if(!response.ok) throw Error("LIQUIDITY_CHECKPOINT_READ_FAILED_"+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows)) throw Error("LIQUIDITY_CHECKPOINT_INVALID_RESPONSE");
 return rows[0]?.evidence??null;
}
