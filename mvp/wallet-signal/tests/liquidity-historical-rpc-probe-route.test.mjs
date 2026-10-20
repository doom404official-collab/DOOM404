import test from "node:test";
import assert from "node:assert/strict";
import {POST} from "../app/api/liquidity-historical-rpc-probe/route.js";
test("historical RPC probe requires internal token",async()=>{
 const previous=process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN;
 delete process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN;
 try{
  const response=await POST(new Request("https://localhost/api/liquidity-historical-rpc-probe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slot:458811200,accounts:[]})}));
  assert.equal(response.status,401);
 }finally{if(previous!==undefined)process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN=previous;}
});
