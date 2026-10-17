import assert from 'node:assert/strict';
import {summarizeCreatorSelling} from '../lib/creatorSellingEvidence.mjs';
const launchTimestamp=1700000000;
const result=summarizeCreatorSelling({launchTimestamp,initialAttributableRaw:'1000',transactions:[
 {signature:'sale1',kind:'VERIFIED_SWAP_SELL',independentlyVerified:true,inputMintVerified:true,timestamp:launchTimestamp+120,soldRaw:'100'},
 {signature:'sale1',kind:'VERIFIED_SWAP_SELL',independentlyVerified:true,inputMintVerified:true,timestamp:launchTimestamp+120,soldRaw:'100'},
 {signature:'transfer1',kind:'TRANSFER',independentlyVerified:true,inputMintVerified:true,timestamp:launchTimestamp+240,soldRaw:'800'},
 {signature:'sale2',kind:'VERIFIED_SWAP_SELL',independentlyVerified:true,inputMintVerified:true,timestamp:launchTimestamp+7200,soldRaw:'200'}
 ],historyCompleteByWindow:{3600:true,86400:false,604800:false}});
assert.equal(result.verifiedSales.length,2);
assert.equal(result.windows[0].sellThroughPct,10);
assert.equal(result.windows[1].sellThroughPct,null);
assert.equal(result.windows[1].verifiedSoldRaw,'300');
assert.equal(result.creatorSellingScoreEligible,false);
console.log('creator selling evidence tests passed');
