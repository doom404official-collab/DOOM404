/** Identify explicit system-program SOL transfer instructions involving creator.
 * Transfers are payment candidates, not independent proof of swap settlement.
 */
export function identifyCreatorSolTransferCandidates({transaction,creator,pool}={}){
 if(!transaction||transaction.meta?.err!=null||!creator||!pool)return [];
 const outer=transaction.transaction?.message?.instructions||[];
 const inner=(transaction.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[]);
 return [...outer,...inner].filter(ix=>
  ix?.program==='system'&&ix?.parsed?.type==='transfer'&&
  ix.parsed.info?.destination===creator&&ix.parsed.info?.source===pool&&
  Number.isSafeInteger(ix.parsed.info?.lamports)&&ix.parsed.info.lamports>0)
 .map(ix=>({source:pool,destination:creator,lamports:ix.parsed.info.lamports,
  paymentObserved:true,linkedToPumpFunSellVerified:false,settlementVerified:false}));
}
