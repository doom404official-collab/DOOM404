import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
const script=new URL("../scripts/liquidity-validate-artifact-discovery.mjs",import.meta.url).pathname;
test("artifact discovery metadata validates trusted source and rejects duplicates",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"glitch-discovery-"));
 try{
  const input=join(dir,"input.json"),output=join(dir,"output.json");
  const entry={runId:100,branch:"feature/glitch-liquidity-evidence-worker",conclusion:"success",prefix:"liquidity-reconciled",artifactName:"liquidity-reconciled-100",path:"/tmp/checkpoint.json"};
  await writeFile(input,JSON.stringify([entry]));
  assert.equal(spawnSync(process.execPath,[script,input,output]).status,0);
  assert.equal(JSON.parse(await readFile(output,"utf8"))[0].runId,100);
  await writeFile(input,JSON.stringify([entry,entry]));
  assert.notEqual(spawnSync(process.execPath,[script,input,output]).status,0);
  await writeFile(input,JSON.stringify([{...entry,branch:"main"}]));
  assert.notEqual(spawnSync(process.execPath,[script,input,output]).status,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
