import {runTop20Job} from '../lib/runTop20Job.mjs';
const snapshotId=process.env.TOP20_SNAPSHOT_ID;
if(!snapshotId||!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY){
 console.error('Required configuration missing');process.exitCode=2;
}else{
 try{
  const result=await runTop20Job({snapshotId,rpcUrl:process.env.HELIUS_RPC_URL,
   url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  console.log(JSON.stringify(result));
  if(result.status!=='sampled_not_final')process.exitCode=1;
 }catch(error){
  console.error(JSON.stringify({status:'error',code:'TOP20_JOB_FAILED',category:error?.name??'Error'}));
  process.exitCode=1;
 }
}
