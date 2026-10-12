import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import bs58 from "bs58";
const decoder=readFileSync(new URL("../lib/launchCreatorDecoder.js",import.meta.url),"utf8");
const source=readFileSync(new URL("../lib/launchTransactionInspector.js",import.meta.url),"utf8")
 .replace('import bs58 from "bs58";','')
 .replace('import { decodeLaunchCreator } from "./launchCreatorDecoder.js";',decoder.replace("export function decodeLaunchCreator","function decodeLaunchCreator"));
const {inspectLaunchCreationTransaction}=new Function("bs58",source.replace("export function inspectLaunchCreationTransaction","function inspectLaunchCreationTransaction")+"\nreturn {inspectLaunchCreationTransaction};")(bs58);
const schema={reviewed:true,programId:"pump-program-fixture",discriminator:[1,2,3,4,5,6,7,8],mintAccountIndex:0,creatorAccountIndex:1,version:"synthetic-only"};
const tx={transaction:{message:{accountKeys:[{pubkey:"mint"},{pubkey:"creator"},{pubkey:"pump-program-fixture"}],instructions:[{programIdIndex:2,accounts:[0,1],data:bs58.encode(Uint8Array.from(schema.discriminator))}]}},meta:{err:null},blockTime:123};
test("synthetic reviewed instruction can resolve account indices",()=>{
 const result=inspectLaunchCreationTransaction({mint:"mint",signature:"sig",transaction:tx,schemas:[schema]});
 assert.equal(result.launchCreator,"creator");
 assert.equal(result.signature,"sig");
});
test("unreviewed schemas never identify creator",()=>{
 const result=inspectLaunchCreationTransaction({mint:"mint",signature:"sig",transaction:tx,schemas:[{...schema,reviewed:false}]});
 assert.equal(result.launchCreatorVerified,false);
});
test("failed transactions cannot establish creator",()=>{
 const result=inspectLaunchCreationTransaction({mint:"mint",signature:"sig",transaction:{...tx,meta:{err:{InstructionError:[0,"Custom"]}}},schemas:[schema]});
 assert.equal(result.status,"unverified");
});
test("mismatched mint and missing schemas remain unknown",()=>{
 assert.equal(inspectLaunchCreationTransaction({mint:"other",signature:"sig",transaction:tx,schemas:[schema]}).launchCreator,null);
 assert.equal(inspectLaunchCreationTransaction({mint:"mint",signature:"sig",transaction:tx}).launchCreator,null);
});
