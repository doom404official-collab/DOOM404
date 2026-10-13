import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { decodePumpFunCreate, PUMP_PROGRAM_ID } from "../lib/pumpFunCreation.mjs";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes){let n=BigInt("0x"+bytes.toString("hex")),s="";while(n){s=alphabet[Number(n%58n)]+s;n/=58n;}return s;}
function str(s){const b=Buffer.from(s),l=Buffer.alloc(4);l.writeUInt32LE(b.length);return Buffer.concat([l,b]);}
const quote="pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";
const token="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ata="ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const control="6z6GDdfb2AjR9ZhJmAUQ5cipJCVxQvLJhB2H8mCwTFBP";
function fixture(){
 const mint=new PublicKey(Buffer.alloc(32,1)).toBase58();
 const curve=new PublicKey(Buffer.alloc(32,2)).toBase58();
 const creator=new PublicKey(Buffer.alloc(32,3)).toBase58();
 const [quoteAta]=PublicKey.findProgramAddressSync([new PublicKey(curve).toBuffer(),new PublicKey(token).toBuffer(),new PublicKey(quote).toBuffer()],new PublicKey(ata));
 const accounts=Array.from({length:20},()=>mint);
 accounts[0]=mint;accounts[2]=curve;accounts[5]=creator;
 accounts[6]="11111111111111111111111111111111";accounts[7]=token;accounts[8]=ata;accounts[15]=PUMP_PROGRAM_ID;
 accounts[16]=quote;accounts[17]=quoteAta.toBase58();accounts[18]=token;accounts[19]=control;
 const disc=createHash("sha256").update("global:create_v2").digest().subarray(0,8);
 const data=Buffer.concat([disc,str("Test"),str("TST"),str("https://example.test"),new PublicKey(creator).toBuffer(),Buffer.from([0,0])]);
 return {mint,creator,instruction:{accounts,data:b58(data)},transaction:{transaction:{message:{accountKeys:[]}},meta:{err:null}},programId:PUMP_PROGRAM_ID};
}
test("quote-control create_v2 identifies creator",()=>{
 const x=fixture(),proof=decodePumpFunCreate(x);
 assert.equal(proof?.creator,x.creator);
 assert.equal(proof?.decoderVersion,"pump-fun-create_v2-quote-control-v1");
});
test("quote-control create_v2 rejects wrong mint and account roles",()=>{
 const changes=[
  x=>{x.mint=new PublicKey(Buffer.alloc(32,9)).toBase58();},
  x=>{x.instruction.accounts[19]=x.creator;},
  x=>{x.instruction.accounts[17]=x.creator;},
  x=>{x.instruction.accounts[18]=x.creator;},
  x=>{x.instruction.accounts.push(x.creator);},
  x=>{x.instruction.accounts.pop();x.instruction.accounts[17]=x.creator;}
 ];
 for(const change of changes){const x=fixture();change(x);assert.equal(decodePumpFunCreate(x),null);}
});
