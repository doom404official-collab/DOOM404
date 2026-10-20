import test from "node:test";
import assert from "node:assert/strict";
import {PublicKey} from "@solana/web3.js";
import {decodeArchivedPumpAccount} from "../lib/liquidityArchiveStateDecoder.mjs";
const PROGRAM="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const FIELDS=[["pool_bump",1],["index",2],...["creator","base_mint","quote_mint","lp_mint","pool_base_token_account","pool_quote_token_account"].map(n=>[n,32]),["lp_supply",8],["coin_creator",32]];
test("IDL field-order derivation independently establishes coin_creator offset 211",()=>{
 let offset=8;const offsets={};for(const [name,width] of FIELDS){offsets[name]=offset;offset+=width;}
 assert.equal(offsets.coin_creator,211);
 assert.equal(offsets.base_mint,43);
 assert.equal(offsets.quote_mint,75);
 const b=Buffer.alloc(260);Buffer.from([241,154,109,4,17,177,109,188]).copy(b);
 const expected=new PublicKey("HGBJMtxiFXSkZRk838n5mmHwvRtribAUdCAT1gyoYzSd");
 expected.toBuffer().copy(b,offsets.coin_creator);
 const result=decodeArchivedPumpAccount({owner:PROGRAM,data:[b.toString("base64"),"base64"]},"pump_amm_pool");
 assert.equal(result.status,"DECODED");
 assert.equal(result.coinCreator,expected.toBase58());
});
