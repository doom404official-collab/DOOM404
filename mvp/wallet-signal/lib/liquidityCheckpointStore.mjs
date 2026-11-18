import {validateLiquidityStorage,liquidityStorageRequest} from "./liquidityStorageTransport.mjs";
import { validateLiquidityCheckpoint } from "./liquidityEvidenceCheckpoint.mjs";
export async function persistLiquidityCheckpoint(evidence, { url, serviceRoleKey, fetchImpl = fetch, signal, timeoutMs } = {}) {
 validateLiquidityCheckpoint(evidence);
 const origin=validateLiquidityStorage({url,serviceRoleKey});
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
 return liquidityStorageRequest(origin+"/rest/v1/liquidity_evidence_checkpoints?on_conflict=mint",{
  method:"POST",
  headers:{
   apikey:serviceRoleKey,
   authorization:"Bearer "+serviceRoleKey,
   "content-type":"application/json",
   prefer:"resolution=merge-duplicates,return=minimal"
  },
  body:JSON.stringify(row)
 },{fetchImpl,signal,timeoutMs,label:"LIQUIDITY_CHECKPOINT_WRITE"});
}
