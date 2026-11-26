import {writeFileSync} from 'node:fs';
import {aggregateHolderInventory,buildCanonicalHolderSnapshot,normalizeBinaryHolderInventory} from '../lib/canonicalHolderSnapshot.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const token='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const endpoint=process.env.HELIUS_RPC_URL;
let requests=0;
async function rpc(method,params){
 if(++requests>3)throw Error('SNAPSHOT_REQUEST_BUDGET_EXHAUSTED');
 const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:requests,method,params}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('SNAPSHOT_PROVIDER_HTTP_FAILURE');
 const body=await response.text();if(body.length>128000000)throw Error('SNAPSHOT_RESPONSE_TOO_LARGE');
 const data=JSON.parse(body);if(data.error||!data.result)throw Error('SNAPSHOT_PROVIDER_RESPONSE_INVALID');return data.result;
}
try{
 if(!endpoint?.startsWith('https://'))throw Error('HELIUS_ACCESS_UNAVAILABLE');
 const mintResponse=await rpc('getAccountInfo',[mint,{commitment:'finalized',encoding:'jsonParsed'}]);
 const binaryInventory=await rpc('getProgramAccounts',[token,{commitment:'finalized',encoding:'base64',dataSlice:{offset:0,length:166},withContext:true,
  minContextSlot:mintResponse.context.slot,filters:[{memcmp:{offset:0,bytes:mint}}]}]);
 const inventory=normalizeBinaryHolderInventory({mint,response:binaryInventory});
 writeFileSync('canonical-holder-snapshot-recovery.json',JSON.stringify({schemaVersion:1,status:'INVENTORY_CAPTURED_CLASSIFICATION_PENDING',mint,
  observedAt:new Date().toISOString(),provider:'helius',commitment:'finalized',mintResponse,inventory}),{flag:'wx',mode:0o600});
 const ranked=aggregateHolderInventory({mint,inventory});
 const ownerAddresses=ranked.ranking.slice(0,100).map(w=>w.wallet);
 const ownerResponse=await rpc('getMultipleAccounts',[ownerAddresses,{commitment:'finalized',encoding:'base64',minContextSlot:inventory.context.slot}]);
 const result=buildCanonicalHolderSnapshot({mint,observedAt:new Date().toISOString(),mintResponse,inventory,ownerResponse,ownerAddresses,provider:'helius'});
 writeFileSync('canonical-holder-snapshot.json',JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({status:'CAPTURED_NOT_YET_PERSISTED',holderSetHash:result.snapshot.holderSetHash,requests,atomic:false,
  eligibleHolders:20,inventoryAccounts:result.snapshot.inventoryAccountCount}));
}catch(error){console.log(JSON.stringify({status:'SNAPSHOT_NOT_ESTABLISHED',requests,reason:/^[A-Z_]+$/.test(error.message)?error.message:'CAPTURE_FAILED'}));process.exitCode=1;}
