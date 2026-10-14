import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {createReliableConnection} from "../../../lib/reliableConnection.js";
import {extractDirectHolderTransfers} from "../../../lib/directHolderTransfers.mjs";
import {buildHolderConnectionGraph} from "../../../lib/holderConnectionGraph.mjs";
export const dynamic="force-dynamic";
export async function GET(request){
 let mint;
 try{mint=new PublicKey(new URL(request.url).searchParams.get("mint")||"");}
 catch{return NextResponse.json({error:"Invalid token address"},{status:400});}
 try{
  const connection=createReliableConnection({primary:process.env.HELIUS_RPC_URL||process.env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com"});
  const [largest,supply]=await Promise.all([connection.getTokenLargestAccounts(mint,"confirmed"),connection.getTokenSupply(mint,"confirmed")]);
  const total=BigInt(supply.value.amount);
  if(total<=0n)return NextResponse.json({error:"Token supply unavailable"},{status:422});
  const rows=largest.value.slice(0,20).map((r,i)=>({rank:i+1,tokenAccount:r.address.toBase58(),amount:r.amount,sharePct:Number(BigInt(r.amount)*1000000n/total)/10000}));
  const infos=await Promise.allSettled(rows.map(r=>connection.getParsedAccountInfo(new PublicKey(r.tokenAccount),"confirmed")));
  const holders=rows.map((r,i)=>({...r,ownerWallet:infos[i].status==="fulfilled"?infos[i].value.value?.data?.parsed?.info?.owner||null:null}));
  const wallets=[...new Set(holders.map(r=>r.ownerWallet).filter(Boolean))];
  const signatureSet=new Set(),signatures=[];
  // Initial live sample only; bounded to control latency and RPC costs.
  for(const wallet of wallets){
   const entries=await connection.getSignaturesForAddress(new PublicKey(wallet),{limit:2},"confirmed");
   for(const entry of entries)if(!entry.err&&!signatureSet.has(entry.signature)){signatureSet.add(entry.signature);signatures.push(entry.signature);}
  }
  const txs=[];
  let checked=0,failures=0;
  for(const signature of signatures){
   try{
    const tx=await connection.getParsedTransaction(signature,{commitment:"confirmed",maxSupportedTransactionVersion:0});
    if(!tx){failures++;continue;}
    checked++;
    txs.push(...extractDirectHolderTransfers({transaction:tx,signature,holderWallets:wallets,tokenAccounts:holders}));
   }catch{failures++;}
  }
  const graph=buildHolderConnectionGraph({holders,transactions:txs,historyComplete:false});
  const sum=rows.reduce((n,r)=>n+BigInt(r.amount),0n);
  return NextResponse.json({mint:mint.toBase58(),observedAt:new Date().toISOString(),
   top20SharePct:Number(sum*1000000n/total)/10000,ownerWalletsResolved:wallets.length,
   topAccounts:rows.length,connectedWallets:graph.connectedWalletCount,directPairs:graph.edges.length,
   connectedGroups:graph.connectedGroups,holders:holders.filter(h=>h.ownerWallet).map(h=>({ownerWallet:h.ownerWallet,sharePct:h.sharePct,tokenAccount:h.tokenAccount})),transactionsChecked:checked,transactionFailures:failures,
   historyScope:"Two recent signatures per owner wallet; older history not examined",
   commonOwnershipEstablished:false,completeHistory:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Live holder analysis unavailable; retry later"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
