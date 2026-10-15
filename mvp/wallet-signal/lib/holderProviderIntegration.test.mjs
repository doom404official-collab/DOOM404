import test from 'node:test';
import assert from 'node:assert/strict';
import {assessWithProviderEvidence} from './holderProviderIntegration.mjs';
const a='11111111111111111111111111111111',b='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',sig='1'.repeat(64);
const snapshot={slot:5,complete:true,circulatingSupply:100,holders:[{wallet:a,balance:40},{wallet:b,balance:60}]};
test('provider evidence is normalized into component metrics',()=>{
 const r=assessWithProviderEvidence({snapshot,creatorOrigin:{creatorWallet:a,creationSignature:sig,verifiedOnChain:true},
 tokenTransfers:[{from:a,to:b,signature:sig,verifiedOnChain:true,tokenTransferVerified:true}],
 investigationComplete:true});
 assert.equal(r.evidence.creatorOriginVerified,true);
 assert.equal(r.evidence.verifiedTransferCount,1);
 assert.equal(r.clusterCount,1);
 assert.equal(r.metrics.maxVerifiedClusterPct,100);
 assert.equal(r.status,'provisional');
});
test('unverified provider labels and transfers cannot become evidence',()=>{
 const r=assessWithProviderEvidence({snapshot,creatorOrigin:{creatorWallet:a,creationSignature:sig,verifiedOnChain:false},
 tokenTransfers:[{from:a,to:b,signature:sig,verifiedOnChain:false,tokenTransferVerified:true}]});
 assert.equal(r.evidence.creatorOriginVerified,false);
 assert.equal(r.evidence.verifiedTransferCount,0);
 assert.equal(r.clusterCount,0);
});
