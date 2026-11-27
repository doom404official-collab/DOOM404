import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {projectPumpLiquidityV2} from '../lib/pumpLiquidityAssessmentV2.mjs';
import {projectRaydiumCpmmV2} from '../lib/raydiumCpmmAssessmentV2.mjs';
const pump=JSON.parse(fs.readFileSync(new URL('./fixtures/scoring-v2-current-accounts.json',import.meta.url))),cp=JSON.parse(fs.readFileSync(new URL('./fixtures/raydium-cpmm-live-calibration.json',import.meta.url)));
test('PumpSwap quote matches independent constant-product and fee equations including virtual reserves',()=>{
 const p=projectPumpLiquidityV2(pump,pump.addresses[3]);assert.ok(p);
 assert.ok(p.withdrawal.maxCurrentWithdrawalPct<0.004);assert.equal(p.withdrawal.holderBalancesReconcile,true);
 const x=BigInt(p.baseReserveRaw),y=BigInt(p.effectiveQuoteReserveRaw),ceil=(a,d)=>(a+d-1n)/d;
 for(const r of p.referenceQuotes){const base=BigInt(r.baseInputRaw),gross=y*base/(x+base),fees=Object.values(p.feesBps).reduce((n,bps)=>n+ceil(gross*BigInt(bps),10000n),0n);assert.equal(BigInt(r.quoteOutputRaw),gross-fees);}
 assert.ok(p.referenceQuotes[0].impactIncludingFeesPct<p.referenceQuotes[1].impactIncludingFeesPct);assert.ok(p.referenceQuotes[1].impactIncludingFeesPct<p.referenceQuotes[2].impactIncludingFeesPct);
 const claim=BigInt(p.realQuoteReserveRaw)*BigInt(p.withdrawal.outstandingLpRaw)/BigInt(p.withdrawal.protocolLpDenominatorRaw);assert.equal(claim.toString(),p.withdrawal.maxQuoteClaimRaw);
});
test('low-liquidity live Raydium pool produces proportionate exit risk, not a token-wide fraud claim',()=>{
 const p=projectRaydiumCpmmV2(cp,cp.addresses[4]);assert.ok(p);assert.ok(p.referenceQuotes[0].impactIncludingFeesPct>50);assert.ok(p.referenceQuotes[2].impactIncludingFeesPct>99);
 assert.ok(BigInt(p.referenceQuotes[2].quoteOutputRaw)<BigInt(p.quoteReserveRaw));assert.ok(p.withdrawal.maxCurrentWithdrawalPct>99);assert.equal(p.withdrawal.actualRightsVerified,undefined);
});
test('incompatible architecture, account ownership and changed mint cannot inherit protocol proof',()=>{
 const bad=structuredClone(pump);bad.response.value[7].owner=pump.addresses[3];assert.equal(projectPumpLiquidityV2(bad,pump.addresses[3]),null);
 assert.equal(projectPumpLiquidityV2(pump,cp.addresses[4]),null);
 const badCp=structuredClone(cp);badCp.response.value[0].owner=pump.response.value[0].owner;assert.equal(projectRaydiumCpmmV2(badCp,cp.addresses[4]),null);
});

test('disabled swaps and external vault delegates cannot inherit benign exit or LP bounds',()=>{
 const disabled=structuredClone(pump),g=Buffer.from(disabled.response.value[6].data[0],'base64');g[56]|=16;disabled.response.value[6].data[0]=g.toString('base64');
 const d=projectPumpLiquidityV2(disabled,pump.addresses[3]);assert.ok(d);assert.ok(d.referenceQuotes.every(q=>q.executable===false&&q.impactIncludingFeesPct===null));assert.ok(d.flags.some(f=>f.id==='selling_disabled'));
 for(const [fixture,project,mintIndex] of [[pump,projectPumpLiquidityV2,3],[cp,projectRaydiumCpmmV2,4]]){const raw=structuredClone(fixture),bytes=Buffer.from(raw.response.value[1].data[0],'base64');bytes.writeUInt32LE(1,72);bytes.fill(1,76,108);bytes.writeBigUInt64LE(1n,121);raw.response.value[1].data[0]=bytes.toString('base64');const a=project(raw,raw.addresses[mintIndex]);assert.ok(a);assert.equal(a.withdrawal.maxCurrentWithdrawalPct,null);assert.ok(a.flags.some(f=>f.id==='external_vault_delegate'));}
});

test('standard SPL None authority options ignore inactive bytes as the official mint decoder specifies',()=>{
 const raw=structuredClone(cp),account=raw.response.value[5],b=Buffer.from(account.data[0],'base64');
 assert.equal(b.readUInt32LE(46),0);b.fill(23,50,82);account.data[0]=b.toString('base64');
 const a=projectRaydiumCpmmV2(raw,raw.addresses[4]);assert.ok(a);assert.equal(a.protocol,'raydium_cpmm');
 b.writeUInt32LE(2,46);account.data[0]=b.toString('base64');assert.equal(projectRaydiumCpmmV2(raw,raw.addresses[4]),null);
});
