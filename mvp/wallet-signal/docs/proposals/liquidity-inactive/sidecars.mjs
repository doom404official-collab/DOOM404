// Pure inactive workflow contract. Input bytes must come from trusted artifact
// collection; this is not filesystem atomicity, run authentication or admission.
import {createHash} from 'node:crypto';
export function describeLiquidityPublication({run,conclusion,files}={}){
 if(typeof run!=='string'||!/^[1-9][0-9]*$/.test(run)||!['success','failure','cancelled','unknown'].includes(conclusion)||!Array.isArray(files))throw Error('LIQUIDITY_BUNDLE_INVALID');
 const allowed=['liquidity-history-evidence.json','liquidity-history-evidence.json.pending','liquidity-history-evidence.json.lock'];
 const seen=new Set(),entries=[];let main=false;
 for(const file of files){
  if(!file||!allowed.includes(file.name)||seen.has(file.name)||!Buffer.isBuffer(file.bytes))throw Error('LIQUIDITY_BUNDLE_INVALID');
  seen.add(file.name);const bytes=Buffer.from(file.bytes);
  entries.push({name:file.name,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  if(file.name===allowed[0]){try{const parsed=JSON.parse(bytes.toString('utf8'));main=parsed!==null&&typeof parsed==='object'&&!Array.isArray(parsed);}catch{main=false;}}
 }
 entries.sort((a,b)=>a.name.localeCompare(b.name,'en'));
 const candidate=conclusion==='success'&&main&&seen.size===1;
 return {artifactName:candidate?'liquidity-history-'+run:'liquidity-quarantine-'+run,status:candidate?'REQUIRES_INDEPENDENT_REVIEW':'QUARANTINED',entries,checkpointEligible:false,automaticResume:false,sourcePreserved:true};
}
