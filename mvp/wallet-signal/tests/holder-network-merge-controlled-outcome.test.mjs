import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../app/api/holder-network-merge-controlled/route.js",import.meta.url),"utf8");
async function load(merge){
 const body=source.replace(/^import .*;\n/gm,"");
 return new Function("NextResponse","timingSafeEqual","createHolderJobStore","createHolderEvidenceStore","commitExternalNetworkEvidence",body.replace(/export const /g,"const ").replace("export async function POST","async function POST")+"\nreturn POST;")({json:(body,options={})=>({body,...options})},(a,b)=>a.equals(b),()=>({}),()=>({}),merge);
}
const request={headers:{get:()=>"test-token"}};
test("controlled merge failures report uncertain outcome, including lost successful response",async()=>{
 const oldToken=process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN,oldFlag=process.env.GLITCH_NETWORK_MERGE_ENABLED;
 process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN="test-token";process.env.GLITCH_NETWORK_MERGE_ENABLED="true";
 try{for(const commitHappened of [false,true]){
  let persisted=false;
  const post=await load(async()=>{persisted=commitHappened;throw Error("transport failure")});
  const result=await post(request);
  assert.equal(persisted,commitHappened);assert.equal(result.status,503);
  assert.equal(result.body.status,"outcome_unknown");assert.equal(result.body.checkpointModified,null);
  assert.equal(result.body.reconciliationRequired,true);assert.equal(result.body.retryAllowed,false);
  assert.equal(result.headers["Cache-Control"],"no-store");
 }}finally{if(oldToken===undefined)delete process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN;else process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN=oldToken;
 if(oldFlag===undefined)delete process.env.GLITCH_NETWORK_MERGE_ENABLED;else process.env.GLITCH_NETWORK_MERGE_ENABLED=oldFlag;}
});
