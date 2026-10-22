import {compareHolderInfrastructureExclusion} from "../lib/holderInfrastructureSensitivity.mjs";
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error("SUPABASE_READ_CONFIG_MISSING");
const get=async path=>{const response=await fetch(url+"/rest/v1/"+path,{headers:{apikey:key,Authorization:"Bearer "+key},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error("SUPABASE_READ_FAILED");return response.json();};
const snapshotId="1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153";
const jobIds=["c670f393-31b0-470c-a01f-cb2b813a1219","d07c0256-b472-4089-a237-99ed5e5c8cc4"];
const pool="6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA";
const rows=await get("glitch_top20_snapshots?select=*&id=eq."+snapshotId);
const s=rows[0];
if(rows.length!==1||s.status!=="frozen")throw Error("SNAPSHOT_UNAVAILABLE");
const jobs=await get("glitch_holder_scan_jobs?select=id,mint,status,updated_at,checkpoint&id=in.("+jobIds.join(",")+")");
if(jobs.length!==2||jobs.some(j=>j.mint!==s.mint))throw Error("JOBS_UNAVAILABLE");
const transfers=new Map();
for(const job of jobs)for(const t of job.checkpoint?.networkEvidence?.transfers??[]){
 const k=[t.signature,t.from,t.to,t.assetType,t.mint??"",t.amountRaw].join("|");
 if(!transfers.has(k))transfers.set(k,t);
}
const result=compareHolderInfrastructureExclusion({snapshot:s,transfers:[...transfers.values()],pool});
console.log(JSON.stringify({status:"OBSERVED_ONLY",snapshotId,sourceJobs:jobs.map(j=>({id:j.id,status:j.status,updatedAt:j.updated_at})),uniqueTransfers:transfers.size,baseline:{score:result.baseline.score,evidence:result.baseline.evidence,penalties:result.baseline.penalties},poolExcluded:{score:result.excluded.score,evidence:result.excluded.evidence,penalties:result.excluded.penalties},delta:result.delta,historyComplete:false,scorePromoted:false,snapshotModified:false}));
