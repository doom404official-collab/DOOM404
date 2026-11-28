export async function probeHistoricalAccountRpc({rpcUrl,account,slot,fetchImpl=fetch}={}){
 if(!rpcUrl||!/^https:\/\//.test(rpcUrl))return {status:"NOT_CONFIGURED",historicalStateVerified:false};
 if(!Number.isSafeInteger(slot)||slot<=0||typeof account!=="string")return {status:"INVALID_INPUT",historicalStateVerified:false};
 try{
  const response=await fetchImpl(rpcUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:[account,{encoding:"base64",slot}]}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)return {status:"HTTP_ERROR",httpStatus:response.status,historicalStateVerified:false};
  const data=await response.json();
  if(data.error)return {status:"RPC_ERROR",errorCode:data.error.code??null,historicalStateVerified:false};
  const contextSlot=data.result?.context?.slot;
  return {status:"RESPONSE_UNVERIFIED",contextSlot:Number.isSafeInteger(contextSlot)?contextSlot:null,requestedSlot:slot,accountPresent:Boolean(data.result?.value),historicalStateVerified:false,warning:"Standard Solana RPC may ignore the nonstandard slot parameter; this does not prove historical state."};
 }catch{return {status:"REQUEST_FAILED",historicalStateVerified:false};}
}
