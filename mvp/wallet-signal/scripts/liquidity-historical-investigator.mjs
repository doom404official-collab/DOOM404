import {decodeHistoricalCandidate,validateHistoryCheckpoint,classifyHistoricalTransaction,inspectHistoricalSignerEvidence,historicalRoleAssessment} from "../lib/liquidityHistoricalDecoder.mjs";
import {retrieveHistoricalTransaction} from "../lib/liquidityHistoricalTransactionCompat.mjs";
import {writeFile,readFile} from "node:fs/promises";
const pool=process.env.GLITCH_LIQUIDITY_POOL;
const rpc=process.env.HELIUS_RPC_URL;
const fallback=process.env.ALCHEMY_RPC_URL;
const budgetInput=Number(process.env.GLITCH_HISTORY_BUDGET||60);
const pageInput=Number(process.env.GLITCH_HISTORY_PAGE_SIZE||25);
if(!Number.isSafeInteger(budgetInput)||budgetInput<2||!Number.isSafeInteger(pageInput)||pageInput<1)throw Error("INVALID_HISTORY_BOUNDS");
const limit=Math.min(200,budgetInput);
const pageSize=Math.min(100,pageInput,limit-1);
const output=process.env.GLITCH_HISTORY_OUTPUT||"liquidity-history-evidence.json";
if(!pool||!rpc||!/^https:\/\//.test(rpc)||!Number.isInteger(limit)||!Number.isInteger(pageSize))throw Error("INVALID_HISTORY_CONFIGURATION");
const {PublicKey}=await import("@solana/web3.js");
if(new PublicKey(pool).toBase58()!==pool)throw Error("INVALID_POOL");
let state={schemaVersion:1,pool,before:null,seen:[],events:[],pages:0,complete:false,classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING"};
if(process.env.GLITCH_HISTORY_CHECKPOINT){
 const prior=JSON.parse(await readFile(process.env.GLITCH_HISTORY_CHECKPOINT,"utf8"));
 validateHistoryCheckpoint(prior,pool);
 state=prior;
}
const seen=new Set(state.seen);
const pending=new Set(state.pendingSignatures||[]);
const unresolvedReasons=new Map(Object.entries(state.unresolvedReasons||{}));
let requests=0,errors=[];
const attemptedThisRun=new Set();
async function call(url,method,params){
 if(requests>=limit)throw Error("HISTORY_REQUEST_BUDGET_EXHAUSTED");
 requests++;
 const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("RPC_HTTP_"+response.status);
 const body=await response.json();if(body.error){const detail=String(body.error.message||"").slice(0,240);throw Error("RPC_"+body.error.code+": "+detail);}return body.result;
}
function extract(tx,signature,slot,provider){
 const instructions=[...(tx?.transaction?.message?.instructions||[]),...(tx?.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 return instructions.map(i=>decodeHistoricalCandidate(i,signature,slot,provider)).filter(Boolean).map(event=>({...event,transactionExecution:classifyHistoricalTransaction(tx),signerEvidence:inspectHistoricalSignerEvidence(tx,event),roleAssessment:historicalRoleAssessment(event,tx,pool),eligibleForAuthorizationReview:classifyHistoricalTransaction(tx)==="EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED"}));
}
for(let page=0;requests<limit&&!state.complete;page++){
 let batch;
 try{batch=await call(rpc,"getSignaturesForAddress",[pool,{limit:pageSize,...(state.before?{before:state.before}:{})}]);}
 catch(e){errors.push({stage:"signatures",message:String(e.message)});break;}
 if(!Array.isArray(batch)){errors.push({stage:"signatures",message:"INVALID_RESPONSE"});break;}
 if(batch.length===0){state.complete=pending.size===0;break;}
 for(const item of batch){
  if(requests>=limit)break;
  if(seen.has(item.signature))continue;
  if(attemptedThisRun.has(item.signature)){errors.push({stage:"retry_guard",signature:item.signature});break;}
  attemptedThisRun.add(item.signature);
  let tx=null,provider="helius";
  try{tx=await retrieveHistoricalTransaction(call,rpc,item.signature);}
  catch(e){errors.push({stage:"transaction",signature:item.signature,message:String(e.message)});}
  if(!tx&&fallback&&requests<limit){
   try{tx=await retrieveHistoricalTransaction(call,fallback,item.signature);provider="alchemy";}
   catch(e){errors.push({stage:"archive",signature:item.signature,message:String(e.message)});}
  }
  if(!tx){const reason=requests>=limit?"REQUEST_BUDGET_EXHAUSTED":"RPC_TRANSACTION_UNAVAILABLE";errors.push({stage:"unresolved",signature:item.signature,reason});pending.add(item.signature);unresolvedReasons.set(item.signature,reason);break;}
  if(tx.slot!==item.slot){errors.push({stage:"slot_mismatch",signature:item.signature,expectedSlot:item.slot,returnedSlot:tx.slot});pending.add(item.signature);unresolvedReasons.set(item.signature,"TRANSACTION_SLOT_MISMATCH");break;}
  state.events.push(...extract(tx,item.signature,item.slot,provider));
  seen.add(item.signature);pending.delete(item.signature);unresolvedReasons.delete(item.signature);
 }
 // Do not advance cursor past unresolved signatures or unprocessed items.
 if(batch.some(x=>!seen.has(x.signature)))break;
 state.before=batch.at(-1).signature;state.pages++;
 // A short page is not proof of full history exhaustion; require an empty follow-up page.
}
state.seen=[...seen];state.pendingSignatures=[...pending];state.unresolvedReasons=Object.fromEntries(unresolvedReasons);state.requestCount=(state.requestCount||0)+requests;state.errors=[...(state.errors||[]),...errors];state.updatedAt=new Date().toISOString();state.finalScore=null;state.withdrawalVerified=false;state.authorizationVerified=false;state.historyCoverageVerified=state.complete&&pending.size===0;state.pendingSignatureCount=pending.size;state.signaturesAttemptedThisRun=attemptedThisRun.size;state.stopReason=state.complete?"HISTORY_EXHAUSTED":requests>=limit?"REQUEST_BUDGET_EXHAUSTED":errors.length?"RETRIEVAL_INCOMPLETE":"CHECKPOINTED";
await writeFile(output,JSON.stringify(state,null,2));
console.log(JSON.stringify({status:state.complete?"history_exhausted":errors.length?"partial":"checkpointed",requests,signaturesProcessed:seen.size,candidateEvents:state.events.length,errors:errors.length,classification:state.classification}));
if(errors.length)process.exitCode=1;
