import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";
import { summarizeLpHolders } from "../../../lib/liquidityLpHolderEvidence.mjs";

export const dynamic = "force-dynamic";
export async function POST(request) {
 let payload;
 try { payload=await request.json(); } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}); }
 let mint;
 try { mint=new PublicKey(payload?.lpMint); if(mint.toBase58()!==payload.lpMint)throw Error(); }
 catch { return NextResponse.json({error:"Invalid LP mint"},{status:400}); }
 try {
  const connection=createReliableConnection({timeoutMs:8000,retries:1});
  const largest=await connection.getTokenLargestAccounts(mint,"confirmed");
  const top=(largest.value||[]).slice(0,20);
  const accountAddresses=top.map(x=>x.address);
  const accounts=accountAddresses.length?await connection.getMultipleAccountsInfo(accountAddresses,"confirmed"):[];
  const entries=top.flatMap((x,i)=>{
   const account=accounts[i];
   if(!account||!Buffer.isBuffer(account.data)||account.data.length<165)return [];
   const observedMint=new PublicKey(account.data.subarray(0,32)).toBase58();
   if(observedMint!==mint.toBase58())return [];
   return [{tokenAccount:x.address.toBase58(),owner:new PublicKey(account.data.subarray(32,64)).toBase58(),amount:account.data.readBigUInt64LE(64).toString()}];
  });
  const supply=await connection.getTokenSupply(mint,"confirmed");
  const summary=summarizeLpHolders(entries,supply.value.amount,false);
  return NextResponse.json({status:"partial",lpMint:mint.toBase58(),observedAt:new Date().toISOString(),source:"Solana RPC getTokenLargestAccounts and getMultipleAccountsInfo",tokenAccountsReturned:top.length,tokenAccountsDecoded:entries.length,coverage:"top_20_token_accounts_only",...summary},{headers:{"Cache-Control":"no-store"}});
 } catch {return NextResponse.json({status:"unavailable",reason:"LP holder RPC evidence unavailable"},{status:503});}
}
