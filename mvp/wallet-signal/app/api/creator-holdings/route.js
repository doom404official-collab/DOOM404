import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";
import { createIntelligenceVault } from "../../../lib/intelligenceVault.mjs";
import { resolveCachedCreator } from "../../../lib/resolveCachedCreator.mjs";
import { summarizeCreatorHoldings } from "../../../lib/creatorHoldings.js";

export const dynamic="force-dynamic";
export async function GET(request){
 let mint;
 try{mint=new PublicKey(new URL(request.url).searchParams.get("mint")||"");}
 catch{return NextResponse.json({error:"INVALID_MINT"},{status:400});}
 try{
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
   return NextResponse.json({status:"CREATOR_EVIDENCE_UNAVAILABLE"},{status:503});
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const evidence=await resolveCachedCreator({mint:mint.toBase58(),vault});
  if(!evidence.creator||!["VERIFIED","ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"].includes(evidence.status))
   return NextResponse.json({status:"CREATOR_NOT_CONFIRMED",holdings:null});
  const connection=createReliableConnection();
  const creator=new PublicKey(evidence.creator);
  const [accounts,supply]=await Promise.all([
   connection.getParsedTokenAccountsByOwner(creator,{mint},"confirmed"),
   connection.getTokenSupply(mint,"confirmed")
  ]);
  const summary=summarizeCreatorHoldings({mint:mint.toBase58(),creator:evidence.creator,
   tokenAccounts:accounts.value,supply:supply.value});
  return NextResponse.json({...summary,creatorEvidenceStatus:evidence.status},
   {headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({status:"HOLDINGS_UNAVAILABLE",holdings:null},{status:503});
 }
}
