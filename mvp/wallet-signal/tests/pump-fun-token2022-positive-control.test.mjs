import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectToken2022PumpFunBuySettlement as inspect} from '../lib/pumpFunToken2022BuySettlementShadow.mjs';
const mint='79iierYMVj263HYVtXWz3eCJosUpAvhkERCT6kGipump';
const buyer='9KRxX586FycrWYvAn61hZhcGDqfEGKQKhmQUBM2qLmda';
const curve='ES5Qv6dx23EwCzrhHuMhomiJyjLbMLyMos9tKKqb1gDf';
const pool='HE9Q943zhirhj1HLSpfq5jVqHtdZFzuGfL4yE9cuBj39';
const token='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const pump='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const recipient='AnoRfZJnGhL6zu7w3fER2dNuwPs5UUFP5NznLVXnqgu7';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){let n=BigInt('0x'+bytes.toString('hex'));let out='';while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out||'1';}
function fixture(){
 const payload=Buffer.alloc(24);createHash('sha256').update('global:buy').digest().copy(payload,0,0,8);
 payload.writeBigUInt64LE(436388216800n,8);payload.writeBigUInt64LE(200000000n,16);
 const accounts=['4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf','G5UZAVbAf46s7cKWoyKu8kYTip9DGTpbLZ2qa9Aq69dP',mint,curve,pool,recipient,buyer,'11111111111111111111111111111111',token,'7GzekxcKjxGUqw7tR6Ay8GWkupvFAN6VR1Yugui1xVfD','Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1',pump,'Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y','9B8nVZQNqLVkzsvCJhczZ21jYFED4mtKVj4NxwLA75gy','8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt','pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ','8vhNS4We6SELZPLnheRQb33spovYZ6HQ6HoffY8PDpSM','5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD'];
 const amount='436388216800';
 const row=(index,owner,n)=>({accountIndex:index,mint,owner,uiTokenAmount:{amount:String(n)}});
 const keys=[...accounts];
 const payments=[473704,157901250,750031,750031].map((lamports,i)=>({program:'system',parsed:{type:'transfer',info:{source:buyer,destination:[accounts[9],curve,accounts[17],accounts[1]][i],lamports}}}));
 return {meta:{err:null,fee:70000,preBalances:keys.map(k=>k===buyer?1000000000:0),postBalances:keys.map(k=>k===buyer?840054984:0),preTokenBalances:[row(4,curve,225484591635612n),row(5,buyer,4710162396209n)],postTokenBalances:[row(4,curve,225048203418812n),row(5,buyer,5146550613009n)],innerInstructions:[{index:3,instructions:[{program:'spl-token',programId:token,parsed:{type:'transferChecked',info:{source:pool,destination:recipient,mint,tokenAmount:{amount}}}},...payments]}]},transaction:{message:{accountKeys:keys,instructions:[{programId:'ComputeBudget111111111111111111111111111111',data:'2'},{programId:'ComputeBudget111111111111111111111111111111',data:'2'},{programId:'ComputeBudget111111111111111111111111111111',data:'2'},{programId:pump,data:b58(payload),accounts}]}}};
}
const review=t=>inspect({mint,buyer,transaction:t});
test('sanitized real-transaction-shaped positive control remains non-promotable',()=>{
 const r=review(fixture());assert.equal(r.status,'EVIDENCE_OBSERVED_UNVERIFIED');
 assert.equal(r.eligibleForLivePromotion,false);assert.equal(r.settlementVerified,false);assert.equal(r.independentlyVerified,false);
 assert.equal(r.feeRecipientRolesVerified,false);assert.equal(r.feeRoutingStatus,'UNVERIFIED');
});
test('incorrect historical pool ownership fails closed',()=>{const t=fixture();t.meta.preTokenBalances[0].owner=buyer;assert.equal(review(t).reason,'HISTORICAL_POOL_OWNERSHIP_UNVERIFIED');});
test('duplicate pool transfer fails closed',()=>{const t=fixture();t.meta.innerInstructions[0].instructions.push(structuredClone(t.meta.innerInstructions[0].instructions[0]));assert.equal(review(t).reason,'TOKEN_TRANSFER_NOT_UNIQUE');});
test('token delta mismatch fails closed',()=>{const t=fixture();t.meta.postTokenBalances[1].uiTokenAmount.amount='5146550613008';assert.equal(review(t).reason,'TOKEN_BALANCES_NOT_RECONCILED');});
test('unrelated buyer SOL debit fails closed',()=>{const t=fixture();t.meta.postBalances[6]-=1;assert.equal(review(t).reason,'BUYER_SOL_BALANCE_NOT_RECONCILED');});

test('missing historical pre-pool row fails closed',()=>{const t=fixture();t.meta.preTokenBalances.shift();assert.equal(review(t).reason,'HISTORICAL_POOL_OWNERSHIP_UNVERIFIED');});
test('duplicate historical pool row fails closed',()=>{const t=fixture();t.meta.postTokenBalances.push(structuredClone(t.meta.postTokenBalances[0]));assert.equal(review(t).reason,'HISTORICAL_POOL_OWNERSHIP_UNVERIFIED');});
test('wrong Token-2022 transfer program fails closed',()=>{const t=fixture();t.meta.innerInstructions[0].instructions[0].programId='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';assert.equal(review(t).reason,'TOKEN_TRANSFER_NOT_UNIQUE');});
test('wrong buyer account ownership fails closed',()=>{const t=fixture();t.meta.postTokenBalances[1].owner=curve;assert.equal(review(t).reason,'BUYER_RECEIPT_OWNERSHIP_UNVERIFIED');});

test('missing buyer SOL balance data fails closed',()=>{const t=fixture();t.meta.postBalances=[];assert.equal(review(t).reason,'BUYER_SOL_BALANCE_UNVERIFIED');});
test('duplicate bonding-curve payment fails closed',()=>{const t=fixture();const payment=structuredClone(t.meta.innerInstructions[0].instructions[2]);t.meta.innerInstructions[0].instructions.push(payment);assert.equal(review(t).reason,'CURVE_PAYMENT_NOT_UNIQUE');});
test('token mint mismatch fails closed',()=>{const t=fixture();t.meta.innerInstructions[0].instructions[0].parsed.info.mint='11111111111111111111111111111111';assert.equal(review(t).reason,'TOKEN_TRANSFER_AMOUNT_UNVERIFIED');});

test('buyer payment to non-instruction account fails closed',()=>{const t=fixture();t.meta.innerInstructions[0].instructions[1].parsed.info.destination='11111111111111111111111111111112';assert.equal(review(t).reason,'PAYMENT_DESTINATION_NOT_IN_BUY_ACCOUNTS');});
