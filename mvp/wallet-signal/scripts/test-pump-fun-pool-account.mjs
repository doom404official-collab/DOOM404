import assert from 'node:assert/strict';
import {identifyPumpFunPoolTokenAccount} from '../lib/pumpFunPoolAccountResolver.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const accounts=['global','fees',mint,'curve','pool-token','user-token','user','system','token','rent','event',PUMP_FUN_PROGRAM_ID];
const result=identifyPumpFunPoolTokenAccount({mint,transaction:{transaction:{message:{accountKeys:accounts}}},
 instruction:{programId:PUMP_FUN_PROGRAM_ID,accounts:accounts.map((_,i)=>i)}});
assert.equal(result.status,'LAYOUT_CANDIDATE');
assert.equal(result.poolTokenAccount,'pool-token');
assert.equal(result.ownershipVerified,false);
assert.equal(identifyPumpFunPoolTokenAccount({mint:'wrong',transaction:{transaction:{message:{accountKeys:accounts}}},
 instruction:{programId:PUMP_FUN_PROGRAM_ID,accounts:accounts.map((_,i)=>i)}}).status,'UNVERIFIED');
console.log('Pump.fun pool account layout tests passed');
