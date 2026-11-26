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
