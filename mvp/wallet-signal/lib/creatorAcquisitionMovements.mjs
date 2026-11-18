import {resolveTokenBalanceAccounts} from './solanaTokenBalanceAccountResolver.mjs';
/** Observes token balance changes, without classifying purchases or sales. */
export function observeCreatorAcquisitionMovements({mint,creator,signature,transaction}={}){
 if(!transaction||transaction.meta?.err!=null||!mint||!creator||!signature)
  return {status:'UNVERIFIED',movements:[]};
 const resolved=resolveTokenBalanceAccounts({transaction});
 const pre=new Map(resolved.pre.filter(x=>x.mint===mint&&x.owner===creator&&x.accountPubkey)
  .map(x=>[x.accountPubkey,BigInt(x.uiTokenAmount?.amount||'0')]));
 const post=new Map(resolved.post.filter(x=>x.mint===mint&&x.owner===creator&&x.accountPubkey)
  .map(x=>[x.accountPubkey,BigInt(x.uiTokenAmount?.amount||'0')]));
 const movements=[...new Set([...pre.keys(),...post.keys()])].flatMap(account=>{
  const delta=(post.get(account)||0n)-(pre.get(account)||0n);
  return delta===0n?[]:[{signature,tokenAccount:account,mint,creator,
   direction:delta>0n?'IN':'OUT',amountRaw:(delta>0n?delta:-delta).toString(),
   classification:'UNCLASSIFIED_BALANCE_MOVEMENT',independentlyVerified:false}];
 });
 return {status:'OBSERVED',movements,acquisitionVerified:false,historyComplete:false};
}
