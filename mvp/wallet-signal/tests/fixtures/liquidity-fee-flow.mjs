import {extractFeeSweepAccounts} from '../../lib/liquidityFeeSweepAccounts.mjs';
export const signature='a'.repeat(64),slot=123;
export const tokenProgram='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export function feeFixture(){
 const keys=[tokenProgram,'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA','global','pool','mint','vault','recipientATA','recipient','authority','filler'];
 const parent={programIdIndex:1,accountKeyIndexes:[9,2,3,4,0,5,7,6,9,9,9,9],data:Buffer.from('20f6bf3408c949ba','hex')};
 const transfer=amount=>{const data=Buffer.alloc(9);data[0]=3;data.writeBigUInt64LE(BigInt(amount),1);return {programIdIndex:0,accountKeyIndexes:[5,6,8],data};};
 const tx={slot,version:0,transaction:{signatures:[signature],message:{staticAccountKeys:keys,compiledInstructions:[parent]}},meta:{err:null,innerInstructions:[{index:0,instructions:[transfer(40),transfer(60)]}],preTokenBalances:[{accountIndex:5,mint:'mint',uiTokenAmount:{amount:'1000'}}],postTokenBalances:[{accountIndex:5,mint:'mint',uiTokenAmount:{amount:'900'}}]}};
 return {tx,keys,sweeps:extractFeeSweepAccounts(tx,'pool'),transfer,proof:{signature,slot}};
}
