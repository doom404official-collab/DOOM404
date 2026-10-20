import {createSolanaRpcAdapter} from '../lib/creatorOriginRpc.mjs';
import {inspectPumpFunBuyShadow} from '../lib/pumpFunBuyShadowValidation.mjs';
import {groupPumpFunBuyInstructions} from '../lib/pumpFunBuyInstructionGroups.mjs';
const mint=process.env.CREATOR_INVESTIGATION_MINT||'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator=process.env.CREATOR_INVESTIGATION_WALLET||'6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signatures=(process.env.CREATOR_DIAGNOSTIC_SIGNATURES||'').split(',').map(s=>s.trim()).filter(Boolean);
if(!process.env.HELIUS_RPC_URL)throw Error('RPC_CONFIGURATION_MISSING');
if(signatures.length<1||signatures.length>5||signatures.some(s=>!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(s)))throw Error('INVALID_DIAGNOSTIC_SIGNATURES');
const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:5,maxRetries:0,minIntervalMs:250});
const results=[];
for(const signature of signatures){
 try{
  const transaction=await rpc.fetchTransaction(signature);
  if(!transaction){results.push({signature,status:'TRANSACTION_UNAVAILABLE'});continue;}
  const groups=groupPumpFunBuyInstructions({transaction});
  const shadow=inspectPumpFunBuyShadow({mint,creator,signature,transaction});
  results.push({signature,status:shadow.status,diagnostic:shadow.diagnostic||null,recognizedBuyGroups:groups.length,
   instructionCount:transaction.transaction?.message?.instructions?.length||0,transactionFailed:transaction.meta?.err!=null,
   eligibleForLivePromotion:false});
 }catch(error){results.push({signature,status:'FETCH_OR_DECODE_FAILED',errorCode:['RPC_RATE_LIMITED','RPC_AUTH_FAILED','RPC_RESPONSE_ERROR','RPC_UNSUPPORTED_VERSION'].includes(error?.message)?error.message:'DIAGNOSTIC_FAILED'});}
}
console.log(JSON.stringify({mode:'READ_ONLY_NO_PROMOTION',results}));
