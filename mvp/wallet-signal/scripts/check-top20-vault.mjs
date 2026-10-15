// Read-only first persistence smoke test. A separate write-enabled workflow will follow.
// Never log service role keys or Supabase credentials.
import {createTop20Vault} from '../lib/top20Vault.mjs';
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');process.exitCode=2;}
else try{
 const vault=createTop20Vault({url,serviceRoleKey:key});
 const id=process.env.TOP20_SNAPSHOT_ID;
 if(id){
  if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid snapshot ID');
  const snapshot=await vault.getFrozen(id);
  const batches=await vault.getBatches(id);
  console.log(JSON.stringify({status:'ok',snapshotId:snapshot.id,slot:snapshot.snapshot_slot,
   storedHolders:snapshot.holder_ranking.length,batchCount:batches.length}));
 }else{
  console.log(JSON.stringify({status:'configured',note:'No snapshot ID supplied; no database write performed'}));
 }
}catch(error){console.error(JSON.stringify({status:'error',reason:String(error.message).replaceAll(key,'[REDACTED]').replaceAll(url,'[REDACTED]')}));process.exitCode=1;}
