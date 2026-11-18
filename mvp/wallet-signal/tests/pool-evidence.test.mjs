import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";
const source=readFileSync(new URL("../lib/poolEvidence.js",import.meta.url),"utf8")
  .replace('import { PublicKey } from "@solana/web3.js";','');
const load = new Function("PublicKey", source.replace("export function normalizePoolAddress","function normalizePoolAddress").replace("export function normalizeReportedPools","function normalizeReportedPools")+"\nreturn {normalizePoolAddress,normalizeReportedPools};");
const {normalizeReportedPools,normalizePoolAddress}=load(PublicKey);
const mint="So11111111111111111111111111111111111111112";
const pair="11111111111111111111111111111111";
test("reject invalid pool addresses and off-chain matches",()=>{
 assert.equal(normalizePoolAddress("not-a-pubkey"),null);
 assert.deepEqual(normalizeReportedPools([{chainId:"ethereum",pairAddress:pair,baseToken:{address:mint}}],mint),[]);
});
test("deduplicate and never mark pools verified without RPC evidence",()=>{
 const rows=normalizeReportedPools([
  {chainId:"solana",pairAddress:pair,baseToken:{address:mint},liquidity:{usd:100}},
  {chainId:"solana",pairAddress:pair,baseToken:{address:mint},liquidity:{usd:200}}
 ],mint);
 assert.equal(rows.length,1);
 assert.equal(rows[0].liquidityUsd,null);
 assert.equal(rows[0].evidenceConflict,true);
 assert.equal(rows[0].poolAccountExistence,"not_checked");
 assert.equal(rows[0].reservesVerified,false);
 assert.equal(rows[0].lpLocksVerified,false);
});
test("unknown liquidity is not converted to zero",()=>{
 const rows=normalizeReportedPools([{chainId:"solana",pairAddress:pair,quoteToken:{address:mint},liquidity:{usd:"100"}}],mint);
 assert.equal(rows[0].liquidityUsd,null);
});

test('pool normalization is order-independent for ties, duplicates and conflicts',()=>{
 const other='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';const a={chainId:'solana',pairAddress:pair,baseToken:{address:mint},liquidity:{usd:100}},b={...a,pairAddress:other};
 for(const rows of [[a,b,a],[b,a,a],[a,a,b]])assert.deepEqual(normalizeReportedPools(rows,mint),normalizeReportedPools([a,b],mint));
 const conflict={...a,liquidity:{usd:200}};assert.deepEqual(normalizeReportedPools([a,b,conflict],mint),normalizeReportedPools([conflict,b,a],mint));
});
