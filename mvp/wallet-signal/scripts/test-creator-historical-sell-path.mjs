import assert from 'node:assert/strict';
import {corroborateHistoricalCreatorSellPath} from '../lib/creatorHistoricalSellPath.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const result=corroborateHistoricalCreatorSellPath({mint,creator,transaction:{
 transaction:{message:{accountKeys:[],instructions:[]}},
 meta:{err:null,preTokenBalances:[],postTokenBalances:[]}}});
assert.equal(result.status,'UNVERIFIED');
assert.equal(result.settlementVerified,false);

import {createHash} from 'node:crypto';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(bytes){let n=BigInt('0x'+bytes.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const data=Buffer.alloc(24);createHash('sha256').update('global:sell').digest().copy(data,0,0,8);data.writeBigUInt64LE(100n,8);
const pool=derivePumpFunBondingCurveAccounts({mint}).poolTokenAccount;
const transaction={transaction:{message:{accountKeys:['source-ata',pool,PUMP_FUN_PROGRAM_ID],instructions:[{programIdIndex:2,data:encode58(data)}]}},meta:{err:null,
 preTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'200'}}],
 postTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'100'}}],
 innerInstructions:[{index:0,instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{source:'source-ata',destination:pool,mint,tokenAmount:{amount:'100'}}}}]}]}};
const positive=corroborateHistoricalCreatorSellPath({mint,creator,transaction});
assert.equal(positive.status,'HISTORICAL_CREATOR_TOKEN_PATH_CORROBORATED');
assert.equal(positive.matches.length,1);
assert.equal(positive.settlementVerified,false);
const wrong={...transaction,meta:{...transaction.meta,preTokenBalances:[{accountIndex:0,mint,owner:'another-wallet',uiTokenAmount:{amount:'200'}}]}};
assert.equal(corroborateHistoricalCreatorSellPath({mint,creator,transaction:wrong}).status,'UNVERIFIED');

console.log('historical creator sell path composition tests passed');
