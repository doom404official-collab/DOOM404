import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";

// Read-only exact-transaction corroboration. No database access.
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const signature="KMoj9pQq8XncaZPHQ5bTNZPDgQwfCBgdihVkxc5Y27fh7iGYwMbti2Mcscprhia1NBJauBbEvs5DE8ooWKWg6bs";
const indexed="6RKsroTt2NgJvyUyhUcKqANrphWDw6eE52X9TMBsQ7WC";
const rpcUrl=process.env.HELIUS_RPC_URL;
if(!rpcUrl)throw Error("RPC_NOT_CONFIGURED");
let report={status:"UNRESOLVED",writeAttempted:false};
try{
 const rpc=createSolanaRpcAdapter({rpcUrl,maxRequests:3,maxRetries:1,minIntervalMs:350});
 const tx=await rpc.fetchTransaction(signature);
 const proof=verifyLaunchpadCreation({mint,signature,transaction:tx,decoders:pumpFunDecoders});
 const roles=proof.decodedRoles?.filter(r=>r.role==="launchpad_creator")||[];
 if(proof.status==="VERIFIED"&&roles.length===1){
  const role=roles[0];
  report={status:"DECODED_ONCHAIN",mint,signature,decodedCreator:role.address,indexedCreator:indexed,
   exactMatch:role.address===indexed,programId:role.programId,decoderVersion:role.decoderVersion,
   independentlyReviewed:false,writeAttempted:false};
 }else report={status:"UNRESOLVED",reason:proof.reason||"CREATION_ROLE_NOT_ESTABLISHED",writeAttempted:false};
}catch(error){
 report={status:"UNRESOLVED",reason:["RPC_AUTH_FAILED","RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED"].includes(error?.message)?error.message:"TRANSACTION_RETRIEVAL_FAILED",writeAttempted:false};
}
console.log(JSON.stringify(report));
process.exitCode=report.status==="DECODED_ONCHAIN"?0:2;
