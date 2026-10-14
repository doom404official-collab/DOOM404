import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";

// Read-only diagnostic. Requires a server-side RPC URL. Never writes to Supabase.
const mint = process.env.CREATOR_DIAGNOSTIC_MINT || "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const expected = process.env.CREATOR_EXPECTED_INDEXED_WALLET || "6RKsroTt2NgJvyUyhUcKqANrphWDw6eE52X9TMBsQ7WC";
const rpcUrl = process.env.HELIUS_RPC_URL;
const address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if (!address.test(mint) || !address.test(expected)) throw Error("INVALID_INPUT");
if (!rpcUrl) {
 console.log(JSON.stringify({status:"NOT_RUN",reason:"HELIUS_RPC_URL_NOT_CONFIGURED",writeAttempted:false}));
 process.exit(0);
}
const rpc = createSolanaRpcAdapter({rpcUrl,maxRequests:14,maxRetries:1,minIntervalMs:400});
const seen = new Set();
let cursor;
let pages=0;
let checked=0;
let outcome={status:"UNRESOLVED",reason:"NO_VERIFIED_CREATION_INSTRUCTION",writeAttempted:false};
try {
 for(let page=0;page<5;page++){
  const batch=await rpc.lookupSignaturePage(mint,{before:cursor});
  pages++;
  const candidates=batch.entries.filter(x=>x && !x.err && typeof x.signature==="string");
  for(const row of candidates.slice(-5).reverse()){
   if(seen.has(row.signature))continue;
   seen.add(row.signature);
   const tx=await rpc.fetchTransaction(row.signature);
   checked++;
   const proof=verifyLaunchpadCreation({mint,signature:row.signature,transaction:tx,decoders:pumpFunDecoders});
   const role=proof.decodedRoles?.find(x=>x.role==="launchpad_creator");
   if(proof.status==="VERIFIED" && role){
    outcome={status:role.address===expected?"ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW":"CREATOR_CONFLICT",
     mint,signature:row.signature,decodedCreator:role.address,expectedCreator:expected,
     programId:role.programId,decoderVersion:role.decoderVersion,writeAttempted:false};
    break;
   }
  }
  if(outcome.signature || batch.exhausted || !batch.nextCursor || batch.nextCursor===cursor)break;
  cursor=batch.nextCursor;
 }
}catch(error){
 outcome={status:"UNRESOLVED",reason:["RPC_RATE_LIMITED","RPC_AUTH_FAILED","RPC_REQUEST_BUDGET_EXHAUSTED"].includes(error.message)?error.message:"HISTORY_LOOKUP_FAILED",writeAttempted:false};
}
console.log(JSON.stringify({...outcome,pagesFetched:pages,transactionsChecked:checked,archiveCompletenessVerified:false}));
