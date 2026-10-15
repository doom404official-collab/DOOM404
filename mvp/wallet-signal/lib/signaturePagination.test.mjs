import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSignaturePages} from './signaturePagination.mjs';
const item=s=>({signature:s});
test('fetches multiple pages and marks exhaustion',async()=>{
 const connection={getSignaturesForAddress:async(_key,args)=>args.before?[item('c')]:[item('a'),item('b')]};
 const r=await collectSignaturePages({connection,key:'test',pageSize:2,maxPages:3});
 assert.equal(r.signatures.length,3);
 assert.equal(r.coverage.historyComplete,true);
});
test('bounded pages are not called complete',async()=>{
 const connection={getSignaturesForAddress:async()=>[item('a'),item('b')]};
 const r=await collectSignaturePages({connection,key:'test',pageSize:2,maxPages:1});
 assert.equal(r.coverage.historyComplete,false);
});
test('failed page is reported rather than silently complete',async()=>{
 const connection={getSignaturesForAddress:async()=>{throw new Error('RPC unavailable')}};
 const r=await collectSignaturePages({connection,key:'test',pageSize:2,maxPages:2,retries:1});
 assert.equal(r.coverage.failedPage,true);
 assert.equal(r.coverage.historyComplete,false);
});
