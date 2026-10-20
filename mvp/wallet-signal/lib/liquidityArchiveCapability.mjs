export function classifyArchiveCapability(response,{requestedSlot}={}){
 const error=response?.error;
 if(error){
  const message=String(error.message??"").toLowerCase();
  const status=error.code===-32020?"OUT_OF_COVERAGE":/plan|upgrade|paid|subscription|not enabled|permission/.test(message)?"PLAN_RESTRICTED":error.code===-32602?"UNSUPPORTED_OR_INVALID_PARAMETERS":"PROVIDER_ERROR";
  return {status,errorCode:Number.isInteger(error.code)?error.code:null,historicalStateVerified:false};
 }
 const contextSlot=response?.result?.context?.slot;
 const accountPresent=Boolean(response?.result?.value);
 if(!Number.isSafeInteger(contextSlot)||!Number.isSafeInteger(requestedSlot))return {status:"UNVERIFIABLE_RESPONSE",historicalStateVerified:false};
 return {status:contextSlot>requestedSlot?"LATER_CONTEXT_UNVERIFIED":"HISTORICAL_RESPONSE_CANDIDATE",requestedSlot,contextSlot,accountPresent,historicalStateVerified:false,warning:"Historical state remains unverified until provider semantics, account ownership, and returned bytes are independently checked."};
}
