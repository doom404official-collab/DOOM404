/** Extract instruction-addressable SPL transfer candidates without inferring a trade. */
export function observeCreatorSplTransfers({mint,creator,signature,transaction}={}){
 if(!transaction||transaction.meta?.err!=null||!mint||!creator||!signature)return [];
 const outer=transaction.transaction?.message?.instructions||[];
 const groups=(transaction.meta?.innerInstructions||[]).filter(g=>Number.isInteger(g?.index)&&g.index>=0);
 const indexed=[
  ...outer.map((instruction,instructionIndex)=>({instruction,instructionIndex,innerInstructionIndex:null})),
  ...groups.flatMap(g=>(g.instructions||[]).map((instruction,innerInstructionIndex)=>({
   instruction,instructionIndex:g.index,innerInstructionIndex})))
 ];
 return indexed.flatMap(({instruction:ix,instructionIndex,innerInstructionIndex})=>{
  const info=ix?.parsed?.info;
  if(!['spl-token','spl-token-2022'].includes(ix?.program)||
   !['transfer','transferChecked'].includes(ix?.parsed?.type)||
   !info?.source||!info?.destination||info.mint&&info.mint!==mint)return [];
  const amount=String(info.tokenAmount?.amount??info.amount??'');
  if(!/^[0-9]+$/.test(amount)||BigInt(amount)<=0n)return [];
  return [{signature,instructionIndex,innerInstructionIndex,mint:info.mint||null,
   sourceTokenAccount:info.source,destinationTokenAccount:info.destination,
   amountRaw:amount,classification:'UNVERIFIED_SPL_TRANSFER',
   creator,independentlyVerified:false}];
 });
}
