import {writeFile,readFile} from "node:fs/promises";
const pool=process.env.GLITCH_LIQUIDITY_POOL;
const rpc=process.env.HELIUS_RPC_URL;
const fallback=process.env.ALCHEMY_RPC_URL;
const limit=Math.min(200,Math.max(1,Number(process.env.GLITCH_HISTORY_BUDGET||60)));
const pageSize=Math.min(100,Math.max(1,Number(process.env.GLITCH_HISTORY_PAGE_SIZE||25)));
const output=process.env.GLITCH_HISTORY_OUTPUT||"liquidity-history-evidence.json";
if(!pool||!rpc||!/^https:\/\//.test(rpc)||!Number.isInteger(limit)||!Number.isInteger(pageSize))throw Error("INVALID_HISTORY_CONFIGURATION");
const {PublicKey}=await import("@solana/web3.js");
if(new PublicKey(pool).toBase58()!==pool)throw Error("INVALID_POOL");
let state={schemaVersion:1,pool,before:null,seen:[],events:[],pages:0,complete:false,classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING"};
if(process.env.GLITCH_HISTORY_CHECKPOINT){
 const prior=JSON.parse(await readFile(process.env.GLITCH_HISTORY_CHECKPOINT,"utf8"));
 if(prior.pool!==pool||prior.schemaVersion!==1||!Array.isArray(prior.seen)||!Array.isArray(prior.events))throw Error("INVALID_CHECKPOINT");
 if(prior.classification!=="AMOUNT_RECONCILED_AUTHORIZATION_PENDING"||prior.complete===true&&prior.errors?.some(e=>e.stage==="unresolved"))throw Error("INVALID_CHECKPOINT_CLASSIFICATION");
 state=prior;
}
const seen=new Set(state.seen);
const pending=new Set(state.pendingSignatures||[]);
let requests=0,errors=[];
async function call(url,method,params){
 requests++;
 const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("RPC_HTTP_"+response.status);
 const body=await response.json();if(body.error)throw Error("RPC_"+body.error.code);return body.result;
}
function extract(tx,signature,slot,provider){
 const instructions=[...(tx?.transaction?.message?.instructions||[]),...(tx?.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 const names=["set_coin_creator","migrate_pool_coin_creator","claim_creator_fee","collect_creator_fee","fee_sharing","set_creator"];
 const hits=instructions.filter(i=>i.parsed?.type&&names.includes(String(i.parsed.type).toLowerCase()));
 return hits.map(i=>({signature,slot,provider,programId:i.programId||null,rawInstruction:i,authorizationVerified:false,classification:"UNVERIFIED_CANDIDATE",decoderCoverage:"parsed_instruction_only"}));
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
  let tx=null,provider="helius";
  try{tx=await call(rpc,"getTransaction",[item.signature,{encoding:"jsonParsed",maxSupportedTransactionVersion:0}]);}
  catch(e){errors.push({stage:"transaction",signature:item.signature,message:String(e.message)});}
  if(!tx&&fallback&&requests<limit){
   try{tx=await call(fallback,"getTransaction",[item.signature,{encoding:"jsonParsed",maxSupportedTransactionVersion:0}]);provider="alchemy";}
   catch(e){errors.push({stage:"archive",signature:item.signature,message:String(e.message)});}
  }
  if(!tx){errors.push({stage:"unresolved",signature:item.signature});pending.add(item.signature);break;}
  state.events.push(...extract(tx,item.signature,item.slot,provider));
  seen.add(item.signature);pending.delete(item.signature);
 }
 // Do not advance cursor past unresolved signatures or unprocessed items.
 if(batch.some(x=>!seen.has(x.signature)))break;
 state.before=batch.at(-1).signature;state.pages++;
 // A short page is not proof of full history exhaustion; require an empty follow-up page.
}
state.seen=[...seen];state.pendingSignatures=[...pending];state.requestCount=(state.requestCount||0)+requests;state.errors=[...(state.errors||[]),...errors];state.updatedAt=new Date().toISOString();state.finalScore=null;state.withdrawalVerified=false;state.authorizationVerified=false;
await writeFile(output,JSON.stringify(state,null,2));
console.log(JSON.stringify({status:state.complete?"history_exhausted":errors.length?"partial":"checkpointed",requests,signaturesProcessed:seen.size,candidateEvents:state.events.length,errors:errors.length,classification:state.classification}));
if(errors.length)process.exitCode=1;
