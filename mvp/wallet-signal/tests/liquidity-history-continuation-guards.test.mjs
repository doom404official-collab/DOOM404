import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../scripts/liquidity-historical-investigator.mjs",import.meta.url),"utf8");
test("history continuation validates checkpoint before RPC",()=>{
 assert.match(source,/validateHistoryCheckpoint\(prior,pool\)/);
 assert.match(source,/state=prior/);
 assert.match(source,/getSignaturesForAddress/);
 assert.match(source,/state\.before/);
});
test("history continuation refuses unsafe pagination and premature completion",()=>{
 assert.match(source,/DUPLICATE_SIGNATURE_PAGE/);
 assert.match(source,/HISTORY_CURSOR_NOT_ADVANCING/);
 assert.match(source,/batch\.length===0/);
 assert.match(source,/state\.complete=pending\.size===0/);
});
