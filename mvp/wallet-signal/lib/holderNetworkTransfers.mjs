// Confirmed parsed transfer instructions only. Co-occurrence and balance deltas
// are not transfers. Token owners come from transaction-local balance metadata.
const address=x=>typeof x==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
const signatureValid=x=>typeof x==='string'&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(x);
const programs={SOL:'11111111111111111111111111111111',SPL:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',TOKEN_2022:'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'};
const uint=x=>(typeof x==='string'&&/^\d+$/.test(x))||(Number.isSafeInteger(x)&&x>=0);
const positive=x=>(typeof x==='string'&&/^\d+$/.test(x)&&BigInt(x)>0n)||(Number.isSafeInteger(x)&&x>0);
export function extractHolderNetworkTransfers({transaction:tx,signature}={}){
 if(!signatureValid(signature)||!Number.isSafeInteger(tx?.slot)||tx.slot<0||!tx.meta||!Object.hasOwn(tx.meta,'err')||tx.meta.err!==null||tx.transaction?.signatures?.[0]!==signature)
  return {valid:false,transfers:[],reason:'CONFIRMED_TRANSACTION_UNVERIFIED'};
 const message=tx.transaction.message;
 if(!message||!Array.isArray(message.accountKeys)||!Array.isArray(message.instructions)||!Array.isArray(tx.meta.innerInstructions)||tx.meta.innerInstructions.some(x=>!Array.isArray(x?.instructions)))
  return {valid:false,transfers:[],reason:'TRANSACTION_INSTRUCTIONS_UNAVAILABLE'};
 const keys=(tx.transaction.message?.accountKeys??[]).map(k=>typeof k==='string'?k:k?.pubkey);
 const owners=new Map(),conflicts=new Set();
 for(const b of [...(tx.meta.preTokenBalances??[]),...(tx.meta.postTokenBalances??[])]){
  const account=keys[b.accountIndex];
  if(!Number.isInteger(b.accountIndex)||!address(account)||!address(b.owner)||!address(b.mint))continue;
  const old=owners.get(account);
  if(old&&(old.owner!==b.owner||old.mint!==b.mint))conflicts.add(account);
  owners.set(account,{owner:b.owner,mint:b.mint});
 }
 const instructions=[...(tx.transaction.message?.instructions??[]),...(tx.meta.innerInstructions??[]).flatMap(x=>x.instructions??[])];
 const transfers=new Map();let unresolvedTokenTransfers=0;
 const unresolvedReasons={};
 const unresolved=reason=>{unresolvedTokenTransfers++;unresolvedReasons[reason]=(unresolvedReasons[reason]??0)+1;};
 // End-state owner metadata cannot resolve transfer-time ownership across an
 // owner change (including changing away and back within the same transaction).
 for(const ix of instructions)if((ix?.programId===programs.SPL||ix?.programId===programs.TOKEN_2022)&&ix?.parsed?.type==='setAuthority'&&ix.parsed.info?.authorityType==='accountOwner')conflicts.add(ix.parsed.info.account);
 for(const ix of instructions){
  const p=ix?.parsed,info=p?.info;
  const known=Object.values(programs).includes(ix?.programId);
  if(!known)continue;
  if(!p||typeof p.type!=='string'){unresolved("UNPARSED_INSTRUCTION");continue;}
  if(!['transfer','transferChecked'].includes(p.type)){
   if(/transfer/i.test(p.type))unresolved("UNSUPPORTED_TRANSFER_TYPE");
   continue;
  }
  if(!info){unresolved("TRANSFER_INFO_MISSING");continue;}
  let assetType,from,to,mint=null,amount;
  if(ix.programId===programs.SOL&&ix.program==='system'&&p.type==='transfer'){
   assetType='SOL';from=info.source;to=info.destination;amount=info.lamports;
  }else if(ix.programId===programs.SPL||ix.programId===programs.TOKEN_2022){
   assetType=ix.programId===programs.SPL?'SPL':'TOKEN_2022';
   amount=p.type==='transferChecked'?info.tokenAmount?.amount:info.amount;
   if(!uint(amount)){unresolved("TRANSFER_AMOUNT_INVALID");continue;}
   if(!positive(amount))continue;
   const source=owners.get(info.source),destination=owners.get(info.destination);
   if(conflicts.has(info.source)||conflicts.has(info.destination)||!source||!destination||source.mint!==destination.mint||
    (p.type==='transferChecked'&&info.mint!==source.mint)){
    unresolved(conflicts.has(info.source)||conflicts.has(info.destination)?"OWNER_CONFLICT":!source||!destination?"OWNER_METADATA_MISSING":source.mint!==destination.mint?"TOKEN_MINT_MISMATCH":"CHECKED_MINT_MISMATCH");continue;}
   from=source.owner;to=destination.owner;mint=source.mint;
  }else {unresolved("UNCLASSIFIED_TRANSFER");continue;}
  if(!uint(amount)||!address(from)||!address(to)){unresolved("UNCLASSIFIED_TRANSFER");continue;}
  if(from===to||!positive(amount))continue;
  const edge={signature,slot:tx.slot,from,to,assetType,mint,amountRaw:String(amount),verifiedOnChain:true,transferVerified:true};
  transfers.set([signature,from,to,assetType,mint??'',edge.amountRaw].join('|'),edge);
 }
 return {valid:true,transfers:[...transfers.values()],unresolvedTokenTransfers,unresolvedReasons};
}
export {address as validNetworkAddress,signatureValid as validNetworkSignature};
