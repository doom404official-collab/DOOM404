const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {classify,curveAddress}=require("../lib/holder-classification");
const mint="EMQGeopasoZZUqiPDErvSL1QqvGr5WfZ1hbcvmAf8C3Y",owner="9FqqtFt5XRRz59ro7QftHdXtX9jdCGXx2MHTh188qdEC",tokenAccount="Bw5MSAHudDWtg8P1PHNjgnHkJsfpnQpjvMVvkGVSH1a2";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encode(b){let n=BigInt("0x"+b.toString("hex")),s="";while(n){s=alphabet[Number(n%58n)]+s;n/=58n}for(const v of b){if(v!==0)break;s="1"+s}return s}
const parsed={owner:"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",data:{parsed:{type:"account",info:{mint,owner}}}};
const raw=Buffer.alloc(49);crypto.createHash("sha256").update("account:BondingCurve").digest().copy(raw,0,0,8);
const control={owner:"6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",executable:false,data:[raw.toString("base64"),"base64"]};
const fixture={mint,tokenAccount,parsed,control,slot:1};
test("historically recorded TOMO curve PDA matches derivation",()=>assert.equal(encode(curveAddress(mint)),owner));
test("synthetic matching account data classifies curve",()=>assert.equal(classify(fixture).classification,"PUMP_FUN_BONDING_CURVE_INFRASTRUCTURE"));
test("program ownership alone cannot exclude",()=>assert.equal(classify({...fixture,control:{...control,data:["","base64"]}}).classification,"UNCLASSIFIED"));
test("wrong mint cannot exclude",()=>assert.equal(classify({...fixture,mint:"So11111111111111111111111111111111111111112"}).ownerVerified,false));
test("missing slot cannot exclude",()=>assert.equal(classify({...fixture,slot:null}).classification,"UNCLASSIFIED"));
test("wrong program cannot exclude",()=>assert.equal(classify({...fixture,control:{...control,owner:"11111111111111111111111111111111"}}).classification,"UNCLASSIFIED"));
