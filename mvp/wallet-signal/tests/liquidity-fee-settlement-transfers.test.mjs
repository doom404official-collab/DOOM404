import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFeeSettlementTransfers} from '../lib/liquidityFeeSettlementTransfers.mjs';
import {feeFixture} from './fixtures/liquidity-fee-flow.mjs';
test('distinct inner transfers sharing one actual fee parent retain separate identities',()=>{
 const {tx,sweeps,proof}=feeFixture(),r=inspectFeeSettlementTransfers(tx,sweeps,proof);
 assert.equal(r.evidenceComplete,true);assert.deepEqual(r.transfers.map(t=>[t.outerInstructionIndex,t.innerInstructionIndex,t.amountRaw]),[[0,0,'40'],[0,1,'60']]);assert.equal(r.authorizationVerified,false);assert.equal(r.settlementVerified,false);
});
for(const [name,mutate] of Object.entries({unknownProgram:f=>f.tx.meta.innerInstructions[0].instructions[0].programIdIndex=999,nestedSweep:f=>f.sweeps.sweeps[0].innerInstructionIndex=0,wrongSignature:f=>f.tx.transaction.signatures=['wrong'],wrongSlot:f=>f.tx.slot++,failed:f=>f.tx.meta.err='AccountNotFound',missingExecution:f=>delete f.tx.meta.err,missingInner:f=>delete f.tx.meta.innerInstructions,duplicateGroup:f=>f.tx.meta.innerInstructions.push(f.tx.meta.innerInstructions[0]),orphanGroup:f=>f.tx.meta.innerInstructions[0].index=1,wrongParent:f=>f.tx.transaction.message.compiledInstructions[0].data=Buffer.alloc(8),conflictingSweep:f=>f.sweeps.sweeps.push({...f.sweeps.sweeps[0],recipient:'other'}),wrongProgram:f=>f.sweeps.sweeps[0].quoteTokenProgram='other',trailingBytes:f=>f.tx.meta.innerInstructions[0].instructions[0].data=Buffer.alloc(11,3),missingAuthority:f=>f.tx.meta.innerInstructions[0].instructions[0].accountKeyIndexes=[5,6]}))test('transfer evidence fails closed: '+name,()=>{
 const f=feeFixture();mutate(f);const r=inspectFeeSettlementTransfers(f.tx,f.sweeps,f.proof);assert.equal(r.evidenceComplete,false);assert.equal(r.matchedTransferCount,0);
});
test('unrelated destination is not matched and checked-transfer wrong mint is rejected',()=>{
 const f=feeFixture();f.tx.meta.innerInstructions[0].instructions[0].accountKeyIndexes=[5,9,8];assert.equal(inspectFeeSettlementTransfers(f.tx,f.sweeps,f.proof).matchedTransferCount,1);
 const data=Buffer.alloc(10);data[0]=12;data.writeBigUInt64LE(40n,1);data[9]=6;f.tx.meta.innerInstructions[0].instructions[0]={programIdIndex:0,accountKeyIndexes:[5,9,6,8],data};assert.equal(inspectFeeSettlementTransfers(f.tx,f.sweeps,f.proof).evidenceComplete,false);
});
