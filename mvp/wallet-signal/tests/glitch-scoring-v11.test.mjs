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
