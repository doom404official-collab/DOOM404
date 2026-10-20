import {createSolanaRpcAdapter} from '../lib/creatorOriginRpc.mjs';
import {inspectPumpFunBuyShadow} from '../lib/pumpFunBuyShadowValidation.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {verifyHistoricalPumpFunPoolOwnership} from '../lib/pumpFunHistoricalPoolOwnership.mjs';
import {resolveTokenBalanceAccounts} from '../lib/solanaTokenBalanceAccountResolver.mjs';
import {observePumpFunCreatorBuyReceipt} from '../lib/pumpFunCreatorBuyReceipt.mjs';
import {corroboratePumpFunCreatorBuySettlement} from '../lib/pumpFunCreatorBuySettlement.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
import {groupPumpFunBuyInstructions} from '../lib/pumpFunBuyInstructionGroups.mjs';
const mint=process.env.CREATOR_INVESTIGATION_MINT||'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator=process.env.CREATOR_INVESTIGATION_WALLET||'6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creator))throw Error('INVALID_DIAGNOSTIC_IDENTITY');
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
  const outer=transaction.transaction?.message?.instructions||[];
  const keys=transaction.transaction?.message?.accountKeys||[];
  const pumpInstructionCount=outer.filter(ix=>{const key=Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null;return ix?.programId===PUMP_FUN_PROGRAM_ID||(typeof key==='string'?key:key?.pubkey?.toString?.())===PUMP_FUN_PROGRAM_ID;}).length;
  const tokenBalances=[...(transaction.meta?.preTokenBalances||[]),...(transaction.meta?.postTokenBalances||[])];
  const observedMints=[...new Set(tokenBalances.map(x=>x?.mint).filter(x=>typeof x==='string'))].slice(0,12);
  const observedOwners=[...new Set(tokenBalances.map(x=>x?.owner).filter(x=>typeof x==='string'))].slice(0,12);
  const derived=derivePumpFunBondingCurveAccounts({mint});
  const poolOwnership=verifyHistoricalPumpFunPoolOwnership({mint,transaction});
  const receipts=observePumpFunCreatorBuyReceipt({mint,creator,transaction});
  const settlementCandidates=corroboratePumpFunCreatorBuySettlement({mint,creator,transaction});
  const resolved=resolveTokenBalanceAccounts({transaction});
  const matchingPoolRows=[...resolved.pre,...resolved.post].filter(x=>x.mint===mint&&x.accountPubkey===derived.poolTokenAccount);
  const settlementDiagnostics={poolDerivation:derived.status,
   derivedPoolTokenAccount:derived.poolTokenAccount||null,
   receiptSources:receipts.map(x=>x.sourceTokenAccount),
   sourceMatchesDerivedPool:receipts.some(x=>x.sourceTokenAccount===derived.poolTokenAccount),
   historicalPoolBalanceRows:matchingPoolRows.map(x=>({accountIndex:x.accountIndex,owner:x.owner||null})),
   resolvedAccountCount:resolved.accountCount||0,poolOwnership:poolOwnership.status,
   poolOwnershipReason:poolOwnership.reason||null,matchingBuyerReceipts:receipts.length,
   corroboratedSettlementCandidates:settlementCandidates.length,
   buyGroupsWithInnerInstructions:groups.filter(g=>g.instructionGroupFound).length};
  const buyerCandidates=observedOwners.map(owner=>({owner,preRaw:tokenBalances.filter(x=>(transaction.meta?.preTokenBalances||[]).includes(x)&&x?.owner===owner&&x?.mint===observedMints[0]).reduce((n,x)=>n+BigInt(x?.uiTokenAmount?.amount||'0'),0n).toString(),postRaw:tokenBalances.filter(x=>(transaction.meta?.postTokenBalances||[]).includes(x)&&x?.owner===owner&&x?.mint===observedMints[0]).reduce((n,x)=>n+BigInt(x?.uiTokenAmount?.amount||'0'),0n).toString()}));
  results.push({signature,status:shadow.status,diagnostic:shadow.diagnostic||null,pumpInstructionCount,recognizedBuyGroups:groups.length,observedMints,observedOwners,buyerCandidates,settlementDiagnostics,
   instructionCount:transaction.transaction?.message?.instructions?.length||0,transactionFailed:transaction.meta?.err!=null,
   eligibleForLivePromotion:false});
 }catch(error){results.push({signature,status:'FETCH_OR_DECODE_FAILED',errorCode:['RPC_RATE_LIMITED','RPC_AUTH_FAILED','RPC_RESPONSE_ERROR','RPC_UNSUPPORTED_VERSION'].includes(error?.message)?error.message:'DIAGNOSTIC_FAILED'});}
}
console.log(JSON.stringify({mode:'READ_ONLY_NO_PROMOTION',mint,creator,results}));
