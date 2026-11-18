import assert from 'node:assert/strict';
import {corroboratePumpFunPoolReceipt} from '../lib/pumpFunPoolReceiptCorroboration.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const derived=derivePumpFunBondingCurveAccounts({mint});
const accounts=['global','fees',mint,derived.bondingCurve,derived.poolTokenAccount,'user-token','user','system','token','rent','event',PUMP_FUN_PROGRAM_ID];
const tx={transaction:{message:{accountKeys:accounts,instructions:[{programId:PUMP_FUN_PROGRAM_ID,accounts:accounts.map((_,i)=>i)}]}},
 meta:{err:null,preTokenBalances:[{mint,accountIndex:4,uiTokenAmount:{amount:'100'}}],
 postTokenBalances:[{mint,accountIndex:4,uiTokenAmount:{amount:'300'}}]}};
const result=corroboratePumpFunPoolReceipt({mint,transaction:tx});
assert.equal(result.status,'POOL_RECEIPT_CORROBORATED');
assert.equal(result.poolReceivedRaw,'200');
assert.equal(result.settlementVerified,false);
console.log('Pump.fun pool receipt corroboration tests passed');
