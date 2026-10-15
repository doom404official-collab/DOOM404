// Read-only historical discovery of direct SOL transfers from a sampled wallet history.
// All edges carry on-chain signatures. Does not claim complete wallet history.
import {Connection,PublicKey} from '@solana/web3.js';
import {extractCrossAssetTokenTransfers} from './crossAssetTokenTransfers.mjs';
import {collectSignaturePages} from './signaturePagination.mjs';
export async function discoverSolRelationships({rpcUrl,wallet,limit=100,maxPages=1}={}) {
 if(!rpcUrl || !wallet)throw new TypeError('RPC URL and wallet required');
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw new TypeError('limit must be 1..1000');
 const connection=new Connection(rpcUrl,'finalized');
 const key=new PublicKey(wallet);
 const paginated=await collectSignaturePages({connection,key,pageSize:limit,maxPages});
 const signatures=paginated.signatures;
 const edges=[],errors=[];
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 let rateLimitedCount=0;
 for(const entry of signatures){
  if(entry.err)continue;
  try{
   let tx;
   for(let attempt=0;attempt<4;attempt++){
    try{
     tx=await connection.getParsedTransaction(entry.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
     break;
    }catch(error){
     if(!/429|too many requests|rate limit/i.test(String(error?.message??error))||attempt===3)throw error;
     rateLimitedCount++;
     await sleep(1200*Math.pow(2,attempt));
    }
   }
   if(!tx || tx.meta?.err!==null){errors.push(entry.signature);continue;}
   edges.push(...extractCrossAssetTokenTransfers(tx,{signature:entry.signature,wallet}));
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
  await sleep(350);
 }
 return {wallet,edges,coverage:{signaturesRetrieved:signatures.length,decoded:signatures.length-errors.length,
   failed:errors.length,rateLimitedCount,requestedLimit:limit,maxPages,
   ...paginated.coverage,exhausted:paginated.coverage.historyExhausted,
   scope:'Recent signatures for one wallet; explicit SOL and owner-resolved SPL transfers, not full history'}};
}
