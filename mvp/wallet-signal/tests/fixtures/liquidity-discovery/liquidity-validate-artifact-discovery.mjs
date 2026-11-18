import {readFile,writeFile} from "node:fs/promises";
const input=process.argv[2],output=process.argv[3];
if(!input||!output)throw Error("DISCOVERY_INPUT_OUTPUT_REQUIRED");
const data=JSON.parse(await readFile(input,"utf8"));
if(!Array.isArray(data)||data.length<1||data.length>50)throw Error("INVALID_DISCOVERY_RECORDS");
const entries=[];
const seen=new Set();
for(const item of data){
 if(!Number.isSafeInteger(item.runId)||item.runId<=0||typeof item.path!=="string"||item.path.length>512)throw Error("INVALID_DISCOVERY_ENTRY");
 if(item.branch!=="feature/glitch-liquidity-evidence-worker"||item.conclusion!=="success"||item.artifactName!==item.prefix+"-"+item.runId||!["liquidity-reconciled","liquidity-history"].includes(item.prefix))throw Error("UNTRUSTED_ARTIFACT_SOURCE");
 if(seen.has(item.runId))throw Error("DUPLICATE_ARTIFACT_RUN");
 seen.add(item.runId);
 entries.push({runId:item.runId,path:item.path});
}
await writeFile(output,JSON.stringify(entries,null,2));
console.log(JSON.stringify({status:"ARTIFACT_MANIFEST_VALIDATED",count:entries.length}));
