import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { decodePumpFunCreate, PUMP_PROGRAM_ID } from "../lib/pumpFunCreation.mjs";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes) { let n = BigInt("0x" + bytes.toString("hex")), out = ""; while(n) { out = alphabet[Number(n % 58n)] + out; n /= 58n; } return out; }
function str(s) { const b = Buffer.from(s), l = Buffer.alloc(4); l.writeUInt32LE(b.length); return Buffer.concat([l,b]); }
function fixture(kind, creatorBytes = Buffer.alloc(32,7), v2Suffix = Buffer.from([0,0])) {
  const disc = createHash("sha256").update("global:" + kind).digest().subarray(0,8);
  const data = Buffer.concat([disc,str("Test"),str("TST"),str("https://example.test"),creatorBytes,...(kind === "create_v2" ? [v2Suffix] : [])]);
  const accounts = Array.from({length: kind === "create" ? 14 : 16}, (_,i) => "account-" + i); accounts[0] = "mint";
  const SYSTEM = "11111111111111111111111111111111";
  const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOKEN22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
  const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
  if (kind === "create") { accounts[8]=SYSTEM; accounts[9]=TOKEN; accounts[10]=ATA; accounts[13]=PUMP_PROGRAM_ID; }
  else { accounts[6]=SYSTEM; accounts[7]=TOKEN22; accounts[8]=ATA; accounts[15]=PUMP_PROGRAM_ID; }
  return {instruction:{programId:PUMP_PROGRAM_ID,accounts,data:b58(data)},transaction:{transaction:{message:{accountKeys:[]}},meta:{err:null}},mint:"mint",programId:PUMP_PROGRAM_ID};
}
test("legacy create identifies creator distinct from user", () => { const x = decodePumpFunCreate(fixture("create")); assert.equal(x.role,"launchpad_creator"); assert.equal(x.user,"account-7"); assert.notEqual(x.creator,x.user); });
test("create_v2 identifies creator distinct from user", () => { const x = decodePumpFunCreate(fixture("create_v2")); assert.equal(x.user,"account-5"); assert.equal(x.creationInstructionVerified,true); });
test("reject incorrect program or mint", () => { const x = fixture("create"); assert.equal(decodePumpFunCreate({...x,programId:"wrong"}),null); assert.equal(decodePumpFunCreate({...x,mint:"wrong"}),null); });
test("reject truncated data", () => { const x = fixture("create"); x.instruction.data="2"; assert.equal(decodePumpFunCreate(x),null); });
test("reject zero creator", () => { assert.equal(decodePumpFunCreate(fixture("create",Buffer.alloc(32))),null); });

test("reject wrong system program account", () => { const x = fixture("create"); x.instruction.accounts[8] = "wrong"; assert.equal(decodePumpFunCreate(x), null); });
test("reject wrong token-2022 program account", () => { const x = fixture("create_v2"); x.instruction.accounts[7] = "wrong"; assert.equal(decodePumpFunCreate(x), null); });
test("reject unknown account count", () => { const x = fixture("create"); x.instruction.accounts.push("extra"); assert.equal(decodePumpFunCreate(x), null); });

test("create_v2 accepts full optional creator fee and holder reward fields", () => {
  const fee = Buffer.alloc(8); fee.writeBigUInt64LE(100n);
  const x = fixture("create_v2", Buffer.alloc(32,7), Buffer.concat([Buffer.from([0,0]),fee,Buffer.from([1])]));
  assert.equal(decodePumpFunCreate(x)?.creationInstructionVerified,true);
});
test("create_v2 rejects truncated OptionU64 and deprecated cashback true", () => {
  const partial = fixture("create_v2",Buffer.alloc(32,7),Buffer.from([0,0,1,2,3]));
  assert.equal(decodePumpFunCreate(partial),null);
  const cashback = fixture("create_v2",Buffer.alloc(32,7),Buffer.from([0,1]));
  assert.equal(decodePumpFunCreate(cashback),null);
});
test("create_v2 accepts omitted optional arguments and rejects trailing garbage", () => {
  assert.equal(decodePumpFunCreate(fixture("create_v2",Buffer.alloc(32,7),Buffer.from([0])))?.verified,true);
  assert.equal(decodePumpFunCreate(fixture("create_v2",Buffer.alloc(32,7),Buffer.alloc(0))),null);
  assert.equal(decodePumpFunCreate(fixture("create_v2",Buffer.alloc(32,7),Buffer.from([0,0,0,0,0,0,0,0,0,0,1,1]))),null);
});
