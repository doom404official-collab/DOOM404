/** Read-only Alchemy archive capability check for the confirmed Creator buy slot.
 * Does not decode account data or assert historical fee authorization.
 */
const url=process.env.ALCHEMY_RPC_URL;
if(!url||!/^https:\/\//.test(url))throw Error('ALCHEMY_RPC_URL_MISSING');
const slot=442809233;
const global='4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf';
const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[global,{encoding:'base64',commitment:'finalized',slot}]}),signal:AbortSignal.timeout(20000)});
if(!response.ok){console.log(JSON.stringify({status:'PROVIDER_HTTP_ERROR',httpStatus:response.status,slot,historicalStateVerified:false,feeRecipientRolesVerified:false}));process.exit(0);}
const data=await response.json();
const contextSlot=data.result?.context?.slot??null;
const hasAccount=Boolean(data.result?.value);
const supported=Number.isSafeInteger(contextSlot)&&contextSlot===slot&&hasAccount&&!data.error;
console.log(JSON.stringify({status:data.error?'PROVIDER_RPC_ERROR':supported?'SLOT_MATCHED_ACCOUNT_RESPONSE':'HISTORICAL_CAPABILITY_UNVERIFIED',slot,contextSlot,accountPresent:hasAccount,ownerMatches,discriminatorMatches,accountDataBytes:bytes?.length??null,accountDataSha256:accountHash,accountLayoutValidated:layoutReady,historicalStateVerified:false,rpcErrorCode:data.error?.code??null,rpcErrorMessage:typeof data.error?.message==='string'?data.error.message.slice(0,180):null,historicalStateVerified:false,feeRecipientRolesVerified:false,eligibleForLivePromotion:false}));
