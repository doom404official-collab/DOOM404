import {validateLiquidityCheckpoint} from "./liquidityEvidenceCheckpoint.mjs";
export async function appendLiquiditySnapshot(evidence,{url,serviceRoleKey,fetchImpl=fetch}={}){
 validateLiquidityCheckpoint(evidence);
 if(!url||!serviceRoleKey)throw Error("LIQUIDITY_STORAGE_NOT_CONFIGURED");
 const response=await fetchImpl(url.replace(/\/$/,"")+"/rest/v1/liquidity_evidence_snapshots",{
  method:"POST",
  headers:{apikey:serviceRoleKey,authorization:"Bearer "+serviceRoleKey,"content-type":"application/json",prefer:"return=minimal"},
  body:JSON.stringify({mint:evidence.mint,observed_at:evidence.observedAt,status:evidence.status,evidence}),
  signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error("LIQUIDITY_SNAPSHOT_WRITE_FAILED_"+response.status);
 return true;
}
