// GLITCH liquidity evidence worker — conservative first-stage pool-account checks.
// This does not establish reserve depth, LP safety, or a final liquidity score.
import { PublicKey } from "@solana/web3.js";
const base = process.env.GLITCH_PREVIEW_URL?.replace(/\/$/, "");
const token = process.env.GLITCH_LIQUIDITY_WORKER_TOKEN;
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const mint = process.env.GLITCH_LIQUIDITY_MINT;
if (!base || !token || !mint) throw Error("Missing worker configuration");
if (!new URL(base).hostname.endsWith(".vercel.app") || new URL(base).protocol !== "https:") throw Error("Invalid preview URL");
const address = new PublicKey(mint).toBase58();
if (address !== mint) throw Error("Invalid mint");
const headers = {Accept:"application/json", ...(bypass?{"x-vercel-protection-bypass":bypass}:{})};
async function read(url,options={}) {
 const response = await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000),redirect:"error"});
 if (!response.ok) throw Error("Evidence endpoint returned "+response.status);
 return response.json();
}
const report = await read(base+"/api/token-liquidity?mint="+encodeURIComponent(mint));
if (!Array.isArray(report.pools)) throw Error("Missing pool inventory");
const pools = report.pools.filter(p=>p.pairAddress).slice(0,30);
let checked=0, exists=0, errors=0;
for(let i=0;i<pools.length;i+=5){
 try {
  const batch=await read(base+"/api/pool-account-evidence",{method:"POST",headers:{"Content-Type":"application/json","x-glitch-worker-token":token},body:JSON.stringify({mint,poolAddresses:pools.slice(i,i+5).map(p=>p.pairAddress)})});
  checked+=batch.pools?.length||0;
  exists+=batch.pools?.filter(p=>p.accountExists).length||0;
 }catch {errors++;}
}
console.log(JSON.stringify({status:errors?"partial":"account_checks_completed",mint,reportedPools:report.poolCountReturned,checked,exists,batchErrors:errors,verifiedDepth:false,lpSecurityVerified:false,finalScore:null}));
if(errors)process.exitCode=1;
