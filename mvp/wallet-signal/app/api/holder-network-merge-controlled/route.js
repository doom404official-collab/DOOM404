import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
import {createHolderEvidenceStore} from "../../../lib/holderEvidenceStore.mjs";
import {commitExternalNetworkEvidence} from "../../../lib/commitExternalNetworkEvidence.mjs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const jobId="d07c0256-b472-4089-a237-99ed5e5c8cc4";
const expectedMint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const allowedSignatures=[
 "2wrXV5pM48JE4ioD5cusk3S3cq1GTR4G8UbKbSKqyHTwEhhk4BJwRnAxrs8h5WgRMZXL7mhuRFH9hYCJYHDce4af",
 "34VZbUf1z9VDA6RLpDJx169qXMzGxoPAR8Pwo4EpUV8PjGaaCbgukkvnyNnHHxbiXe3trtJzzDVWY363KVcgCGDo",
 "3HnBUrUjjG3yxMubsrrnN5dMPJtSrhM5WajYopUbCgKBFo5rtvZdf5LChJRJ4wR4Ua8XsnkKMG9d48AQYDDUPLhf"
];
export async function POST(request){
 const expected=process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN;
 const supplied=request.headers.get("x-glitch-internal-token");
 if(!expected||!supplied)return NextResponse.json({error:"Unauthorized"},{status:401});
 const a=Buffer.from(expected),b=Buffer.from(supplied);
 if(a.length!==b.length||!timingSafeEqual(a,b))return NextResponse.json({error:"Unauthorized"},{status:401});
 if(process.env.GLITCH_NETWORK_MERGE_ENABLED!=="true")return NextResponse.json({status:"disabled"},{status:403});
 try{
  const result=await commitExternalNetworkEvidence({jobId,expectedMint,allowedSignatures,limit:3,
   jobStore:createHolderJobStore(),evidenceStore:createHolderEvidenceStore()});
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("GLITCH_NETWORK_MERGE_FAILED",{code:String(error?.message??"UNKNOWN").slice(0,80)});
  // A failed response does not prove the atomic commit failed. Never retry blindly.
  return NextResponse.json({status:"outcome_unknown",checkpointModified:null,scorePromoted:false,
   reconciliationRequired:true,retryAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
