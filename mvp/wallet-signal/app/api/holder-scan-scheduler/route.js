import {createHolderWorkerBudget} from "../../../lib/holderWorkerExecution.mjs";
import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
export const dynamic="force-dynamic";
function authorized(request){
 const secret=process.env.GLITCH_HOLDER_WORKER_TOKEN;
 const supplied=request.headers.get("x-glitch-worker-token");
 if(!secret||!supplied)return false;
 const a=Buffer.from(secret),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function POST(request){
 if(process.env.GLITCH_HOLDER_WORKER_ENABLED!=="true")return NextResponse.json({error:"Worker disabled"},{status:503});
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const budget=createHolderWorkerBudget();
  const store=createHolderJobStore();
  const row=await budget.run("SELECTION",signal=>store.getNextRunnable({signal}));
  if(!row)return NextResponse.json({status:"idle"},{headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({status:"candidate",jobId:row.id},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Scheduler lookup unavailable"},{status:503});}
}
