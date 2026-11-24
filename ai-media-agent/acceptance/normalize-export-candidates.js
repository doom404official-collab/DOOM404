'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const normalizer=require('../lib/webm-timeline');
const path=require('node:path');
const flag=process.argv.indexOf('--input-dir');if(flag>=0&&!process.argv[flag+1])throw Error('--input-dir requires a directory');
const root=path.resolve(flag>=0?process.argv[flag+1]:process.env.DOOM404_V13_EXPORT_DIR||'/workspace/shared/doom404-v13/final')+path.sep,names=['usdc-doom','usdc-cat','tomo-bull','bonk-bore'],results=[];
const timing=JSON.parse(fs.readFileSync(__dirname+'/video-timing-diagnostics.json'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(root+'normalized',{recursive:true});
for(const name of names){
 const input=fs.readFileSync(root+name+'.webm'),before=sha(input),manifest=JSON.parse(fs.readFileSync(root+name+'-manifest.json'));
 const out=normalizer.normalize(input,{expectedNarrationDurationSeconds:manifest.narratedExport.narrationDurationSeconds});
 if(sha(input)!==before)throw Error('Input modified');
 const a=normalizer.inspectWebM(input),b=normalizer.inspectWebM(out.bytes),packets={},alphaA=[],alphaB=[];
 if(a.blocks.length!==b.blocks.length)throw Error('Packet count changed');
 for(const [label,kind]of[['video',1],['audio',2]]){
  const hasha=crypto.createHash('sha256'),hashb=crypto.createHash('sha256');let count=0;
  for(let i=0;i<a.blocks.length;i++){const p=a.blocks[i],q=b.blocks[i];if(a.tracks.get(p.track).kind!==kind)continue;const pa=input.subarray(p.payloadOffset,p.payloadOffset+p.payloadLength),pb=out.bytes.subarray(q.payloadOffset,q.payloadOffset+q.payloadLength);if(!Buffer.from(pa).equals(Buffer.from(pb)))throw Error('Packet payload differs');hasha.update(pa);hashb.update(pb);count++;}
  packets[label]={packets:count,originalSha256:hasha.digest('hex'),normalizedSha256:hashb.digest('hex')};
 }
 for(let i=0;i<a.blocks.length;i++){for(const c of a.blocks[i].groupChildren||[])if(c.id===0x75a1)alphaA.push(input.subarray(c.offset,c.end));for(const c of b.blocks[i].groupChildren||[])if(c.id===0x75a1)alphaB.push(out.bytes.subarray(c.offset,c.end));}
 const alphaOriginal=sha(Buffer.concat(alphaA)),alphaNormalized=sha(Buffer.concat(alphaB));if(alphaOriginal!==alphaNormalized)throw Error('Alpha bytes differ');
 fs.writeFileSync(root+'normalized/'+name+'.webm',out.bytes);fs.writeFileSync(root+'normalized/'+name+'-normalization.json',JSON.stringify(out.diagnostics,null,2));
 results.push({name,originalFile:root+name+'.webm',normalizedFile:root+'normalized/'+name+'.webm',originalSha256:before,normalizedSha256:sha(out.bytes),...out.diagnostics,expectedNarrationDurationSeconds:manifest.narratedExport.narrationDurationSeconds,mainEncodedPackets:packets,alphaBlockAdditions:{count:alphaA.length,originalSha256:alphaOriginal,normalizedSha256:alphaNormalized},mappedBoundaries:(timing.find(t=>t.name===name)?.boundaries||[]).map(t=>({...t,normalizedVisualBoundarySeconds:out.mapTimeSeconds(t.detectedVisualStartSeconds),normalizedEstimatedAudioBoundarySeconds:out.mapTimeSeconds(t.estimatedAudioBoundaryFromPacketClockSeconds)}))});
}
fs.writeFileSync(__dirname+'/webm-normalization-validation.json',JSON.stringify({status:'INDEPENDENT_DECODE_VALIDATION_PENDING',files:results},null,2));
console.log('Four candidates normalized; packet and alpha payloads are byte-identical. Independent decode checks pending.');
