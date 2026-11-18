import test from "node:test";
import assert from "node:assert/strict";
import {attributes,consolidate,version} from "../lib/glitchScoringV11.mjs";
test("v1.1 has four equally weighted attributes with correct allocations",()=>{
 assert.equal(version,"1.1");
 assert.equal(attributes.length,4);
 assert.equal(attributes.reduce((s,a)=>s+a.weight,0),100);
 assert.deepEqual(attributes.map(a=>a.name),["Token Security","Holder Intelligence","Creator Intelligence","Liquidity Quality & Safety"]);
 for(const a of attributes)assert.equal(Object.values(a.components).reduce((s,n)=>s+n,0),100);
 assert.equal(Object.hasOwn(attributes[0].components,"largest_token_account"),false);
 assert.equal(Object.hasOwn(attributes[1].components,"top20_holder_concentration"),true);
});
test("missing evidence cannot produce overall score",()=>{
 assert.equal(consolidate({token_security:{score:100,complete:true,calibrated:true}}).score,null);
});
test("four complete calibrated scores use equal weights",()=>{
 const values=[80,60,40,20];const results={};
 attributes.forEach((a,i)=>results[a.id]={score:values[i],complete:true,calibrated:true});
 assert.equal(consolidate(results).score,50);
});
test("uncalibrated evidence never yields final overall score",()=>{
 const results={};for(const a of attributes)results[a.id]={score:100,complete:true,calibrated:false};
 assert.equal(consolidate(results).score,null);
});
test("result metadata cannot override canonical attribute IDs or equal weights",()=>{
 const values=[80,60,40,20];
 for(const override of [100,0,-25,NaN,Infinity,"25",null]){
  const results=Object.fromEntries(attributes.map((a,i)=>[a.id,{id:"forged",weight:override,score:values[i],complete:true,calibrated:true}]));
  const result=consolidate(results);
  assert.equal(result.score,50);
  assert.equal(result.status,"complete");
  assert.deepEqual(result.checks.map(c=>({id:c.id,weight:c.weight})),attributes.map(a=>({id:a.id,weight:a.weight})));
 }
});
test("canonical weights do not bypass missing, invalid, or uncalibrated evidence",()=>{
 for(const invalid of [{complete:false},{calibrated:false},{score:null},{score:NaN},{score:Infinity},{score:-1},{score:101},{score:"100"}]){
  const results=Object.fromEntries(attributes.map(a=>[a.id,{score:100,complete:true,calibrated:true}]));
  results.token_security={...results.token_security,...invalid,id:"liquidity_quality_safety",weight:0};
  const result=consolidate(results);
  assert.equal(result.score,null);
  assert.equal(result.status,"incomplete");
 }
});
