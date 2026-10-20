import assert from 'node:assert/strict';
import {verifyCreatorSwapSale} from '../lib/creatorSwapVerification.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signature='1'.repeat(88),transaction={meta:{err:null}};
const base={kind:'SWAP_SELL',protocolVerified:true,inputMint:mint,seller:creator,signature,timestamp:1700000000,
 soldRaw:'100',programId:'verified-program',decoderVersion:'v1',instructionVerified:true,outputAssetVerified:true,outputAsset:'SOL'};
const verified=verifyCreatorSwapSale({mint,creator,signature,transaction,decoder:()=>base});
assert.equal(verified.status,'VERIFIED');
assert.equal(verified.sale.soldRaw,'100');
for(const changed of [{protocolVerified:false},{instructionVerified:false},{outputAssetVerified:false},{seller:'other'},{kind:'TRANSFER'},{soldRaw:'0'}]){
 const result=verifyCreatorSwapSale({mint,creator,signature,transaction,decoder:()=>({...base,...changed})});
 assert.equal(result.status,'UNVERIFIED');
}
console.log('creator swap verification gate tests passed');
