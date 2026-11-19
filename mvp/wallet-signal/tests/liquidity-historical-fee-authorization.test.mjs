import test from "node:test";
import assert from "node:assert/strict";
import {assessHistoricalFeeAuthorization} from "../lib/liquidityHistoricalFeeAuthorization.mjs";
const feeSweeps=[{poolMatched:true,outerInstructionIndex:0,operation:"sweep_creator_fee",recipient:"creator"},{poolMatched:true,outerInstructionIndex:1,operation:"sweep_protocol_fee",recipient:"protocol"}];
test("current or mismatched state cannot authorize historical fees",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,feeSweeps,poolState:{slot:101,verified:true,coinCreator:"creator"},globalConfig:{slot:100,verified:false,protocolFeeRecipients:["protocol"]}});
 assert.equal(r.authorizationVerified,false);
 assert.ok(r.results.every(x=>x.status==="HISTORICAL_STATE_REQUIRED"));
});
test("verified same-slot recipient matching can establish eligibility",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,feeSweeps,poolState:{slot:100,verified:true,coinCreator:"creator"},globalConfig:{slot:100,verified:true,protocolFeeRecipients:["protocol"]}});
 assert.equal(r.recipientEligibilityVerified,true);
 assert.equal(r.authorizationVerified,false);
 assert.equal(r.settlementVerified,false);
});
test("mismatched historical recipient is not authorized",()=>{
 const r=assessHistoricalFeeAuthorization({transactionSlot:100,feeSweeps,poolState:{slot:100,verified:true,coinCreator:"other"},globalConfig:{slot:100,verified:true,protocolFeeRecipients:["protocol"]}});
 assert.equal(r.authorizationVerified,false);
});

test('missing recipient, unknown operation, absent instruction identity and negative slot stay Unknown',()=>{
 for(const sweep of [{poolMatched:true,outerInstructionIndex:0,operation:'sweep_creator_fee'},{poolMatched:true,outerInstructionIndex:0,operation:'invented',recipient:'creator'},{poolMatched:true,operation:'sweep_creator_fee',recipient:'creator'}]){
  const r=assessHistoricalFeeAuthorization({transactionSlot:100,poolState:{slot:100,verified:true},globalConfig:{slot:100,verified:true,protocolFeeRecipients:['creator']},feeSweeps:[sweep]});assert.equal(r.authorizationVerified,false);assert.equal(r.recipientEligibilityVerified,false);assert.equal(r.results[0].recipientEligible,null);
 }
 assert.equal(assessHistoricalFeeAuthorization({transactionSlot:-1,feeSweeps,poolState:{slot:-1,verified:true,coinCreator:'creator'}}).results[0].recipientEligible,null);
});
test('identical instruction observations deduplicate; conflicting same-position evidence stays Unknown in either order',()=>{
 const first=feeSweeps[0],other={...first,recipient:'other'},input={transactionSlot:100,poolState:{slot:100,verified:true,coinCreator:'creator'}};
 assert.equal(assessHistoricalFeeAuthorization({...input,feeSweeps:[first,{...first}]}).results.length,1);
 for(const feeSweeps of [[first,other],[other,first]]){const r=assessHistoricalFeeAuthorization({...input,feeSweeps});assert.equal(r.results[0].recipientEligible,null);assert.equal(r.authorizationVerified,false);}
});
