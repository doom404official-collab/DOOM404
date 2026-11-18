import test from "node:test";
import assert from "node:assert/strict";
import {reconcileHolderSnapshot} from "../lib/reconcileHolderSnapshot.mjs";
const cached=Array.from({length:20},(_,i)=>({tokenAccount:"token"+i,ownerWallet:"wallet"+i,sharePct:1}));
test("current balances can change without invalidating same owner graph",()=>{
 const live=cached.map((h,i)=>({...h,sharePct:1+i/100}));
 const result=reconcileHolderSnapshot(live,cached);
 assert.equal(result.compatible,true);
 assert.equal(result.holders[19].sharePct,1.19);
});
test("changed top holder ownership invalidates cached graph",()=>{
 const live=cached.map(h=>({...h}));
 live[0].ownerWallet="new-wallet";
 assert.equal(reconcileHolderSnapshot(live,cached).reason,"HOLDER_SET_CHANGED");
});
test("partial holder set never treated as compatible",()=>{
 assert.equal(reconcileHolderSnapshot(cached.slice(0,19),cached).compatible,false);
});
