import test from "node:test";
import assert from "node:assert/strict";
import { inspectMintInitialization } from "../lib/mintInitializationEvidence.js";
const mint="DEW9dSN6QpWyNthphCpMmAbZP1Q4cEKR9xQXAri98WDP";
const program="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes){let n=0n;for(const b of bytes)n=n*256n+BigInt(b);let s="";while(n){s=alphabet[Number(n%58n)]+s;n/=58n;}return s;}
test("detects raw initializeMint2 but never infers creator",()=>{
 const bytes=new Uint8Array(38);bytes[0]=20;bytes[1]=6;
 const result=inspectMintInitialization([{programId:program,accounts:[mint],data:b58(bytes)}],mint);
 assert.equal(result.length,1);
 assert.equal(result[0].kind,"initializeMint2");
 assert.equal(result[0].creator,undefined);
});
test("rejects wrong mint, unsupported program and invalid option",()=>{
 const bytes=new Uint8Array(38);bytes[0]=20;bytes[34]=2;
 const ix={programId:program,accounts:[mint],data:b58(bytes)};
 assert.equal(inspectMintInitialization([ix],mint).length,0);
 bytes[34]=0;
 assert.equal(inspectMintInitialization([{...ix,data:b58(bytes),accounts:["wrong"]}],mint).length,0);
 assert.equal(inspectMintInitialization([{...ix,data:b58(bytes),programId:"unknown"}],mint).length,0);
});
