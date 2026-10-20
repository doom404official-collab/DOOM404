import {corroboratePumpFunCreatorBuySettlement} from './pumpFunCreatorBuySettlement.mjs';
import {resolveTokenBalanceAccounts} from './solanaTokenBalanceAccountResolver.mjs';
/** Reconcile historical creator token balance and SOL spending with buy-group observations.
 * Only single-buy transactions qualify: aggregate deltas cannot be attributed safely
 * across multiple buys or other balance-changing instructions.
 */
export function reconcilePumpFunCreatorBuy({mint,creator,transaction}={}){
 const candidates=corroboratePumpFunCreatorBuySettlement({mint,creator,transaction});
 if(candidates.length!==1)return {status:'UNVERIFIED',reason:'AMBIGUOUS_OR_MISSING_BUY'};
 const buy=candidates[0],resolved=resolveTokenBalanceAccounts({transaction});
 // Transaction-wide deltas cannot isolate the buy if unrelated instructions move assets.
 const outer=transaction.transaction?.message?.instructions||[];
 if(outer.length!==1||buy.instructionIndex!==0)return {status:'UNVERIFIED',reason:'MULTIPLE_OUTER_INSTRUCTIONS'};
 const pre=resolved.pre.filter(x=>x.mint===mint&&x.owner===creator);
 const post=resolved.post.filter(x=>x.mint===mint&&x.owner===creator);
 const total=rows=>rows.reduce((sum,x)=>sum+BigInt(x.uiTokenAmount?.amount||'0'),0n);
 const delta=total(post)-total(pre);
 if(delta!==BigInt(buy.amountRaw))return {status:'UNVERIFIED',reason:'BUY_TOKEN_DELTA_MISMATCH'};
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const i=keys.indexOf(creator),before=transaction.meta?.preBalances?.[i],after=transaction.meta?.postBalances?.[i];
 const fee=transaction.meta?.fee;
 if(i<0||!Number.isSafeInteger(before)||!Number.isSafeInteger(after)||
  !Number.isSafeInteger(fee)||fee<0||
  BigInt(before)-BigInt(after)!==BigInt(buy.solPaidLamports)+BigInt(fee))
  return {status:'UNVERIFIED',reason:'BUY_SOL_DELTA_OR_FEE_MISMATCH'};
 return {status:'BALANCES_CORROBORATED',instructionIndex:buy.instructionIndex,
  amountRaw:buy.amountRaw,solPaidLamports:buy.solPaidLamports,
  purchaseVerified:false,independentlyVerified:false};
}
