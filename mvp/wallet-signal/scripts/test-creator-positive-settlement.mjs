import assert from 'node:assert/strict';
import {verifyPumpFunCreatorSettlement} from '../lib/pumpFunCreatorSettlement.mjs';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const signature='1'.repeat(88);
const candidate={status:'CORROBORATED_CANDIDATE',saleVerified:false,creator,mint,signature,soldRaw:'200'};
const base={independentlyDecoded:true,signature,creator,mint,
 programId:'6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
 instructionType:'SELL',poolTokenReceiptVerified:true,creatorSolReceiptVerified:true,
 outputAsset:'SOL',soldRaw:'200',creatorReceivedLamports:'100000',
 timestamp:1700000000,decoderVersion:'pump-fun-settlement-test-v1'};
const good=verifyPumpFunCreatorSettlement({candidate,settlement:base});
assert.equal(good.status,'VERIFIED');
assert.equal(good.sale.independentlyVerified,true);
assert.equal(good.sale.soldRaw,'200');
for(const [key,value] of Object.entries({poolTokenReceiptVerified:false,creatorSolReceiptVerified:false,
 independentlyDecoded:false,soldRaw:'201',creator:'different',signature:'2'.repeat(88)})){
 const invalid=verifyPumpFunCreatorSettlement({candidate,settlement:{...base,[key]:value}});
 assert.equal(invalid.status,'UNVERIFIED',key);
}
console.log('creator positive settlement verification gate tests passed');
