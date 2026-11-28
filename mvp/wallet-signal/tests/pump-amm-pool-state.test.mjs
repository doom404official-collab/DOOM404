import test from "node:test";
import assert from "node:assert/strict";
import {decodePumpAmmPoolState} from "../lib/pumpAmmPoolState.mjs";
const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
test("rejects invalid owner and truncated account",()=>{
 assert.equal(decodePumpAmmPoolState(Buffer.alloc(243),"wrong"),null);
 assert.equal(decodePumpAmmPoolState(Buffer.alloc(242),program),null);
});
test("rejects unknown discriminator",()=>{
 assert.equal(decodePumpAmmPoolState(Buffer.alloc(243),program),null);
});
test("decodes candidate addresses without verification claims",()=>{
 const bytes=Buffer.alloc(243);
 Buffer.from([241,154,109,4,17,177,109,188]).copy(bytes);
 for(const offset of [11,43,75,107,139,171,211])bytes.fill(1,offset,offset+32);
 const result=decodePumpAmmPoolState(bytes,program);
 assert.equal(result.protocol,"pump_amm");
 assert.equal(result.reservesVerified,false);
 assert.equal(result.lpSecurityVerified,false);
 assert.equal(result.protocolVerified,false);
 assert.equal(result.lpSupply,"0");
});
