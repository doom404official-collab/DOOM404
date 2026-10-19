import test from "node:test";
import assert from "node:assert/strict";
import {calculateVaultTransactionDeltas} from "../lib/liquidityVaultTransactionDeltas.mjs";
test("computes exact raw vault deltas",()=>{
 const meta={preTokenBalances:[{accountIndex:1,mint:"base",uiTokenAmount:{amount:"100"}}],postTokenBalances:[{accountIndex:1,mint:"base",uiTokenAmount:{amount:"90"}}]};
 const r=calculateVaultTransactionDeltas(meta,["other","vault"],["vault"]);
 assert.equal(r.vaults[0].rawDelta,"-10");
 assert.equal(r.withdrawalConfirmed,false);
});
test("missing vault evidence fails closed",()=>{
 const r=calculateVaultTransactionDeltas({},["other"],["vault"]);
 assert.equal(r.allVaultBalancesObserved,false);
 assert.equal(r.vaults[0].rawDelta,null);
});
