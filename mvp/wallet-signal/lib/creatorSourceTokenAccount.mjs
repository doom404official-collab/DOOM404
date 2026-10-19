/** Verify creator source SPL token account from parsed account state.
 * Current ownership does not establish historical ownership at a sale slot.
 */
export function verifyCreatorSourceTokenAccount({mint,creator,tokenAccount,accountInfo}={}){
 const parsed=accountInfo?.value?.data?.parsed;
 const info=parsed?.info;
 if(!tokenAccount||parsed?.type!=='account'||info?.mint!==mint||info?.owner!==creator)
 return {status:'UNVERIFIED',reason:'SOURCE_TOKEN_ACCOUNT_STATE_MISMATCH'};
 return {status:'CREATOR_SOURCE_ACCOUNT_VERIFIED_CURRENT',tokenAccount,mint,creator,
  currentOwnershipVerified:true,historicalOwnershipVerified:false};
}
