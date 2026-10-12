import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { decodePumpFunCreate, PUMP_PROGRAM_ID } from "../lib/pumpFunCreation.mjs";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes) { let n = BigInt("0x" + bytes.toString("hex")), out = ""; while(n) { out = alphabet[Number(n % 58n)] + out; n /= 58n; } return out; }
function str(s) { const b = Buffer.from(s), l = Buffer.alloc(4); l.writeUInt32LE(b.length); return Buffer.concat([l,b]); }
function fixture(kind, creatorBytes = Buffer.alloc(32,7)) {
  const disc = createHash("sha256").update("global:" + kind).digest().subarray(0,8);
  const data = Buffer.concat([disc,str("Test"),str("TST"),str("https://example.test"),creatorBytes,...(kind === "create_v2" ? [Buffer.from([0,0])] : [])]);
  const accounts = Array.from({length: kind === "create" ? 14 : 16}, (_,i) => "account-" + i); accounts[0] = "mint";
  return {instruction:{programId:PUMP_PROGRAM_ID,accounts,data:b58(data)},transaction:{transaction:{message:{accountKeys:[]}},meta:{err:null}},mint:"mint",programId:PUMP_PROGRAM_ID};
}
test("legacy create identifies creator distinct from user", () => { const x = decodePumpFunCreate(fixture("create")); assert.equal(x.role,"launchpad_creator"); assert.equal(x.user,"account-7"); assert.notEqual(x.creator,x.user); });
test("create_v2 identifies creator distinct from user", () => { const x = decodePumpFunCreate(fixture("create_v2")); assert.equal(x.user,"account-5"); assert.equal(x.creationInstructionVerified,true); });
test("reject incorrect program or mint", () => { const x = fixture("create"); assert.equal(decodePumpFunCreate({...x,programId:"wrong"}),null); assert.equal(decodePumpFunCreate({...x,mint:"wrong"}),null); });
test("reject truncated data", () => { const x = fixture("create"); x.instruction.data="2"; assert.equal(decodePumpFunCreate(x),null); });
test("reject zero creator", () => { assert.equal(decodePumpFunCreate(fixture("create",Buffer.alloc(32))),null); });
