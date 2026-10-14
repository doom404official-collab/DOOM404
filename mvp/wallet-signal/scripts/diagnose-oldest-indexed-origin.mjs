import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";

// Read-only oldest-first indexed discovery. No Supabase access or writes.
const mint=process.env.CREATOR_DIAGNOSTIC_MINT || "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const expected=process.env.CREATOR_EXPECTED_INDEXED_WALLET || "6RKsroTt2NgJvyUyhUcKqANrphWDw6eE52X9TMBsQ7WC";
const endpoint=process.env.HELIUS_RPC_URL;
const valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if(!valid.test(mint)||!valid.test(expected)||!endpoint)throw Error("INVALID_CONFIGURATION");
let result={status:"UNRESOLVED",reason:"INDEXED_DISCOVERY_UNAVAILABLE",writeAttempted:false};
let count=0,checked=0;
try{
 const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getTransactionsForAddress",
   params:[mint,{sortOrder:"asc",transactionDetails:"signatures",limit:30}]}),
  signal:AbortSignal.timeout(15000),cache:"no-store"});
 if(!response.ok)throw Error(response.status===401||response.status===403?"INDEXED_AUTH_FAILED":response.status===429?"INDEXED_RATE_LIMITED":"INDEXED_HTTP_ERROR");
 const payload=await response.json();
 if(payload.error)throw Error(payload.error.code===-32601?"INDEXED_METHOD_UNSUPPORTED":"INDEXED_RPC_ERROR");
 const value=payload.result;
 const rows=Array.isArray(value)?value:Array.isArray(value?.transactions)?value.transactions:Array.isArray(value?.signatures)?value.signatures:Array.isArray(value?.data)?value.data:null;
 if(!rows)throw Error("INDEXED_RESPONSE_UNRECOGNIZED");
 const signatures=[...new Set(rows.map(x=>typeof x==="string"?x:x?.signature||x?.transaction?.signatures?.[0]).filter(x=>typeof x==="string"&&x.length>=64))].slice(0,30);
 count=signatures.length;
 const rpc=createSolanaRpcAdapter({rpcUrl:endpoint,maxRequests:40,maxRetries:1,minIntervalMs:350});
 result={status:"UNRESOLVED",reason:"NO_VERIFIED_CREATION_INSTRUCTION_IN_INDEXED_SAMPLE",writeAttempted:false};
 for(const signature of signatures){
  const transaction=await rpc.fetchTransaction(signature);
  checked++;
  const proof=verifyLaunchpadCreation({mint,signature,transaction,decoders:pumpFunDecoders});
  const role=proof.decodedRoles?.find(x=>x.role==="launchpad_creator");
  if(proof.status==="VERIFIED"&&role){
   const exactMatch = role.address === expected;
   const firstDifference = [...role.address].findIndex((char,index)=>char!==expected[index]);
   result={status:exactMatch?"ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW":"CREATOR_CONFLICT",
    comparison:{exactMatch,decodedLength:role.address.length,expectedLength:expected.length,firstDifferenceIndex:exactMatch?null:firstDifference===-1?Math.min(role.address.length,expected.length):firstDifference},
    mint,signature,decodedCreator:role.address,expectedCreator:expected,
    programId:role.programId,decoderVersion:role.decoderVersion,writeAttempted:false};
   break;
  }
 }
}catch(error){
 const safe=new Set(["INDEXED_AUTH_FAILED","INDEXED_RATE_LIMITED","INDEXED_HTTP_ERROR","INDEXED_METHOD_UNSUPPORTED","INDEXED_RPC_ERROR","INDEXED_RESPONSE_UNRECOGNIZED","RPC_RATE_LIMITED","RPC_AUTH_FAILED","RPC_REQUEST_BUDGET_EXHAUSTED"]);
 result={status:"UNRESOLVED",reason:safe.has(error?.message)?error.message:"INDEXED_DISCOVERY_FAILED",writeAttempted:false};
}
console.log(JSON.stringify({...result,indexedCandidates:count,transactionsChecked:checked,archiveCompletenessVerified:false}));
process.exitCode=result.status==="ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"?0:result.status==="CREATOR_CONFLICT"?1:2;
