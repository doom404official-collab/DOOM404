// First-stage liquidity evidence: pool account existence only, never a final risk score.
import { PublicKey } from "@solana/web3.js";
import { writeFile } from "node:fs/promises";
import { validateLiquidityCheckpoint } from "../lib/liquidityEvidenceCheckpoint.mjs";
import { persistLiquidityCheckpoint } from "../lib/liquidityCheckpointStore.mjs";
const base = process.env.GLITCH_PREVIEW_URL?.replace(/\/$/, "");
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const mint = process.env.GLITCH_LIQUIDITY_MINT;
if (!base || !mint) throw Error("Missing preview URL or mint");
const target = new URL(base);
if (target.protocol !== "https:" || !target.hostname.endsWith(".vercel.app") || target.username || target.password || target.pathname !== "/") throw Error("Invalid preview URL");
if (new PublicKey(mint).toBase58() !== mint) throw Error("Invalid mint");
const headers = {Accept:"application/json",...(bypass?{"x-vercel-protection-bypass":bypass}:{})};
async function read(path,options={}) {
 const response=await fetch(base+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000),redirect:"error"});
 if(!response.ok)throw Error("Evidence endpoint HTTP "+response.status);
 return response.json();
}
const report=await read("/api/token-liquidity?mint="+encodeURIComponent(mint));
if(!Array.isArray(report.pools))throw Error("Missing pool inventory");
const addresses=[...new Set(report.pools.map(p=>p.pairAddress).filter(Boolean))].slice(0,30);
const evidence={schemaVersion:1,mint,observedAt:new Date().toISOString(),source:"Solana RPC via GLITCH pool-account-evidence",providerReportedPools:report.poolCountReturned,poolInventoryComplete:false,verifiedDepth:false,lpSecurityVerified:false,finalScore:null,pools:[],batchErrors:[]};
for(let i=0;i<addresses.length;i+=5){
 const batchAddresses=addresses.slice(i,i+5);
 try {
  const batch=await read("/api/pool-account-evidence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mint,poolAddresses:batchAddresses})});
  if(batch.mint!==mint||!Array.isArray(batch.pools)||batch.pools.length!==batchAddresses.length)throw Error("Unexpected pool evidence response");
  evidence.pools.push(...batch.pools);
 }catch(error){evidence.batchErrors.push({startIndex:i,count:batchAddresses.length,error:String(error.message).slice(0,160)});}
}
evidence.status=evidence.batchErrors.length?"partial":"account_checks_completed";
evidence.checked=evidence.pools.length;
evidence.accountExists=evidence.pools.filter(p=>p.accountExists).length;
validateLiquidityCheckpoint(evidence);
await writeFile(process.env.GLITCH_EVIDENCE_OUTPUT||"liquidity-evidence.json",JSON.stringify(evidence,null,2));
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
 await persistLiquidityCheckpoint(evidence,{url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
} else {
 throw Error("LIQUIDITY_STORAGE_NOT_CONFIGURED: audit artifact written but checkpoint not persisted");
}
console.log(JSON.stringify({status:evidence.status,mint,reportedPools:evidence.providerReportedPools,checked:evidence.checked,exists:evidence.accountExists,batchErrors:evidence.batchErrors.length,verifiedDepth:false,lpSecurityVerified:false,finalScore:null}));
if(evidence.batchErrors.length)process.exitCode=1;
