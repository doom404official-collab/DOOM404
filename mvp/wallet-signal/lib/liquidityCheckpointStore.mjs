import { validateLiquidityCheckpoint } from "./liquidityEvidenceCheckpoint.mjs";
export async function persistLiquidityCheckpoint(evidence, { url, serviceRoleKey, fetchImpl = fetch } = {}) {
 validateLiquidityCheckpoint(evidence);
 if (!url || !serviceRoleKey) throw Error("LIQUIDITY_STORAGE_NOT_CONFIGURED");
 const row = {
  mint:evidence.mint,
  schema_version:1,
  status:evidence.status,
  observed_at:evidence.observedAt,
  reported_pool_count:evidence.providerReportedPools,
  checked_pool_count:evidence.pools.length,
  evidence,
  updated_at:new Date().toISOString()
 };
 const response = await fetchImpl(url.replace(/\/$/,"")+"/rest/v1/liquidity_evidence_checkpoints?on_conflict=mint",{
  method:"POST",
  headers:{
   apikey:serviceRoleKey,
   authorization:"Bearer "+serviceRoleKey,
   "content-type":"application/json",
   prefer:"resolution=merge-duplicates,return=minimal"
  },
  body:JSON.stringify(row),
  signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error("LIQUIDITY_CHECKPOINT_WRITE_FAILED_"+response.status);
 return true;
}
