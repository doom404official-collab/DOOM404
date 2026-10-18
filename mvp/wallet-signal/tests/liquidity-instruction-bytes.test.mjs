import test from "node:test";
import assert from "node:assert/strict";
import {decodeInstructionBytes} from "../lib/liquidityInstructionBytes.mjs";
test("preserves leading zero bytes",()=>{
 assert.deepEqual([...decodeInstructionBytes("11")],[0,0]);
});
test("decodes Base58 digits and existing bytes",()=>{
 assert.deepEqual([...decodeInstructionBytes("2")],[1]);
 assert.deepEqual([...decodeInstructionBytes(Buffer.from([183,18]))],[183,18]);
});
test("rejects invalid or oversized payloads",()=>{
 assert.equal(decodeInstructionBytes("0"),null);
 assert.equal(decodeInstructionBytes("1".repeat(4097)),null);
});
