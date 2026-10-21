/** Read-only historical fee evidence inventory. No account state is promoted.
 * getTransaction identifies the target slot; getAccountInfo cannot supply an
 * arbitrary historical account snapshot and is intentionally not used here.
 */
import {createSolanaRpcAdapter} from '../lib/creatorOriginRpc.mjs';
const signature=process.env.CREATOR_DIAGNOSTIC_SIGNATURES?.split(',')[0]?.trim();
if(!signature||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature))throw Error('INVALID_DIAGNOSTIC_SIGNATURE');
if(!process.env.HELIUS_RPC_URL)throw Error('RPC_CONFIGURATION_MISSING');
const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:1,maxRetries:0,minIntervalMs:250});
const tx=await rpc.fetchTransaction(signature);
if(!tx){console.log(JSON.stringify({status:'TRANSACTION_UNAVAILABLE',historicalFeeConfigurationStatus:'NOT_RETRIEVED'}));process.exit(0);}
const slot=Number.isSafeInteger(tx.slot)?tx.slot:null;
const outer=tx.transaction?.message?.instructions||[];
const keys=(tx.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
const pump='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const buyAccounts=outer.flatMap((ix,index)=>{
 const program=ix.programId||(Number.isInteger(ix.programIdIndex)?keys[ix.programIdIndex]:null);
 if(program!==pump)return [];
 return [{instructionIndex:index,accounts:(ix.accounts||[]).map((a,position)=>({position,address:typeof a==='string'?a:Number.isInteger(a)?keys[a]:a?.pubkey?.toString?.()||null}))}];
});
console.log(JSON.stringify({mode:'READ_ONLY_NO_PROMOTION',signature,transactionSlot:slot,programId:pump,buyAccounts,historicalFeeConfigurationStatus:'NOT_RETRIEVED',historicalStateVerified:false,feeRecipientRolesVerified:false,eligibleForLivePromotion:false,requiredEvidence:['independently verified Global state at transaction slot','historical creator fee authority at transaction slot','fee recipient role mapping at transaction slot']}));
