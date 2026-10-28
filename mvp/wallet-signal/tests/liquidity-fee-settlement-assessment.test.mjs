import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFeeSettlement} from '../lib/liquidityFeeSettlementAssessment.mjs';
import {inspectFeeSettlementTransfers} from '../lib/liquidityFeeSettlementTransfers.mjs';
import {calculateVaultTransactionDeltas} from '../lib/liquidityVaultTransactionDeltas.mjs';
import {feeFixture} from './fixtures/liquidity-fee-flow.mjs';
function input(){const f=feeFixture();return {sweepAccounts:f.sweeps,transferEvidence:inspectFeeSettlementTransfers(f.tx,f.sweeps,f.proof),vaultBalanceEvidence:calculateVaultTransactionDeltas(f.tx.meta,f.keys,['vault'])};}
test('two distinct inner transfers reconcile one fee claim, never authority or withdrawal',()=>{
 const x=input(),r=assessFeeSettlement(x);assert.equal(r.amountReconciled,true);assert.equal(r.totalTransferRaw,'100');assert.equal(r.unexplainedRaw,'0');for(const k of ['authorizationVerified','settlementVerified','withdrawalConfirmed'])assert.equal(r[k],false);
 x.transferEvidence.transfers.push({...x.transferEvidence.transfers[0]});assert.equal(assessFeeSettlement(x).totalTransferRaw,'100');assert.equal(assessFeeSettlement(x).amountReconciled,true);
});
for(const [name,mutate] of Object.entries({wrongMint:x=>x.vaultBalanceEvidence.vaults[0].mint='other',missingMintProof:x=>delete x.vaultBalanceEvidence.vaults[0].mintMatched,duplicateVault:x=>x.vaultBalanceEvidence.vaults.push({...x.vaultBalanceEvidence.vaults[0]}),numericAmount:x=>x.transferEvidence.transfers[0].amountRaw=40,missingPosition:x=>delete x.transferEvidence.transfers[0].innerInstructionIndex,conflict:x=>x.transferEvidence.transfers.push({...x.transferEvidence.transfers[0],amountRaw:'999'}),wrongSignature:x=>x.transferEvidence.transfers[0].signature='other',wrongSlot:x=>x.transferEvidence.transfers[0].slot++,wrongParent:x=>x.transferEvidence.transfers[0].outerInstructionIndex++,missingExecutionScope:x=>delete x.transferEvidence.evidenceComplete,truthyParent:x=>x.transferEvidence.transfers[0].parentInstructionMatched='true',feeIsNotWithdrawal:x=>x.sweepAccounts.sweeps[0].operation='withdraw'}))test('no reconciliation from '+name,()=>{const x=input();mutate(x);const r=assessFeeSettlement(x);assert.equal(r.amountReconciled,false);assert.equal(r.withdrawalConfirmed,false);});
test('conflicting same-position records fail independently of observation order',()=>{const x=input();x.transferEvidence.transfers.push({...x.transferEvidence.transfers[0],amountRaw:'999'});for(const transfers of [x.transferEvidence.transfers,[...x.transferEvidence.transfers].reverse()])assert.equal(assessFeeSettlement({...x,transferEvidence:{...x.transferEvidence,transfers}}).amountReconciled,false);});

test('impossible u64 transfer amount is not a numeric observation',()=>{const x=input();x.transferEvidence.transfers[0].amountRaw='18446744073709551616';assert.equal(assessFeeSettlement(x).totalTransferRaw,null);});
