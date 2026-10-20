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
