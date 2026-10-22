import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectCreatorArchiveAccountResponse} from '../lib/creatorArchiveAccountDiagnostic.mjs';

// Manual-only read-only capture. Never upload the output to public CI artifacts.
const url=process.env.ALCHEMY_RPC_URL;
const output=process.env.GLITCH_RESTRICTED_CAPTURE;
if(!url||!url.startsWith('https://'))throw Error('ALCHEMY_RPC_URL_MISSING');
if(!output)throw Error('GLITCH_RESTRICTED_CAPTURE_MISSING');
const slot=442809233;
const accountAddress='4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf';
const expectedHash='9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30';
const request={jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[accountAddress,{encoding:'base64',commitment:'finalized',slot}]};
const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error('ARCHIVE_HTTP_ERROR_'+response.status);
const data=await response.json();
if(data?.jsonrpc!=='2.0'||data?.id!==request.id||data?.error)throw Error('ARCHIVE_RPC_ENVELOPE_INVALID');
const diagnosis=inspectCreatorArchiveAccountResponse({data,slot});
if(diagnosis.status!=='SLOT_MATCHED_ACCOUNT_RESPONSE'||!diagnosis.accountHeaderMatches||diagnosis.accountDataBytes!==1045||diagnosis.accountDataSha256!==expectedHash)throw Error('HISTORICAL_ACCOUNT_EVIDENCE_MISMATCH');
const capture={capture:{method:request.method,accountAddress,requestedSlot:slot,commitment:'finalized',capturedAt:new Date().toISOString(),rpcProvider:'alchemy',requestSha256:createHash('sha256').update(JSON.stringify(request)).digest('hex')},result:data.result};
writeFileSync(output,JSON.stringify(capture),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'RESTRICTED_CAPTURE_SAVED',slot,accountDataSha256:diagnosis.accountDataSha256,accountDataBytes:diagnosis.accountDataBytes,feeRecipientRolesVerified:false,eligibleForLivePromotion:false}));
