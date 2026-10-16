import {runStagedDiagnostic} from '../lib/heliusStagedDiagnostic.mjs';
const endpoint=process.env.HELIUS_RPC_URL;
if(!endpoint||!endpoint.startsWith('https://')){console.error('HELIUS_RPC_URL missing');process.exit(2);}
const result=await runStagedDiagnostic({rpc:async id=>{
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({jsonrpc:'2.0',id,method:'getSlot',params:[{commitment:'confirmed'}]}),
 signal:AbortSignal.timeout(8000)});
 const payload=response.ok?await response.json():null;
 return {success:response.ok&&Number.isInteger(payload?.result),rateLimited:response.status===429};
}});
console.log(JSON.stringify(result));
if(result.status!=='completed')process.exitCode=1;
