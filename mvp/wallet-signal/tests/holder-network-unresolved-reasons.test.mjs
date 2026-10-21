import test from "node:test";
import assert from "node:assert/strict";
import {extractHolderNetworkTransfers} from "../lib/holderNetworkTransfers.mjs";
const signature="2".repeat(88),token="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const wallet="3".repeat(32),other="4".repeat(32),mint="5".repeat(32);
function tx(ix,pre=[],post=[]){return {slot:1,meta:{err:null,innerInstructions:[],preTokenBalances:pre,postTokenBalances:post},transaction:{signatures:[signature],message:{accountKeys:[wallet,other],instructions:[ix]}}};}
test("missing owner metadata is diagnostic only",()=>{
 const ix={programId:token,parsed:{type:"transfer",info:{source:wallet,destination:other,amount:"10"}}};
 const result=extractHolderNetworkTransfers({transaction:tx(ix),signature});
 assert.equal(result.valid,true);assert.equal(result.unresolvedTokenTransfers,1);
 assert.equal(result.unresolvedReasons.OWNER_METADATA_MISSING,1);
 assert.deepEqual(result.transfers,[]);
});
test("resolved transfer remains verified with empty diagnostics",()=>{
 const ix={programId:token,parsed:{type:"transfer",info:{source:wallet,destination:other,amount:"10"}}};
 const pre=[{accountIndex:0,owner:wallet,mint},{accountIndex:1,owner:other,mint}];
 const result=extractHolderNetworkTransfers({transaction:tx(ix,pre),signature});
 assert.equal(result.unresolvedTokenTransfers,0);assert.deepEqual(result.unresolvedReasons,{});
 assert.equal(result.transfers.length,1);assert.equal(result.transfers[0].transferVerified,true);
});
