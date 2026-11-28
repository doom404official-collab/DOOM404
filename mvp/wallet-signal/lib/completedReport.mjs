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
/** Replace one mint-bound saved snapshot as bounded investigation progresses.
 * The identity read and update share a transaction; another token can never be
 * written over an existing report, even after cancellation or a late response. */
export async function updateReport(id,props){
 if(!/^[a-f0-9-]{36}$/.test(id)||!props?.result?.mint)throw Error('INVALID_REPORT_UPDATE');
 const db=await open();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('reports','readwrite'),store=tx.objectStore('reports'),r=store.get(id);let written=false;
  r.onsuccess=()=>{const previous=r.result;if(previous?.version!==1||previous.mint!==props.result.mint||previous.props?.result?.mint!==props.result.mint){reject(Error('REPORT_MINT_MISMATCH'));return;}
   store.put({...previous,updatedAt:Date.now(),props},id);written=true;};
  r.onerror=()=>reject(r.error);tx.oncomplete=()=>written?resolve(true):reject(Error('REPORT_UPDATE_UNCONFIRMED'));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
