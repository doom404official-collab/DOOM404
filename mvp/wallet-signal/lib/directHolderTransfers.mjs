/**
 * Extract direct holder-to-holder transfers from finalized/confirmed parsed Solana
 * transactions. Same-transaction co-occurrence is not a direct connection.
 * The caller must provide successfully confirmed transactions and coverage.
 */
export function extractDirectHolderTransfers({transaction,signature,holderWallets=[],tokenAccounts=[]}={}){
 if(!transaction||transaction.meta?.err!=null||!transaction.slot||typeof signature!=="string")return [];
 const holders=new Set(holderWallets);
 const tokenOwners=new Map(tokenAccounts.filter(x=>x?.tokenAccount&&x?.ownerWallet).map(x=>[x.tokenAccount,x.ownerWallet]));
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(x=>typeof x==="string"?x:x.pubkey?.toString?.());
 const instructions=[...(transaction.transaction?.message?.instructions||[]),
  ...(transaction.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 const found=new Map();
 for(const ix of instructions){
  const p=ix?.parsed;
  if(!p||typeof p!=="object"||!p.info)continue;
  const program=ix.program||ix.programId?.toString?.();
  let from,to,kind;
  if(program==="system"&&p.type==="transfer"&&Number(p.info.lamports)>0){
   from=p.info.source;to=p.info.destination;kind="SOL_TRANSFER";
  }else if((program==="spl-token"||program==="spl-token-2022"||
    program==="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"||
    program==="TokenzQdBNbLqP5VEhdkAS6EPFtpGz5XPTaXQyq8j")&&
    ["transfer","transferChecked"].includes(p.type)){
   from=tokenOwners.get(p.info.source);to=tokenOwners.get(p.info.destination);
   kind="SPL_TOKEN_TRANSFER";
  }else continue;
  if(!holders.has(from)||!holders.has(to)||from===to)continue;
  const pair=[from,to].sort(),key=pair.join("|");
  if(!found.has(key))found.set(key,{confirmed:true,directInteraction:true,signature,participants:pair,kind});
 }
 return [...found.values()];
}
