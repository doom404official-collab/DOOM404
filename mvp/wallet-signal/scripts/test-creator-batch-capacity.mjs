import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import bs58 from 'bs58';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
// Solana signatures are Base58-encoded 64-byte values. Decimal suffixes can
// introduce forbidden zero characters and make valid transactions look pending.
const signatures=Array.from({length:70},(_,i)=>bs58.encode(
 createHash('sha512').update(`creator-batch-capacity:${i}`).digest()));
assert.equal(new Set(signatures).size,70,'signature fixtures must be unique');
for(const signature of signatures){
 assert.match(signature,/^[1-9A-HJ-NP-Za-km-z]{64,88}$/,'signature fixture must be valid Base58');
 assert.equal(bs58.decode(signature).length,64,'signature fixture must encode 64 bytes');
}
let state={originEvidence:[{creator,signature:signatures[0]}],creatorHistorySignatures:signatures};
const fetchedSignatures=[];
const store={async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}};
const fetchImpl=async(_url,options)=>{
 const {method,params}=JSON.parse(options.body);
 if(method==='getTransaction')fetchedSignatures.push(params[0]);
 return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?
 {blockTime:1700000000,meta:{err:null,preTokenBalances:[],postTokenBalances:[]},
 transaction:{message:{accountKeys:[],instructions:[]}}}:[]})};
};
await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl,creatorBatchSize:60});
assert.equal(state.creatorProcessedSignatures.length,60);
assert.deepEqual(state.creatorProcessedSignatures,signatures.slice(0,60));
assert.deepEqual(fetchedSignatures,signatures.slice(0,60));
assert.deepEqual(state.creatorPendingSignatures,signatures.slice(60));
assert.equal(state.creatorHistoryComplete,false);
assert.equal(state.verifiedSwapSales.length,0);
console.log('creator bounded selling batch capacity tests passed');
