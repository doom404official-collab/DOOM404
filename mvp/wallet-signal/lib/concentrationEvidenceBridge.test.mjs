import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCreatorEvidence,normalizeTransferEvidence} from './concentrationEvidenceBridge.mjs';
const wallet='11111111111111111111111111111111';
const second='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const sig='1'.repeat(64);
test('verified creator origin does not claim full team attribution',()=>{
 const r=normalizeCreatorEvidence({creatorWallet:wallet,creationSignature:sig,verifiedOnChain:true});
 assert.equal(r.creatorWallet,wallet);
 assert.equal(r.creatorTeamVerified,false);
 assert.deepEqual(r.creatorTeamWallets,[wallet]);
});
test('provider-only creator label does not qualify as on-chain proof',()=>{
 const r=normalizeCreatorEvidence({creatorWallet:wallet,creationSignature:sig,verifiedOnChain:false});
 assert.equal(r.creatorWallet,null);
});
test('only verified on-chain token transfers become cluster edges',()=>{
 const r=normalizeTransferEvidence([
  {from:wallet,to:second,signature:sig,verifiedOnChain:true,tokenTransferVerified:true},
  {from:wallet,to:second,signature:sig,verifiedOnChain:false,tokenTransferVerified:true}
 ]);
 assert.equal(r.length,1);
 assert.equal(r[0].verifiedTransfer,true);
});
