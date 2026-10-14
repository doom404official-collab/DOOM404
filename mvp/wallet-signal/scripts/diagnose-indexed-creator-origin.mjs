import { createHeliusCreationCandidates } from "../lib/heliusCreationCandidates.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";

// Read-only indexed candidate discovery followed by on-chain verification.
// Enhanced-history results are NOT assumed to be oldest-first or complete.
const mint = process.env.CREATOR_DIAGNOSTIC_MINT || "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const expected = process.env.CREATOR_EXPECTED_INDEXED_WALLET || "6RKsroTt2NgJvyUyhUcKqANrphWDw6eE52X9TMBsQ7WC";
const endpoint = process.env.HELIUS_RPC_URL;
const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if(!valid.test(mint) || !valid.test(expected) || !endpoint) throw Error("INVALID_CONFIGURATION");
const provider = createHeliusCreationCandidates({rpcUrl:endpoint});
const rpc = createSolanaRpcAdapter({rpcUrl:endpoint,maxRequests:35,maxRetries:1,minIntervalMs:350});
let outcome={status:"UNRESOLVED",reason:"NO_VERIFIED_CREATION_INSTRUCTION",writeAttempted:false};
let candidates=0,checked=0;
try {
 const rows=await provider.lookup(mint);
 candidates=rows.length;
 for(const item of rows.slice(0,25)){
  const transaction=await rpc.fetchTransaction(item.signature);
  checked++;
  const proof=verifyLaunchpadCreation({mint,signature:item.signature,transaction,decoders:pumpFunDecoders});
  const role=proof.decodedRoles?.find(x=>x.role==="launchpad_creator");
  if(proof.status==="VERIFIED" && role){
   outcome={status:role.address===expected?"ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW":"CREATOR_CONFLICT",
    mint,signature:item.signature,decodedCreator:role.address,expectedCreator:expected,
    programId:role.programId,decoderVersion:role.decoderVersion,writeAttempted:false};
   break;
  }
 }
}catch(error){
 const known=new Set(["HELIUS_INDEX_AUTH_FAILED","HELIUS_INDEX_RATE_LIMITED","HELIUS_INDEX_HTTP_ERROR","HELIUS_INDEX_NETWORK_ERROR","RPC_RATE_LIMITED","RPC_AUTH_FAILED","RPC_REQUEST_BUDGET_EXHAUSTED"]);
 outcome={status:"UNRESOLVED",reason:known.has(error?.message)?error.message:"INDEXED_LOOKUP_FAILED",writeAttempted:false};
}
console.log(JSON.stringify({...outcome,indexedCandidates:candidates,transactionsChecked:checked,historyComplete:false}));
process.exitCode=outcome.status==="ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"?0:outcome.status==="CREATOR_CONFLICT"?1:2;
