import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHolderHistoryCheckpoint,recordHistoryPage,recordDecodedTransaction,summarizeHistoryCheckpoint} from "../lib/holderHistoryCheckpoint.mjs";
import {collectWalletSignaturePage} from "../lib/holderHistoryPagination.mjs";
import {extractDirectHolderTransfers} from "../lib/directHolderTransfers.mjs";

// Read-only RPC scan. Local JSON artifact is not a Supabase write.
// Resume only from an explicitly supplied, validated checkpoint file.
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const endpoint=process.env.HELIUS_RPC_URL;
if(!endpoint)throw Error("RPC_NOT_CONFIGURED");
const out="artifacts/holder-history-checkpoint.json";
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let requests=0,last=0,retries=0;
async function rpc(method,params){
 for(let n=0;n<3;n++){
  if(requests>=65)throw Error("REQUEST_BUDGET_EXHAUSTED");
  const wait=Math.max(0,500-(Date.now()-last));if(wait)await delay(wait);
  last=Date.now();
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({jsonrpc:"2.0",id:++requests,method,params}),signal:AbortSignal.timeout(12000)});
  if(response.status===429){retries++;if(n===2)throw Error("RPC_RATE_LIMITED");await delay(1000*2**n);continue;}
  if(!response.ok)throw Error("RPC_HTTP_"+response.status);
  const payload=await response.json();if(payload.error){const code=Number.isInteger(payload.error.code)?payload.error.code:"UNKNOWN";throw Error("RPC_"+method+"_ERROR_"+code); }
  return payload.result;
 }
}
let cp=null,reason=null;
try{
 if(process.env.HOLDER_CHECKPOINT_PATH){
  const loaded=JSON.parse(await readFile(process.env.HOLDER_CHECKPOINT_PATH,"utf8"));
  if(loaded?.version!==1||loaded.mint!==mint||!Array.isArray(loaded.holders)||loaded.holders.length!==20||
    !loaded.wallets||!loaded.signatures||!loaded.edges)throw Error("INVALID_RESUME_CHECKPOINT");
  const walletSet=new Set(loaded.holders.map(x=>x.ownerWallet));
  if(walletSet.size!==Object.keys(loaded.wallets).length||[...walletSet].some(x=>!Object.hasOwn(loaded.wallets,x)))
   throw Error("INVALID_RESUME_HOLDERS");
  cp=loaded;
 }else{
  const largest=await rpc("getTokenLargestAccounts",[mint,{commitment:"confirmed"}]);
  const supply=await rpc("getTokenSupply",[mint,{commitment:"confirmed"}]);
  const total=BigInt(supply?.value?.amount||"0");
  if(total<=0n||(largest?.value||[]).length!==20)throw Error("INVALID_TOP20");
  const holders=[];
  for(const row of largest.value){
   const info=await rpc("getAccountInfo",[String(row.address),{encoding:"jsonParsed",commitment:"confirmed"}]);
   const owner=info?.value?.data?.parsed?.info?.owner;
   if(typeof owner!=="string")throw Error("OWNER_NOT_RESOLVED");
   holders.push({tokenAccount:String(row.address),ownerWallet:owner,
    sharePct:Number(BigInt(row.amount)*1000000n/total)/10000});
  }
  cp=createHolderHistoryCheckpoint({mint,holders});
 }
 // First decode outstanding signatures, then paginate. Never skip failed signatures as complete.
 async function decodePending(){
  for(const [sig,state] of Object.entries(cp.signatures)){
   if(state!=="pending")continue;
   const tx=await rpc("getTransaction",[sig,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
   if(!tx){recordDecodedTransaction(cp,{signature:sig,error:"TRANSACTION_UNAVAILABLE"});continue;}
   const transfers=extractDirectHolderTransfers({transaction:tx,signature:sig,
    holderWallets:Object.keys(cp.wallets),tokenAccounts:cp.holders});
   recordDecodedTransaction(cp,{signature:sig,transfers});
  }
 }
 await decodePending();
 for(const wallet of Object.keys(cp.wallets)){
  if(cp.wallets[wallet].exhausted)continue;
  const page=await collectWalletSignaturePage({wallet,cursor:cp.wallets[wallet].cursor,limit:10,
   fetchPage:(address,opts)=>rpc("getSignaturesForAddress",[address,{limit:opts.limit,
    ...(opts.before?{before:opts.before}:{}),commitment:"confirmed"}])});
  recordHistoryPage(cp,{wallet,page});
  await decodePending();
 }
}catch(e){reason=String(e.message||"UNKNOWN_ERROR");}
if(cp){
 await mkdir("artifacts",{recursive:true});
 await writeFile(out,JSON.stringify(cp));
}
console.log(JSON.stringify({status:reason?"PARTIAL_OR_FAILED":"CHECKPOINT_SAVED",
 reason,checkpointSaved:Boolean(cp),requestCount:requests,rateLimitRetries:retries,
 ...(cp?summarizeHistoryCheckpoint(cp):{}),writeAttempted:false}));
if(!cp)process.exitCode=2;
