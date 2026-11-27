const DB='glitch-completed-reports';
function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);const timer=setTimeout(()=>reject(Error('REPORT_STORAGE_TIMEOUT')),5000);r.onblocked=()=>{clearTimeout(timer);reject(Error('REPORT_STORAGE_BLOCKED'));};r.onupgradeneeded=()=>r.result.createObjectStore('reports');r.onsuccess=()=>{clearTimeout(timer);resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};});}
export async function saveReport(props){
 const id=crypto.randomUUID(),db=await open();
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('reports','readwrite');tx.objectStore('reports').put({version:1,createdAt:Date.now(),mint:props.result.mint,props},id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return id;}finally{db.close();}
}
export async function loadReport(id){
 if(!/^[a-f0-9-]{36}$/.test(id))return null;
 const db=await open();try{return await new Promise((resolve,reject)=>{const r=db.transaction('reports').objectStore('reports').get(id);r.onsuccess=()=>{const v=r.result;resolve(v?.version===1&&v.mint===v.props?.result?.mint?v.props:null);};r.onerror=()=>reject(r.error);});}finally{db.close();}
}
