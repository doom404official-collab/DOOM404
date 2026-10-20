/** Extract explicit SPL transfer candidates from a parsed transaction.
 * These are unverified observations until account ownership and purpose are proven.
 */
export function observeCreatorSplTransfers({mint,creator,signature,transaction}={}){
 if(!transaction||transaction.meta?.err!=null||!mint||!creator||!signature)return [];
 const outer=transaction.transaction?.message?.instructions||[];
 const inner=(transaction.meta?.innerInstructions||[]).flatMap(g=>g.instructions||[]);
 return [...outer,...inner].flatMap((ix,index)=>{
  const info=ix?.parsed?.info;
  if(!['spl-token','spl-token-2022'].includes(ix?.program)||
   !['transfer','transferChecked'].includes(ix?.parsed?.type)||
   !info?.source||!info?.destination)return [];
  const amount=String(info.tokenAmount?.amount??info.amount??'');
  if(!/^[0-9]+$/.test(amount)||BigInt(amount)<=0n)return [];
  return [{signature,instructionIndex:index,mint:info.mint||null,
   sourceTokenAccount:info.source,destinationTokenAccount:info.destination,
   amountRaw:amount,classification:'UNVERIFIED_SPL_TRANSFER',
   creator,independentlyVerified:false}];
 });
}
