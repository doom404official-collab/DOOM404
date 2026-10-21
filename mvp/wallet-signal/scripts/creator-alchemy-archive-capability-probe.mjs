import {inspectCreatorArchiveAccountResponse} from '../lib/creatorArchiveAccountDiagnostic.mjs';
/** Read-only Alchemy archive capability check for the confirmed Creator buy slot.
 * Does not decode account data or assert historical fee authorization.
 */
const url=process.env.ALCHEMY_RPC_URL;
if(!url||!/^https:\/\//.test(url))throw Error('ALCHEMY_RPC_URL_MISSING');
const slot=442809233;
const global='4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf';
const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[global,{encoding:'base64',commitment:'finalized',slot}]}),signal:AbortSignal.timeout(20000)});
if(!response.ok){console.log(JSON.stringify({status:'PROVIDER_HTTP_ERROR',httpStatus:response.status,slot,accountHeaderMatches:false,accountLayoutValidated:false,historicalStateVerified:false,feeRecipientRolesVerified:false,eligibleForLivePromotion:false}));process.exit(0);}
const data=await response.json();
console.log(JSON.stringify(inspectCreatorArchiveAccountResponse({data,slot})));
