import {writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {decodeArchivedPumpAccount} from '../lib/liquidityArchiveStateDecoder.mjs';
const signature='61NV8BsnCRB6AnXUeFqRvLB1VysGivC4Ha9TxQZBE7pZQWee8dYsr9F2a4b21AvoCuUV8kKFmZNVdiPY3dkQQ449',slot=458811200;
const targets=[{address:'6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA',role:'pump_amm_pool'},{address:'ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw',role:'pump_amm_global_config'}];
const helius=process.env.HELIUS_RPC_URL,alchemy=process.env.ALCHEMY_SOLANA_ARCHIVE_RPC_URL;
let transactionReads=0,historicalAccountReads=0;const records=[];let transaction;
const save=()=>writeFileSync('lq09-reconciliation-evidence.json',JSON.stringify({schemaVersion:1,signature,requestedSlot:slot,transactionReads,historicalAccountReads,provider:'alchemy',providerSemanticsReference:'https://www.alchemy.com/docs/solana/account-archive',semantics:'State as of finalized slot, inclusive latest write at or before slot; not minContextSlot',records,transaction,historicalStateCryptographicallyCertified:false,authorizationVerified:false,withdrawalConfirmed:false,scorePromoted:false},null,2)+'\n',{mode:0o600});
async function rpc(endpoint,method,params){
 if(!endpoint?.startsWith('https://'))throw Error('EXISTING_PROVIDER_ACCESS_UNAVAILABLE');
 const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('PROVIDER_HTTP_FAILURE');const body=await response.text();if(body.length>2000000)throw Error('PROVIDER_RESPONSE_TOO_LARGE');const json=JSON.parse(body);if(json.error)throw Error('PROVIDER_RPC_FAILURE');return {result:json.result,responseSha256:createHash('sha256').update(body).digest('hex')};
}
try{
 if(!helius?.startsWith('https://')||!alchemy?.startsWith('https://'))throw Error('EXISTING_PROVIDER_ACCESS_UNAVAILABLE');
 transactionReads++;transaction=(await rpc(helius,'getTransaction',[signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:1}])).result;
 if(transaction?.slot!==slot||transaction?.transaction?.signatures?.[0]!==signature||transaction?.meta?.err!==null)throw Error('FEE_SWEEP_TRANSACTION_IDENTITY_MISMATCH');
 save();
 for(const target of targets){
  if(historicalAccountReads>=2)throw Error('HISTORICAL_ACCOUNT_READ_BUDGET_EXHAUSTED');historicalAccountReads++;save();
  const r=await rpc(alchemy,'getAccountInfo',[target.address,{encoding:'base64',commitment:'finalized',slot}]);
  const value=r.result?.value,contextSlot=r.result?.context?.slot;const decoded=decodeArchivedPumpAccount(value,target.role);
  const bytes=Array.isArray(value?.data)&&value.data[1]==='base64'?Buffer.from(value.data[0],'base64'):null;
  records.push({...target,requestedSlot:slot,contextSlot,responseSha256:r.responseSha256,account:value,accountDataSha256:bytes?createHash('sha256').update(bytes).digest('hex'):null,decodedCandidate:decoded,observedAt:new Date().toISOString(),providerHistoricalSlotSemanticsConfirmed:contextSlot===slot});save();
  if(contextSlot!==slot)throw Error('HISTORICAL_SLOT_SEMANTICS_UNVERIFIED');if(decoded.status!=='DECODED')throw Error('HISTORICAL_LAYOUT_UNVERIFIED');
 }
 console.log(JSON.stringify({status:'BOUNDED_HISTORICAL_BYTES_RETAINED',transactionReads,historicalAccountReads,authorizationVerified:false}));
}catch(error){save();console.log(JSON.stringify({status:'STOP_RECONCILE_NO_RETRY',transactionReads,historicalAccountReads,reason:/^[A-Z_]+$/.test(error.message)?error.message:'CAPTURE_FAILED'}));process.exitCode=1;}
