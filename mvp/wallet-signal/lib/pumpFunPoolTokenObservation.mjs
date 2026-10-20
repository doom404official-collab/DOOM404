import {resolveTokenBalanceAccounts} from './solanaTokenBalanceAccountResolver.mjs';
/** Extract conservative SPL token movement observations for Pump.fun settlement review.
 * Owner balances alone cannot establish pool receipt; token accounts must be mapped.
 */
export function observePumpFunPoolTokenSettlement({transaction,mint,poolTokenAccounts=[]}={}){
 if(!transaction||transaction.meta?.err!=null||typeof mint!=='string'||!Array.isArray(poolTokenAccounts))
 return {status:'UNVERIFIED',reason:'INVALID_INPUT'};
 const known=new Set(poolTokenAccounts.filter(x=>typeof x==='string'));
 if(!known.size)return {status:'UNVERIFIED',reason:'POOL_TOKEN_ACCOUNT_NOT_ESTABLISHED'};
 const resolved=resolveTokenBalanceAccounts({transaction});
 const pre=resolved.pre,post=resolved.post;
 const read=(rows)=>rows.filter(x=>x?.mint===mint&&known.has(x?.accountPubkey))
  .reduce((sum,x)=>sum+BigInt(x?.uiTokenAmount?.amount||'0'),0n);
 const before=read(pre),after=read(post);
 const received=after-before;
 return {status:received>0n?'POOL_TOKEN_RECEIPT_OBSERVED':'UNVERIFIED',
  poolReceivedRaw:received>0n?received.toString():null,
  poolAccountOwnershipVerified:false,creatorPaymentVerified:false,
  settlementIndependentlyVerified:false};
}
