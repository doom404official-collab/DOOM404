/** Preview-only, bounded Pump.fun metadata schema inspection.
 * Public field names and signature values only; no raw responses or secrets.
 */
const allowed=process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e";
const mints=(process.env.CREATOR_MATRIX_MINTS||"").split(",").map(x=>x.trim()).filter(Boolean);
const valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if(!allowed) console.log("PUMPFUN_SCHEMA_MATRIX: SKIPPED_NON_TARGET_ENV");
else if(mints.length!==5||!mints.every(x=>valid.test(x))) console.log("PUMPFUN_SCHEMA_MATRIX: SKIPPED_NOT_CONFIGURED");
else {
  const fields=["creator","created_timestamp","creation_signature","create_tx","creation_tx","creation_transaction","signature","tx_signature","deployment_signature"];
  const results=[];
  for(const mint of mints){
    try{
      const response=await fetch("https://frontend-api-v3.pump.fun/coins-v2/"+mint,{
        headers:{accept:"application/json"},signal:AbortSignal.timeout(10000),cache:"no-store"});
      if(!response.ok){results.push({mint,status:response.status===429?"RATE_LIMITED":response.status===404?"NOT_FOUND":"HTTP_ERROR"});continue;}
      const data=await response.json();
      if(data?.mint!==mint){results.push({mint,status:"MINT_MISMATCH"});continue;}
      results.push({mint,status:"OK",presentFields:fields.filter(k=>Object.hasOwn(data,k)),
        candidateSignatures:fields.filter(k=>/signature|create_tx|creation_tx/.test(k))
          .filter(k=>typeof data[k]==="string"&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(data[k]))
          .map(k=>({field:k,signature:data[k]}))});
    }catch{results.push({mint,status:"PROVIDER_ERROR"});}
  }
  console.log("PUMPFUN_SCHEMA_MATRIX:",JSON.stringify({total:results.length,results}));
}
