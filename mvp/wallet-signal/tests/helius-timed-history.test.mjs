import test from "node:test";
import assert from "node:assert/strict";
import { createHeliusTimedHistory } from "../lib/heliusTimedHistory.mjs";
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
test("passes opaque pagination token and extracts next page signatures",async()=>{
  const requests=[];
  const adapter=createHeliusTimedHistory({rpcUrl:"https://example.test/rpc",fetchImpl:async(_url,opts)=>{
    const request=JSON.parse(opts.body);requests.push(request);
    return {ok:true,json:async()=>({result:{data:[{signature:"2".repeat(70)}],paginationToken:"NEXT"}})};
  }});
  await adapter.lookup({address:mint,createdTimestamp:1789500020000});
  const second=await adapter.lookup({address:mint,createdTimestamp:1789500020000,paginationToken:"NEXT"});
  assert.equal(requests[0].params[1].paginationToken,undefined);
  assert.equal(requests[1].params[1].paginationToken,"NEXT");
  assert.equal(second.signatures.length,1);
  assert.equal(second.paginationToken,"NEXT");
});
test("rejects non-string pagination token",async()=>{
  const adapter=createHeliusTimedHistory({rpcUrl:"https://example.test/rpc",fetchImpl:async()=>{throw Error("should not fetch");}});
  await assert.rejects(()=>adapter.lookup({address:mint,createdTimestamp:1789500020000,paginationToken:{unsafe:true}}),/INVALID_PAGINATION_TOKEN/);
});
