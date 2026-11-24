'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const normalizer=require('../lib/webm-timeline');
const cat=(...parts)=>Buffer.concat(parts.map(p=>Buffer.from(p)));
function ebml(id,data){let hex=id.toString(16);if(hex.length%2)hex='0'+hex;data=Buffer.from(data);let bytes=1;while(data.length>=2**(7*bytes)-1)bytes++;let n=BigInt(data.length)|(1n<<BigInt(bytes*7));const size=Buffer.alloc(bytes);for(let i=bytes-1;i>=0;i--){size[i]=Number(n&255n);n>>=8n}return cat(Buffer.from(hex,'hex'),size,data)}
const str=(id,s)=>ebml(id,Buffer.from(s)),u=(id,n)=>ebml(id,[n]);
function fixture({lacing=0,scale=[0x0f,0x42,0x40],codec='V_VP8',group=false}={}){
 const head=ebml(0x1a45dfa3,str(0x4282,'webm'));
 const opus=Buffer.alloc(19);opus.write('OpusHead');opus[8]=1;opus[9]=2;
 const tracks=ebml(0x1654ae6b,cat(ebml(0xae,cat(u(0xd7,1),u(0x83,1),str(0x86,codec))),ebml(0xae,cat(u(0xd7,2),u(0x83,2),str(0x86,'A_OPUS'),ebml(0x63a2,opus)))));
 const block=(track,time,payload,flag=0)=>ebml(0xa3,cat([128|track,(time>>8)&255,time&255,flag],payload));
 const video=group?ebml(0xa0,cat(ebml(0xa1,[0x81,0,0,0,0]),u(0x9b,60))):block(1,0,[0],lacing);
 const cluster=ebml(0x1f43b675,cat(u(0xe7,0),video,block(2,24,[0x18]),block(1,100,[1]),block(2,144,[0x18])));
 return cat(head,ebml(0x18538067,cat(ebml(0x1549a966,cat(ebml(0x2ad7b1,scale),str(0x4d80,'Chrome'))),tracks,cluster)));
}
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('Opus TOC durations cover SILK, hybrid, CELT and packed frames',()=>{assert.equal(normalizer.opusDurationMs(Uint8Array.from([0x18])),60);assert.equal(normalizer.opusDurationMs(Uint8Array.from([0x80])),2.5);assert.equal(normalizer.opusDurationMs(Uint8Array.from([0x60])),10);assert.equal(normalizer.opusDurationMs(Uint8Array.from([0x99])),40);assert.throws(()=>normalizer.opusDurationMs(Uint8Array.from([0x1b,3])),/duration/)});
test('shared audio clock removes stalls and does not mutate input',()=>{const a=fixture(),before=sha(a),out=normalizer.normalize(a),b=normalizer.inspectWebM(out.bytes);assert.equal(sha(a),before);assert.equal(out.diagnostics.encodedAudioDurationSeconds,.12);assert.equal(b.audio[1].timestamp-b.audio[0].timestamp,60);assert.equal(out.mapTimeSeconds(.1),.062);assert.equal(b.blocks[2].timestamp,62)});
for(const [label,input] of [['truncated EBML',()=>fixture().subarray(0,fixture().length-1)],['lacing',()=>fixture({lacing:2})],['unsupported scale',()=>fixture({scale:[1]})],['unsupported codec',()=>fixture({codec:'V_VP9'})],['unsupported BlockDuration layout',()=>fixture({group:true})],['empty input',()=>new Uint8Array()]])test('rejects '+label,()=>assert.throws(()=>normalizer.normalize(input()),/WEBM_TIMELINE_UNSUPPORTED/));
test('mismatched narration duration rejects unsupported evidence',()=>assert.throws(()=>normalizer.normalize(fixture(),{expectedNarrationDurationSeconds:20}),/differs/));
for(const name of ['usdc-doom','usdc-cat','tomo-bull','bonk-bore'])test('real '+name+' preserves main encoded packets and alpha additions',t=>{
 const path=require('node:path').join(process.env.DOOM404_V13_EXPORT_DIR||'/workspace/shared/doom404-v13/final',name+'.webm');if(!fs.existsSync(path)){t.skip('real browser acceptance export not present');return}const input=fs.readFileSync(path),before=sha(input),result=normalizer.normalize(input),a=normalizer.inspectWebM(input),b=normalizer.inspectWebM(result.bytes);assert.equal(sha(input),before);assert.equal(a.blocks.length,b.blocks.length);for(let i=0;i<a.blocks.length;i++){const p=a.blocks[i],q=b.blocks[i];assert.equal(sha(input.subarray(p.payloadOffset,p.payloadOffset+p.payloadLength)),sha(result.bytes.subarray(q.payloadOffset,q.payloadOffset+q.payloadLength)));const alphaA=(p.groupChildren||[]).filter(x=>x.id===0x75a1),alphaB=(q.groupChildren||[]).filter(x=>x.id===0x75a1);assert.equal(alphaA.length,alphaB.length);for(let k=0;k<alphaA.length;k++)assert.equal(sha(input.subarray(alphaA[k].offset,alphaA[k].end)),sha(result.bytes.subarray(alphaB[k].offset,alphaB[k].end)));}assert.ok(result.diagnostics.maximumTimestampQuantizationErrorMs<=.501);assert.ok(Math.abs(result.diagnostics.normalizedDurationSeconds-result.diagnostics.encodedAudioDurationSeconds)<.2);
});
