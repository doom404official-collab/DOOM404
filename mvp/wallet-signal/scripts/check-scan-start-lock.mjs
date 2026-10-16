// Isolated live lock contention diagnostic. Never invokes Helius or scan endpoints.
// Uses a random diagnostic mint-like key and releases it after the test.
import {randomUUID} from 'node:crypto';
import {createScanStartLock} from '../lib/scanStartLock.mjs';
const manager=createScanStartLock({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
const mint='Diag'+randomUUID().replaceAll('-','').slice(0,32);
let acquired=null;
try{
 const attempts=await Promise.allSettled(Array.from({length:8},()=>manager.acquire(mint)));
 const successes=attempts.filter(r=>r.status==='fulfilled'&&r.value!==null);
 const denials=attempts.filter(r=>r.status==='fulfilled'&&r.value===null).length;
 const errors=attempts.filter(r=>r.status==='rejected').length;
 acquired=successes[0]?.value??null;
 console.log(JSON.stringify({attempted:8,granted:successes.length,denied:denials,errors,
  scope:'isolated database lock only; zero Helius requests'}));
 if(successes.length!==1||denials!==7||errors)process.exitCode=1;
}finally{
 if(acquired)await manager.release(acquired);
}
