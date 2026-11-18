// Live only when invoked explicitly by the gated workflow; imports are side-effect free.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {runHolderActionsRecovery} from '../lib/holderActionsRecovery.mjs';
let receipt;
try{
 const checkedOutSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 receipt=await runHolderActionsRecovery({checkedOutSha});
}catch{receipt={schemaVersion:1,status:'blocked',stopReason:'LOCAL_EXECUTION_FAILED',requestCount:0,jobs:[],reconciliationRequired:false,retries:0};}
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/holder-recovery-receipt.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(receipt));
if(receipt.status!=='attempts_finished')process.exitCode=1;
