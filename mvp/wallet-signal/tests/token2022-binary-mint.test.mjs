import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeToken2022BinaryMint as decode} from '../lib/token2022BinaryMint.mjs';
import {consistentEpochContext,resolveEpochFee} from '../lib/tokenTransferFeeEvidence.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/token2022-observation-20261118.json',import.meta.url)));
const raw=Buffer.from(f.account.data[0],'base64');
const wrap=b=>({...f.account,space:b.length,data:[b.toString('base64'),'base64']});
test('retained connector bytes decode completely without treating configuration as execution',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),f.sha256);
 const i=decode(f.account,f.mint).data.parsed.info;
 assert.equal(i.supply,'823778706335686');assert.equal(i.decimals,6);assert.equal(i.mintAuthority,null);assert.equal(i.freezeAuthority,null);
 assert.deepEqual(i.extensions.map(x=>x.extension),['metadataPointer','tokenMetadata']);
 assert.equal(i.extensions[1].state.mint,f.mint);assert.equal(i.extensions[1].state.symbol,'PAID');
 assert.equal(i.extensions.some(x=>x.extension==='transferFeeConfig'),false);
});
test('binary framing, owner, mint, unsafe encodings and unsupported layouts fail closed',()=>{
 for(const owner of [null,{},f.mint,' '+f.account.owner])assert.equal(decode({...f.account,owner},f.mint),null);
 for(const mint of ['bad','So11111111111111111111111111111111111111112'])assert.equal(decode(f.account,mint),null);
 for(const patch of [{executable:true},{space:391},{data:[f.account.data[0]+' ','base64']},{data:[f.account.data[0],'base64+zstd']}])assert.equal(decode({...f.account,...patch},f.mint),null);
 const mutations=[b=>b.subarray(0,389),b=>Buffer.concat([b,Buffer.from([0])]),b=>{b[165]=2;return b},b=>{b[82]=1;return b},b=>{b[166]=255;return b},b=>{b[234]=18;return b},b=>{b[168]=255;return b},b=>{b[0]=2;return b},b=>{b[45]=0;return b},b=>{b[4]=1;return b}];
 for(const mutate of mutations)assert.equal(decode(wrap(mutate(Buffer.from(raw))),f.mint),null);
});
test('synthetic transfer fee layout preserves exact u64 and schedule validation',()=>{
 const b=Buffer.alloc(278);raw.copy(b,0,0,166);b.writeUInt16LE(1,166);b.writeUInt16LE(108,168);
 b.writeBigUInt64LE(1n,242);b.writeBigUInt64LE(9007199254740993n,250);b.writeUInt16LE(50,258);
 b.writeBigUInt64LE(20n,260);b.writeBigUInt64LE(18446744073709551615n,268);b.writeUInt16LE(200,276);
 const state=decode(wrap(b),f.mint).data.parsed.info.extensions[0].state;
 assert.equal(resolveEpochFee({olderFee:state.olderTransferFee,newerFee:state.newerTransferFee,epoch:1089}).maximumFeeRaw,'18446744073709551615');
 b.writeUInt16LE(10001,276);assert.equal(decode(wrap(b),f.mint),null);
});
test('finalized provenance survives bracket and dashboard without score promotion',()=>{
 const c=consistentEpochContext(f.before,f.after,f.context.slot,f.commitment);assert.equal(c.commitment,'finalized');
 assert.equal(consistentEpochContext(f.before,f.after,f.context.slot,'processed'),null);
 assert.equal(consistentEpochContext({...f.before,absoluteSlot:Number.MAX_SAFE_INTEGER+1},f.after,f.context.slot,'finalized'),null);
 assert.equal(consistentEpochContext(f.before,{...f.after,epoch:1090},f.context.slot,'finalized'),null);
 const fee={epoch:'1',transferFeeBasisPoints:50,maximumFee:'100'};
 const view=adaptDashboardEvidence({now:Date.parse(f.observedAt),result:{mint:f.mint,tokenProgram:'spl-token-2022',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null},extensions:{mint:f.mint,verified:true,observedAt:f.observedAt,epochContext:c,transferFee:{status:'observed',olderFee:fee,newerFee:fee}}});
 assert.equal(view.scores.token_security.score,null);assert.equal(view.effectiveFee.basisPoints,50);
 // Both supported commitments keep exact labels; omitted arg preserves legacy API contract.
 assert.equal(consistentEpochContext(f.before,f.after,f.context.slot).commitment,'confirmed');
});
