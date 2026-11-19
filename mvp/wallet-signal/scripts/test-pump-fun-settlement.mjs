import assert from 'node:assert/strict';
import {verifyPumpFunCreatorSettlement} from '../lib/pumpFunCreatorSettlement.mjs';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const signature='1'.repeat(88);
const candidate={status:'CORROBORATED_CANDIDATE',saleVerified:false,creator,mint,signature,soldRaw:'200'};
const settlement={independentlyDecoded:true,signature,creator,mint,programId:'6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
 instructionType:'SELL',poolTokenReceiptVerified:true,creatorSolReceiptVerified:true,outputAsset:'SOL',
 soldRaw:'200',creatorReceivedLamports:'100000',timestamp:1700000000,decoderVersion:'fixture-v1'};
assert.equal(verifyPumpFunCreatorSettlement({candidate,settlement}).status,'VERIFIED');
for(const change of [{independentlyDecoded:false},{poolTokenReceiptVerified:false},{creatorSolReceiptVerified:false},{soldRaw:'199'},{outputAsset:'USDC'}]){
 assert.equal(verifyPumpFunCreatorSettlement({candidate,settlement:{...settlement,...change}}).status,'UNVERIFIED');
}
console.log('Pump.fun creator settlement evidence tests passed');
