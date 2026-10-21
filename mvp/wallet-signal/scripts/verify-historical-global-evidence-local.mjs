import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePinnedGlobalCandidate} from '../lib/pumpFunPinnedGlobalDecoder.mjs';

// Offline only: supply a restricted archival RPC response as a local file.
// Never commit the input or resulting report to the repository.
const expectedHash='9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30';
const expectedSlot=442809233;
const file=process.argv[2];
if(!file)throw Error('Expected a local archival RPC JSON response file');
const response=JSON.parse(readFileSync(file,'utf8'));
if(response.error||response.result?.context?.slot!==expectedSlot)throw Error('HISTORICAL_CONTEXT_UNVERIFIED');
const account=response.result?.value;
if(!account||!Array.isArray(account.data)||account.data[1]!=='base64')throw Error('ACCOUNT_DATA_UNAVAILABLE');
const encoded=account.data[0];
if(typeof encoded!=='string'||encoded.length===0||encoded.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw Error('ACCOUNT_BASE64_INVALID');
const bytes=Buffer.from(encoded,'base64');
if(bytes.toString('base64')!==encoded)throw Error('ACCOUNT_BASE64_NONCANONICAL');
if(bytes.length!==1045)throw Error('ACCOUNT_LENGTH_MISMATCH');
const digest=createHash('sha256').update(bytes).digest('hex');
if(digest!==expectedHash)throw Error('HISTORICAL_HASH_MISMATCH');
const candidate=decodePinnedGlobalCandidate(bytes);
if(candidate.status!=='CANDIDATE_DECODED_UNVERIFIED')throw Error('CANDIDATE_DECODE_FAILED');
const fields=['fee_recipient','fee_recipients','reserved_fee_recipient','reserved_fee_recipients','buyback_fee_recipients'];
const report={status:'CANDIDATE_DECODED_UNVERIFIED',slot:expectedSlot,sha256:digest,recipients:Object.fromEntries(fields.map(k=>[k,candidate.fields[k]])),layoutVersionVerified:false,historicalStateVerified:false,feeRecipientRolesVerified:false,eligibleForLivePromotion:false};
const output=process.env.GLITCH_RESTRICTED_REPORT;
if(output)writeFileSync(output,JSON.stringify(report,null,2),{mode:0o600,flag:'wx'});
console.log(JSON.stringify({status:report.status,slot:expectedSlot,sha256:digest,recipientFields:fields,eligibleForLivePromotion:false}));
