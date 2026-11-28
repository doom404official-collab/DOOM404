import {observeCreatorSplTransfers} from './creatorSplTransferObservations.mjs';
import {resolveTokenBalanceAccounts} from './solanaTokenBalanceAccountResolver.mjs';
/** Classify only direct creator-account transfer directions from historical owner metadata.
 * A transfer remains an observation, not a purchase or independently verified ledger event.
 */
export function classifyCreatorTransferDirections({mint,creator,signature,transaction}={}){
 const balances=resolveTokenBalanceAccounts({transaction});
 const owners=new Map();
 for(const item of [...balances.pre,...balances.post]){
  if(item.mint!==mint||!item.accountPubkey)continue;
  const previous=owners.get(item.accountPubkey);
  if(previous&&previous!==item.owner)owners.set(item.accountPubkey,null);
  else if(!owners.has(item.accountPubkey))owners.set(item.accountPubkey,item.owner||null);
 }
 return observeCreatorSplTransfers({mint,creator,signature,transaction}).map(x=>{
  const source=owners.get(x.sourceTokenAccount),destination=owners.get(x.destinationTokenAccount);
  const type=source===creator&&destination===creator?'INTERNAL_TRANSFER':
   destination===creator&&source&&source!==creator?'EXTERNAL_RECEIPT_CANDIDATE':
   source===creator&&destination&&destination!==creator?'EXTERNAL_OUTFLOW_CANDIDATE':'UNRESOLVED';
  return {...x,type,sourceOwner:source||null,destinationOwner:destination||null,
   independentlyVerified:false,ledgerEligible:false};
 });
}
