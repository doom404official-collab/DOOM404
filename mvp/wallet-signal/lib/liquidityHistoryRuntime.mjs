import {open,rename,unlink,lstat} from 'node:fs/promises';
// Local process safeguards only: not a hosted lease or distributed fencing.
export function createLiquidityHistoryDeadline({durationMs=480000,signal,now=()=>performance.now(),requestMs=20000}={}){
 if(!Number.isSafeInteger(durationMs)||durationMs<1||durationMs>480000||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>20000)throw Error('INVALID_HISTORY_DURATION');
 const end=now()+durationMs;let stopped=false;
 const check=()=>{if(stopped||signal?.aborted||now()>=end){stopped=true;throw Error('HISTORY_INTERRUPTED_OR_DEADLINE');}};
 return {check,async run(operation){
  check();const controller=new AbortController();let listener,timer;
  const abort=()=>{stopped=true;controller.abort();};
  const cancelled=new Promise((_,reject)=>{listener=()=>reject(Error('HISTORY_INTERRUPTED_OR_DEADLINE'));controller.signal.addEventListener('abort',listener,{once:true});});
  signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,Math.max(0,Math.min(requestMs,end-now())));
  try{const value=await Promise.race([cancelled,Promise.resolve().then(()=>{check();return operation(controller.signal,check);})]);check();return value;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',listener);}
 }};
}
export async function createLiquidityHistoryPublisher(output,{fs={open,rename,unlink,lstat},timeoutMs=20000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>20000)throw Error('INVALID_HISTORY_PUBLICATION_TIMEOUT');
 const lock=output+'.lock',temp=output+'.pending';
 try{await fs.lstat(output);throw Error('HISTORY_OUTPUT_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
 const handle=await fs.open(lock,'wx');let failed=false;
 return {async save(state){
  if(failed)throw Error('HISTORY_PUBLICATION_RECONCILIATION_REQUIRED');
  let timer;const end=performance.now()+timeoutMs;
  const check=()=>{if(failed||performance.now()>=end)throw Error('HISTORY_PUBLICATION_RECONCILIATION_REQUIRED');};
  const operation=async()=>{let file;
   try{
    check();const body=JSON.stringify(state,null,2);check();file=await fs.open(temp,'wx');check();
    await file.writeFile(body);check();await file.sync();check();await file.close();file=null;check();
    await fs.rename(temp,output);check();
   }finally{if(file)await file.close().catch(()=>{});}
  };
  try{await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>{failed=true;reject(Error('HISTORY_PUBLICATION_RECONCILIATION_REQUIRED'));},timeoutMs);})]);}
  catch{failed=true;throw Error('HISTORY_PUBLICATION_RECONCILIATION_REQUIRED');}
  finally{clearTimeout(timer);}
 },async close(){await handle.close();if(!failed)await fs.unlink(lock);}};
}
