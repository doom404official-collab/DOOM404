import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { decodePumpFunCreate, PUMP_PROGRAM_ID } from "../lib/pumpFunCreation.mjs";

/** Public account positions transcribed from creation tx KMoj9p... .
 * Instruction bytes below are synthetic; this is a structural regression, NOT
 * an independent reproduction of the historical transaction's raw bytes.
 */
const mint = "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const creator = "6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC";
const accounts = [
  mint,"TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",
  "AkyRtsMmz1FtHiroRob1MupbyFz9dJuKrk8qNDRe82Xq",
  "H5eGMnTJkrZzFNZ4LAJWvgSTERaFTGwBqyAE9oziYndC",
  "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf",creator,
  "11111111111111111111111111111111",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e",
  "13ec7XdrjF3h3YcqBTFDSReRcUFwbCnJaAQspM4j6DDJ",
  "BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s",
  "G63KTERHFhBXD4XRAHDibta3tqjVx8R3J1Cjvuq3qjb3",
  "HeN9NDFtu6a2qWccMbdMKVTUpzJQsoFYKYAQZ8WnTmnK",
  "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1",
  PUMP_PROGRAM_ID,"So11111111111111111111111111111111111111112",
  "7J3D7w58tNRA4D9cY7SahrZwst1cMPzmbw1Hnrx2S9ce",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
];
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decode58(value) { let n=0n; for(const c of value) n=n*58n+BigInt(alphabet.indexOf(c)); let hex=n.toString(16); if(hex.length%2)hex="0"+hex; return Buffer.from(hex,"hex"); }
function encode58(bytes) { let n=BigInt("0x"+Buffer.from(bytes).toString("hex")); let out=""; while(n){out=alphabet[Number(n%58n)]+out;n/=58n;} return out; }
function str(s){const b=Buffer.from(s);const l=Buffer.alloc(4);l.writeUInt32LE(b.length);return Buffer.concat([l,b]);}
function fixture(){const discriminator=createHash("sha256").update("global:create_v2").digest().subarray(0,8);
const data=Buffer.concat([discriminator,str("Evidence"),str("EV"),str("https://example.test"),decode58(creator),Buffer.from([0,0])]);
return { instruction:{programId:PUMP_PROGRAM_ID,accounts:[...accounts],data:encode58(data)},
  transaction:{transaction:{message:{accountKeys:[]}},meta:{err:null}},mint,programId:PUMP_PROGRAM_ID};}
test("observed 19-account layout accepts matching creator",()=>{
  const result=decodePumpFunCreate(fixture());assert.equal(result?.creator,creator);assert.equal(result?.user,creator);
});
test("reject wrong mint, program, token program and account count",()=>{
  const x=fixture();assert.equal(decodePumpFunCreate({...x,mint:"11111111111111111111111111111112"}),null);
  assert.equal(decodePumpFunCreate({...x,programId:"11111111111111111111111111111111"}),null);
  const wrong=fixture();wrong.instruction.accounts[7]="11111111111111111111111111111111";assert.equal(decodePumpFunCreate(wrong),null);
  const short=fixture();short.instruction.accounts.pop();assert.equal(decodePumpFunCreate(short),null);
});
