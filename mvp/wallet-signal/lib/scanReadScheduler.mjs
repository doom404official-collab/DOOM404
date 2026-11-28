/** Keep one browser pipeline below the existing eight-lease client ceiling.
 * Transport priority favours current decision evidence; it grants no quota. */
export function createScanReadScheduler({read,signal,limit=6}={}){
 if(typeof read!=='function'||!Number.isInteger(limit)||limit<1||limit>6)throw Error('INVALID_SCAN_SCHEDULER');
 let active=0;const queue=[];
 const cancelled=()=>Object.assign(Error('Inspection cancelled'),{name:'AbortError'});
 const priority=path=>path.startsWith('/api/token-current')||path.startsWith('/api/current-liquidity')||path.startsWith('/api/token-concentration')&&!path.includes('extend=1')?0:path.startsWith('/api/token-investigation')?2:path.includes('extend=1')?3:1;
 function drain(){
  if(signal?.aborted){for(const item of queue.splice(0)){signal?.removeEventListener('abort',item.abort);item.reject(cancelled());}return;}
  while(active<limit&&queue.length){queue.sort((a,b)=>a.priority-b.priority);const item=queue.shift();signal?.removeEventListener('abort',item.abort);active++;
   Promise.resolve().then(()=>read(item.path,{signal})).then(item.resolve,item.reject).finally(()=>{active--;drain();});
  }
 }
 return path=>new Promise((resolve,reject)=>{if(signal?.aborted){reject(cancelled());return;}const item={path,priority:priority(path),resolve,reject};item.abort=()=>{const i=queue.indexOf(item);if(i>=0){queue.splice(i,1);signal?.removeEventListener('abort',item.abort);reject(cancelled());}};queue.push(item);signal?.addEventListener('abort',item.abort,{once:true});drain();});
}
