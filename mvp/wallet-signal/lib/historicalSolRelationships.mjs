// Read-only historical discovery of direct SOL transfers from a sampled wallet history.
// All edges carry on-chain signatures. Does not claim complete wallet history.
import {Connection,PublicKey} from '@solana/web3.js';
export async function discoverSolRelationships({rpcUrl,wallet,limit=100}={}) {
 if(!rpcUrl || !wallet)throw new TypeError('RPC URL and wallet required');
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw new TypeError('limit must be 1..1000');
 const connection=new Connection(rpcUrl,'finalized');
 const key=new PublicKey(wallet);
 const signatures=await connection.getSignaturesForAddress(key,{limit},'finalized');
 const edges=[],errors=[];
 for(const entry of signatures){
  if(entry.err)continue;
  try{
   const tx=await connection.getParsedTransaction(entry.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
   if(!tx || tx.meta?.err!==null){errors.push(entry.signature);continue;}
   const instructions=[...(tx.transaction?.message?.instructions??[]),
     ...(tx.meta?.innerInstructions??[]).flatMap(g=>g.instructions??[])];
   for(const ix of instructions){
    if(ix.program!=='system'||ix.parsed?.type!=='transfer')continue;
    const {source,destination,lamports}=ix.parsed.info??{};
    if(typeof source!=='string'||typeof destination!=='string'||source===destination)continue;
    if(source!==wallet && destination!==wallet)continue;
    if(!Number.isSafeInteger(Number(lamports))||Number(lamports)<=0)continue;
    edges.push({from:source,to:destination,signature:entry.signature,assetType:'SOL',
      verifiedOnChain:true,transferVerified:true,lamports:Number(lamports),slot:tx.slot});
   }
  }catch{errors.push(entry.signature);}
 }
 return {wallet,edges,coverage:{signaturesRetrieved:signatures.length,decoded:signatures.length-errors.length,
   failed:errors.length,requestedLimit:limit,exhausted:signatures.length<limit,
   scope:'Recent signatures for one wallet; not full history'}};
}
