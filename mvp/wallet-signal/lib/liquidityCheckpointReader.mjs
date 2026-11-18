import {validateLiquidityStorage,liquidityStorageRequest} from "./liquidityStorageTransport.mjs";
export async function readLiquidityCheckpoint(mint, options = {}) {
 const {url, serviceRoleKey, fetchImpl=fetch,signal,timeoutMs}=options;
 const origin=validateLiquidityStorage({url,serviceRoleKey});
 const endpoint=origin+"/rest/v1/liquidity_evidence_checkpoints?mint=eq."+encodeURIComponent(mint)+"&select=evidence&limit=1";
 const rows=await liquidityStorageRequest(endpoint,{
  headers:{apikey:serviceRoleKey,authorization:"Bearer "+serviceRoleKey}
 },{fetchImpl,signal,timeoutMs,json:true,label:"LIQUIDITY_CHECKPOINT_READ"});
 if(!Array.isArray(rows)||rows.length>1) throw Error("LIQUIDITY_CHECKPOINT_INVALID_RESPONSE");
 return rows[0]?.evidence??null;
}
