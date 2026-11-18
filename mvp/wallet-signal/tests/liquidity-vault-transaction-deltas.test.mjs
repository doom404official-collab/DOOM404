import test from "node:test";
import assert from "node:assert/strict";
import {calculateVaultTransactionDeltas} from "../lib/liquidityVaultTransactionDeltas.mjs";
test("computes exact raw vault deltas",()=>{
 const meta={err:null,preTokenBalances:[{accountIndex:1,mint:"base",uiTokenAmount:{amount:"100"}}],postTokenBalances:[{accountIndex:1,mint:"base",uiTokenAmount:{amount:"90"}}]};
 const r=calculateVaultTransactionDeltas(meta,["other","vault"],["vault"]);
 assert.equal(r.vaults[0].rawDelta,"-10");
 assert.equal(r.withdrawalConfirmed,false);
});
test("missing vault evidence fails closed",()=>{
 const r=calculateVaultTransactionDeltas({},["other"],["vault"]);
 assert.equal(r.allVaultBalancesObserved,false);
 assert.equal(r.vaults[0].rawDelta,null);
});

for(const [name,change] of Object.entries({overflow:m=>m.postTokenBalances[0].uiTokenAmount.amount='18446744073709551616',wrongMint:m=>m.postTokenBalances[0].mint='other',missingMint:m=>{delete m.preTokenBalances[0].mint;delete m.postTokenBalances[0].mint;},duplicate:m=>m.preTokenBalances.push({...m.preTokenBalances[0]}),number:m=>m.postTokenBalances[0].uiTokenAmount.amount=90,failed:m=>m.err='AccountNotFound',missingExecution:m=>delete m.err}))test('vault delta remains Unknown for '+name,()=>{
 const row={accountIndex:0,mint:'mint',uiTokenAmount:{amount:'100'}},meta={err:null,preTokenBalances:[structuredClone(row)],postTokenBalances:[structuredClone(row)]};change(meta);const r=calculateVaultTransactionDeltas(meta,['vault'],['vault']);assert.equal(r.vaults[0].rawDelta,null);assert.equal(r.allVaultBalancesObserved,false);assert.equal(r.withdrawalConfirmed,false);
});
