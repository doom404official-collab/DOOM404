import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTopHolderAccounts } from "../lib/topHolderAccounts.mjs";
const rows=Array.from({length:30},(_,i)=>({tokenAccount:"account"+i,ownerWallet:"owner"+i,amount:String(100-i)}));
test("30 ranked accounts are normalized",()=>{
 const r=normalizeTopHolderAccounts({mint:"test",rows,supplyRaw:"10000",source:"indexed"});
 assert.equal(r.status,"TOP_30_ACCOUNTS_OBSERVED");
 assert.equal(r.accounts.length,30);
 assert.equal(r.beneficialOwnersVerified,false);
});
test("20 RPC accounts cannot masquerade as top 30",()=>{
 const r=normalizeTopHolderAccounts({rows:rows.slice(0,20),supplyRaw:"10000"});
 assert.equal(r.status,"INSUFFICIENT_TOP_HOLDERS");
});
test("unsorted provider data is rejected",()=>{
 const wrong=rows.map(x=>({...x}));wrong[1].amount="200";
 assert.equal(normalizeTopHolderAccounts({rows:wrong,supplyRaw:"10000"}).status,"UNSORTED_HOLDER_DATA");
});
test("duplicate token account is rejected",()=>{
 const wrong=rows.map(x=>({...x}));wrong[1].tokenAccount=wrong[0].tokenAccount;
 assert.equal(normalizeTopHolderAccounts({rows:wrong,supplyRaw:"10000"}).status,"INVALID_HOLDER_RECORD");
});
