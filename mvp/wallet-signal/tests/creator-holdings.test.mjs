import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCreatorHoldings } from "../lib/creatorHoldings.js";
const mint="HSUMi4rMgjrx7zRUabw3ogGu1pa5hmF2eVcXj9Apump";
const creator="EQFgSvmavjfcvovYvgfETTcYvYzpHntqxkvDUViBTtZr";
const item=(amount)=>({pubkey:{toBase58:()=>"tokenaccount"},account:{data:{parsed:{type:"account",info:{mint,owner:creator,tokenAmount:{amount}}}}}});
test("sums exact creator token balances",()=>{
 const x=summarizeCreatorHoldings({mint,creator,tokenAccounts:[item("100000000"),item("200000000")],supply:{amount:"1000000000",decimals:6}});
 assert.equal(x.rawBalance,"300000000");assert.equal(x.uiBalance,"300");assert.equal(x.supplySharePct,30);
});
test("zero holdings is a confirmed observation",()=>{
 const x=summarizeCreatorHoldings({mint,creator,tokenAccounts:[],supply:{amount:"1000",decimals:6}});
 assert.equal(x.rawBalance,"0");assert.equal(x.accountCount,0);
});
test("reject mismatched account owner",()=>{
 const bad=item("10");bad.account.data.parsed.info.owner=mint;
 assert.throws(()=>summarizeCreatorHoldings({mint,creator,tokenAccounts:[bad],supply:{amount:"1000",decimals:6}}));
});
