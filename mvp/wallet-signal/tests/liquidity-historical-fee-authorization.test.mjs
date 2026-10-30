import test from "node:test";
import assert from "node:assert/strict";
import {assessHistoricalFeeAuthorization} from "../lib/liquidityHistoricalFeeAuthorization.mjs";
const feeSweeps=[{poolMatched:true,operation:"sweep_creator_fee",recipient:"creator"},{poolMatched:true,operation:"sweep_protocol_fee",recipient:"protocol"}];
test("current or mismatched state cannot authorize historical fees",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,feeSweeps,poolState:{slot:101,verified:true,coinCreator:"creator"},globalConfig:{slot:100,verified:false,protocolFeeRecipients:["protocol"]}});
 assert.equal(r.authorizationVerified,false);
 assert.ok(r.results.every(x=>x.status==="HISTORICAL_STATE_REQUIRED"));
});
test("verified same-slot recipient matching can establish eligibility",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,feeSweeps,poolState:{slot:100,verified:true,coinCreator:"creator"},globalConfig:{slot:100,verified:true,protocolFeeRecipients:["protocol"]}});
 assert.equal(r.authorizationVerified,true);
 assert.equal(r.settlementVerified,false);
});
test("mismatched historical recipient is not authorized",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,feeSweeps,poolState:{slot:100,verified:true,coinCreator:"other"},globalConfig:{slot:100,verified:true,protocolFeeRecipients:["protocol"]}});
 assert.equal(r.authorizationVerified,false);
});

test("unsupported operation never inherits protocol authorization",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,
  globalConfig:{slot:100,verified:true,protocolFeeRecipients:["protocol"]},
  feeSweeps:[{poolMatched:true,operation:"unknown",recipient:"protocol"}]});
 assert.equal(r.authorizationVerified,false);
 assert.equal(r.results[0].status,"UNSUPPORTED_FEE_OPERATION");
});
test("missing recipient cannot authorize",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,
  poolState:{slot:100,verified:true,coinCreator:"creator"},
  feeSweeps:[{poolMatched:true,operation:"sweep_creator_fee",recipient:""}]});
 assert.equal(r.authorizationVerified,false);
 assert.equal(r.results[0].status,"RECIPIENT_REQUIRED");
});
test("mixed valid and invalid operations cannot authorize all",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,
  poolState:{slot:100,verified:true,coinCreator:"creator"},
  feeSweeps:[{poolMatched:true,operation:"sweep_creator_fee",recipient:"creator"},
   {poolMatched:true,operation:"unsupported",recipient:"creator"}]});
 assert.equal(r.authorizationVerified,false);
 assert.equal(r.results[0].authorizationVerified,true);
 assert.equal(r.results[1].authorizationVerified,false);
});
test("malformed sweep list is rejected",()=>{
 assert.throws(()=>assessHistoricalFeeAuthorization({feeSweeps:null}),/INVALID_FEE_SWEEPS/);
});
