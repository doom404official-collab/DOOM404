import {validateLiquidityStorage,liquidityStorageRequest} from "./liquidityStorageTransport.mjs";
import {validateLiquidityCheckpoint} from "./liquidityEvidenceCheckpoint.mjs";
export async function appendLiquiditySnapshot(evidence,{url,serviceRoleKey,fetchImpl=fetch,signal,timeoutMs}={}){
 validateLiquidityCheckpoint(evidence);
 const origin=validateLiquidityStorage({url,serviceRoleKey});
 return liquidityStorageRequest(origin+"/rest/v1/liquidity_evidence_snapshots",{
  method:"POST",
  headers:{apikey:serviceRoleKey,authorization:"Bearer "+serviceRoleKey,"content-type":"application/json",prefer:"return=minimal"},
  body:JSON.stringify({mint:evidence.mint,observed_at:evidence.observedAt,status:evidence.status,evidence})
 },{fetchImpl,signal,timeoutMs,label:"LIQUIDITY_SNAPSHOT_WRITE"});
}
