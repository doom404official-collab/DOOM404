import {buildHolderConnectionGraph} from "./holderConnectionGraph.mjs";
// Persisted JSON evidence: object key order and pair/kind set order are not proof
// differences. Attempts are operational metadata; all evidence fields are compared.
function observationKey(row){
 try{
  const ancestors=new Set();
  const stable=value=>{
   if(value===null||typeof value==="string"||typeof value==="boolean")return value;
   if(typeof value==="number"&&Number.isFinite(value))return value;
   if(!value||typeof value!=="object"||ancestors.has(value))throw Error("INVALID_JSON_EVIDENCE");
   const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
   if(!array&&proto!==Object.prototype&&proto!==null)throw Error("INVALID_JSON_EVIDENCE");
   const keys=Reflect.ownKeys(value).filter(key=>!array||key!=="length");
   if(keys.some(key=>typeof key!=="string")||array&&(keys.length!==value.length||keys.some((key,i)=>key!==String(i))))throw Error("INVALID_JSON_EVIDENCE");
   const descriptors=Object.getOwnPropertyDescriptors(value);
   if(keys.some(key=>!descriptors[key].enumerable||!Object.hasOwn(descriptors[key],"value")))throw Error("INVALID_JSON_EVIDENCE");
   ancestors.add(value);
   const result=array?keys.map(key=>stable(descriptors[key].value)):
    Object.fromEntries(keys.sort().map(key=>[key,stable(descriptors[key].value)]));
   ancestors.delete(value);return result;
  };
  if(!row.evidence||typeof row.evidence!=="object"||Array.isArray(row.evidence)||typeof row.status!=="string")return null;
  const evidence=stable(row.evidence);
  if(Array.isArray(evidence.pairs)&&evidence.pairs.every(p=>typeof p==="string"&&p.split("|").length===2))
   evidence.pairs=[...new Set(evidence.pairs.map(p=>p.split("|").sort().join("|")))].sort();
  if(Array.isArray(evidence.kinds)&&evidence.kinds.every(k=>typeof k==="string"))
   evidence.kinds=[...new Set(evidence.kinds)].sort();
  return JSON.stringify(stable({status:row.status,evidence}));
 }catch{return null;}
}
/** Construct a verified-only graph from persisted evidence rows.
 * A completed evidence queue does not establish complete historical coverage.
 */
export function summarizeVerifiedHolderConnections({checkpoint,evidenceRows=[]}={}){
 if(!checkpoint||!Array.isArray(checkpoint.holders)||!checkpoint.wallets||!Array.isArray(evidenceRows))
  throw Error("INVALID_VERIFIED_CONNECTION_INPUT");
 const discovered=new Set(Object.values(checkpoint.edges||{}).flatMap(e=>e.signatures||[]));
 const records=new Map();
 const keys=new Map(),conflicts=new Set();
 for(const row of evidenceRows){
  if(!discovered.has(row?.signature))continue;
  const key=observationKey(row);
  if(key===null)conflicts.add(row.signature);
  if(records.has(row.signature)){
   if(key===null||keys.get(row.signature)!==key)conflicts.add(row.signature);
   continue;
  }
  records.set(row.signature,row);
  keys.set(row.signature,key);
 }
 const transactions=[];
 for(const [signature,row] of records){
  if(conflicts.has(signature)||row.status!=="verified"||!Array.isArray(row.evidence?.pairs))continue;
  for(const key of row.evidence.pairs){
   if(typeof key!=="string")continue;
   const pair=key.split("|");
   if(pair.length!==2||pair[0]===pair[1]||!pair.every(w=>w in checkpoint.wallets))continue;
   transactions.push({signature,confirmed:true,directInteraction:true,participants:pair});
  }
 }
 const graph=buildHolderConnectionGraph({holders:checkpoint.holders,transactions,historyComplete:false});
 const counts={verified:0,rejected:0,pending:0,unavailable:0};
 for(const sig of discovered){
  const status=conflicts.has(sig)?"unavailable":records.get(sig)?.status||"pending";
  counts[status in counts?status:"pending"]++;
 }
 const complete=counts.pending===0&&counts.unavailable===0;
 const pairs=graph.edges.map(e=>({...e,transferCount:e.signatures.length,
  strength:e.signatures.length>=2?"moderate":"weak"}));
 return {evidenceComplete:complete,historyComplete:false,signaturesTotal:discovered.size,
  counts,pairs,connectedGroups:graph.connectedGroups,connectedWallets:graph.connectedWalletCount,
  directPairs:pairs.length,commonOwnershipEstablished:false,
  caveat:"Verified transfers prove direct interactions, not common ownership or coordinated trading. Historical coverage is not established."};
}
