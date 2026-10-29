import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCollectFeeLayout} from '../lib/liquidityCollectFeeLayout.mjs';
import {PUMP_AMM_PROGRAM} from '../lib/liquidityHistoricalDecoder.mjs';
const candidate=()=>({operation:'collect_coin_creator_fee',programId:PUMP_AMM_PROGRAM,
 rawInstruction:{accounts:['q','token','creator','authority','vault','destination','event',PUMP_AMM_PROGRAM]}});
test('recognizes structural candidate without proof promotion',()=>{
 const result=inspectCollectFeeLayout(candidate());
 assert.equal(result.status,'STRUCTURAL_LAYOUT_CANDIDATE');
 assert.equal(result.accountRoles.coinCreator,'creator');
 assert.equal(result.proofVerified,false);
});
test('rejects incomplete or mismatched program accounts',()=>{
 const a=candidate(); a.rawInstruction.accounts.pop();
 assert.equal(inspectCollectFeeLayout(a).proofVerified,false);
 const b=candidate(); b.rawInstruction.accounts[7]='other';
 assert.equal(inspectCollectFeeLayout(b).status,'PROGRAM_ACCOUNT_MISMATCH');
});
test('other operations cannot be interpreted as collect fee',()=>{
 const a=candidate(); a.operation='withdraw';
 assert.equal(inspectCollectFeeLayout(a).status,'NOT_COLLECT_FEE_INSTRUCTION');
});
