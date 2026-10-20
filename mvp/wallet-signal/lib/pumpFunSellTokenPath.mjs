import {observePumpFunSellTokenTransfers} from './pumpFunSellTokenTransfers.mjs';
import {derivePumpFunBondingCurveAccounts} from './pumpFunBondingCurveDerivation.mjs';
/** Match sell-group token transfer to independently derived pool ATA.
 * Source token account ownership must still be established independently.
 */
export function corroboratePumpFunSellTokenPath({mint,transaction,creatorTokenAccounts=[]}={}){
 const derived=derivePumpFunBondingCurveAccounts({mint});
 if(derived.status!=='DERIVED')return {status:'UNVERIFIED',reason:'INVALID_MINT'};
 const sources=new Set(creatorTokenAccounts);
 const groups=observePumpFunSellTokenTransfers({transaction});
 const matches=[];
 for(const group of groups){
  for(const transfer of group.transfers){
   if(!sources.has(transfer.source)||transfer.destination!==derived.poolTokenAccount||
    !/^[0-9]+$/.test(transfer.amountRaw)||BigInt(transfer.amountRaw)<=0n)continue;
   if(transfer.mint&&transfer.mint!==mint)continue;
   matches.push({outerInstructionIndex:group.outerInstructionIndex,
    source:transfer.source,destination:transfer.destination,amountRaw:transfer.amountRaw});
  }
 }
 return {status:matches.length?'TOKEN_PATH_CORROBORATED':'UNVERIFIED',
  matches,sourceOwnershipVerified:false,poolHistoricalOwnershipVerified:false,
  settlementVerified:false};
}
