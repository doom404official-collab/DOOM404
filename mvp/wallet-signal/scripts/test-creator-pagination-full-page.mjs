import assert from 'node:assert/strict';
import {scanCreatorOrigin} from '../lib/creatorOriginPagedScan.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const signatures=['1'.repeat(88),'2'.repeat(88),'3'.repeat(88),'4'.repeat(88)];
const pages=[];
const lookupSignaturePage=async(_mint,{before}={})=>{
 pages.push(before||null);
 const index=before?signatures.indexOf(before)+1:0;
 const entries=signatures.slice(index,index+2).map(signature=>({signature,err:null}));
 return {entries,nextCursor:entries.at(-1)?.signature||null,exhausted:index+2>=signatures.length};
};
const result=await scanCreatorOrigin({mint,lookupSignaturePage,fetchTransaction:async()=>null,maxPages:3,maxTransactions:10});
assert.equal(result.pagesFetched,2);
assert.equal(result.nextCursor,signatures[3]);
assert.equal(result.rpcHistoryExhausted,true);
assert.equal(result.historyComplete,false);
assert.deepEqual(pages,[null,signatures[1]]);
console.log('creator full-page pagination tests passed');
