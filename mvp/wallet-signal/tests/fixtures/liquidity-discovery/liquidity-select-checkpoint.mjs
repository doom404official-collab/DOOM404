import {readFile,writeFile} from "node:fs/promises";
import {selectLiquidityContinuationCheckpoint} from "../lib/liquidityAutomaticCheckpointSelector.mjs";
const manifest=process.argv[2],output=process.argv[3],pool=process.env.GLITCH_LIQUIDITY_POOL;
if(!manifest||!output||!pool)throw Error("MANIFEST_OUTPUT_POOL_REQUIRED");
const entries=JSON.parse(await readFile(manifest,"utf8"));
if(!Array.isArray(entries)||entries.length<1||entries.length>50)throw Error("INVALID_CHECKPOINT_MANIFEST");
const candidates=[];
for(const item of entries){
 if(!Number.isSafeInteger(item.runId)||item.runId<=0||typeof item.path!=="string")throw Error("INVALID_MANIFEST_ENTRY");
 const state=JSON.parse(await readFile(item.path,"utf8"));
 candidates.push({runId:item.runId,state});
}
const chosen=selectLiquidityContinuationCheckpoint(candidates,pool);
await writeFile(output,JSON.stringify(chosen.state,null,2));
console.log(JSON.stringify({status:"CHECKPOINT_SELECTED",sourceRunId:chosen.runId,action:chosen.action,seen:chosen.state.seen.length,pending:chosen.state.pendingSignatures?.length||0,classification:chosen.state.classification}));
