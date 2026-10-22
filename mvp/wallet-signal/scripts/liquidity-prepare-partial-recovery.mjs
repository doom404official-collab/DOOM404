import {readFile,writeFile} from 'node:fs/promises';
import {prepareLiquidityPartialRecovery} from '../lib/liquidityPartialRecovery.mjs';
const [priorPath,nextPath,output]=process.argv.slice(2);
const pool=process.env.GLITCH_LIQUIDITY_POOL;
if(!priorPath||!nextPath||!output||!pool)throw Error('PARTIAL_RECOVERY_INPUTS_REQUIRED');
async function readJson(path){const raw=await readFile(path,'utf8');try{return JSON.parse(raw);}catch{throw Error('INVALID_PARTIAL_RECOVERY_JSON');}}
const prior=await readJson(priorPath),next=await readJson(nextPath);
const {summary,state}=prepareLiquidityPartialRecovery(prior,next,pool);
await writeFile(output,JSON.stringify(state,null,2),{flag:'wx'});
console.log(JSON.stringify(summary));
