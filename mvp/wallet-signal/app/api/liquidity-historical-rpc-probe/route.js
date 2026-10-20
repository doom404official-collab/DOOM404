import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {probeHistoricalAccountRpc} from "../../../lib/liquidityHistoricalRpcProbe.mjs";
export const dynamic="force-dynamic";
export async function POST(request){
 const token=process.env.GLITCH_LIQUIDITY_PROBE_TOKEN;
 if(!token||request.headers.get("x-glitch-internal-token")!==token)return NextResponse.json({error:"authentication_required"},{status:401});
 let payload;try{payload=await request.json()}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
 const slot=payload?.slot;
 const addresses=payload?.accounts;
 if(!Number.isSafeInteger(slot)||slot<=0||!Array.isArray(addresses)||addresses.length!==2||addresses.some(a=>{try{return new PublicKey(a).toBase58()!==a}catch{return true}}))return NextResponse.json({error:"invalid_probe_parameters"},{status:400});
 const rpcUrl=process.env.HELIUS_RPC_URL;
 const results=[];
 for(const account of addresses)results.push({account,...await probeHistoricalAccountRpc({rpcUrl,account,slot})});
 return NextResponse.json({provider:"helius",requestedSlot:slot,results,historicalStateVerified:false,authorizationVerified:false},{headers:{"Cache-Control":"no-store"}});
}
