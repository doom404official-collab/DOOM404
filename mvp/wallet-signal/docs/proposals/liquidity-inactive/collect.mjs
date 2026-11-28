// Inactive local collector. Requires a quiescent, private output directory.
import {constants} from 'node:fs';
import {open,lstat,realpath,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {describeLiquidityPublication} from './sidecars.mjs';
import {createLiquidityHistoryDeadline} from '../../../lib/liquidityHistoryRuntime.mjs';
const allowed=['liquidity-history-evidence.json','liquidity-history-evidence.json.lock','liquidity-history-evidence.json.pending'];
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs,s.nlink].join(':');
export async function collectLiquidityArtifact(options={}){
 if(options.enabled!==true)return {status:'DISABLED'};
 const {directory,run,conclusion,maxBytes,signal}=options;
 if(typeof directory!=='string'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>16*1024*1024)throw Error('LIQUIDITY_COLLECTION_CONFIG');
 describeLiquidityPublication({run,conclusion,files:[]});
 const deadline=createLiquidityHistoryDeadline({durationMs:20000,signal});
 return deadline.run(async(_signal,check)=>{
 const root=resolve(directory);
 const rootState=async()=>{check();if(await realpath(root)!==root)throw Error('LIQUIDITY_COLLECTION_PATH');const s=await lstat(root,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink())throw Error('LIQUIDITY_COLLECTION_PATH');return stamp(s);};
 const before=await rootState(),names=(await readdir(root)).sort();
 if(names.length>3||names.some(n=>!allowed.includes(n)))throw Error('LIQUIDITY_COLLECTION_PATH');
 let total=0;const files=[],observed=[];
 for(const name of names){
  check();const path=join(root,name),s=await lstat(path,{bigint:true});
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size>BigInt(maxBytes-total))throw Error('LIQUIDITY_COLLECTION_FILE');
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
   if(stamp(await handle.stat({bigint:true}))!==stamp(s))throw Error('LIQUIDITY_COLLECTION_CHANGED');
   // Fixed allocation and positional reads; a concurrently growing file cannot
   // allocate an unbounded readFile buffer. Read twice to detect byte changes.
   const read=async()=>{const bytes=Buffer.alloc(Number(s.size));let offset=0;while(offset<bytes.length){check();const r=await handle.read(bytes,offset,bytes.length-offset,offset);if(!r.bytesRead)throw Error('LIQUIDITY_COLLECTION_CHANGED');offset+=r.bytesRead;}return bytes;};
   const bytes=await read();if(!bytes.equals(await read())||stamp(await handle.stat({bigint:true}))!==stamp(s)||stamp(await lstat(path,{bigint:true}))!==stamp(s))throw Error('LIQUIDITY_COLLECTION_CHANGED');
   files.push({name,bytes});observed.push([path,stamp(s)]);total+=bytes.length;
  }finally{await handle.close();}
 }
 if(before!==await rootState()||JSON.stringify(names)!==JSON.stringify((await readdir(root)).sort()))throw Error('LIQUIDITY_COLLECTION_CHANGED');
 for(const [path,s] of observed)if(stamp(await lstat(path,{bigint:true}))!==s)throw Error('LIQUIDITY_COLLECTION_CHANGED');
 check();return {...describeLiquidityPublication({run,conclusion,files}),files};
 });
}
