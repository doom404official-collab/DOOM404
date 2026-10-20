import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {decodeArchivedPumpAccount} from "../../../lib/liquidityArchiveStateDecoder.mjs";
export const dynamic="force-dynamic";
const POOL="6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA";
const GLOBAL="ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw";
export async function POST(request){
 const token=process.env.GLITCH_LIQUIDITY_PROBE_TOKEN;
 if(!token||request.headers.get("x-glitch-internal-token")!==token)return NextResponse.json({error:"authentication_required"},{status:401});
 const rpcUrl=process.env.ALCHEMY_SOLANA_ARCHIVE_RPC_URL;
 if(!rpcUrl)return NextResponse.json({status:"NOT_CONFIGURED"},{status:503});
 const slot=458811200;
 const compareSlots=[slot-1,slot,slot+1];
 const targets=[{address:POOL,role:"pump_amm_pool"},{address:GLOBAL,role:"pump_amm_global_config"}];
 const results=[];
 const timeline=[];
 for(const target of targets){
  try{
   const response=await fetch(rpcUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:[target.address,{encoding:"base64",slot}]}),signal:AbortSignal.timeout(12000),cache:"no-store"});
   const json=await response.json();
   if(!response.ok||json.error){results.push({role:target.role,status:"PROVIDER_ERROR",errorCode:json.error?.code??null});continue;}
   const contextSlot=json.result?.context?.slot;
   const decoded=decodeArchivedPumpAccount(json.result?.value,target.role);
   results.push({role:target.role,status:decoded.status,contextSlot,requestedSlot:slot,decodedCoinCreator:target.role==="pump_amm_pool"?decoded.coinCreator??null:undefined,expectedCreatorFeeRecipient:target.role==="pump_amm_pool"?"HGBJMtxiFXSkZRk838n5mmHwvRtribAUdCAT1gyoYzSd":undefined,recipientMatch:target.role==="pump_amm_pool"?decoded.coinCreator==="HGBJMtxiFXSkZRk838n5mmHwvRtribAUdCAT1gyoYzSd":decoded.protocolFeeRecipients?.includes("7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ")??false,accountOwnerAndLayoutValidated:decoded.status==="DECODED",historicalStateVerified:false});
  }catch{results.push({role:target.role,status:"REQUEST_FAILED",historicalStateVerified:false});}
 }
 for(const targetSlot of compareSlots){
  try{
   const response=await fetch(rpcUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:[POOL,{encoding:"base64",slot:targetSlot}]}),signal:AbortSignal.timeout(12000),cache:"no-store"});
   const json=await response.json();
   const decoded=decodeArchivedPumpAccount(json.result?.value,"pump_amm_pool");
   timeline.push({requestedSlot:targetSlot,contextSlot:json.result?.context?.slot??null,status:response.ok&&!json.error?decoded.status:"PROVIDER_ERROR",coinCreator:decoded.coinCreator??null,historicalStateVerified:false});
  }catch{timeline.push({requestedSlot:targetSlot,status:"REQUEST_FAILED",historicalStateVerified:false});}
 }
 return NextResponse.json({provider:"alchemy",slot,results,timeline,historicalStateVerified:false,authorizationVerified:false,warning:"Context slot and decoded bytes alone are not independently authenticated historical state proof."},{headers:{"Cache-Control":"no-store"}});
}
