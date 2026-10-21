import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
const source=await readFile(new URL("../scripts/liquidity-reconcile-history.mjs",import.meta.url),"utf8");
test("reconciliation CLI consumes original, four replays, recovery, output",()=>{
 assert.match(source,/paths\.length!==7/);
 assert.match(source,/rest\.slice\(0,4\)/);
 assert.match(source,/rest\[4\]/);
 assert.match(source,/rest\[5\]/);
});
test("reconciliation CLI rejects absent input paths",()=>{
 const result=spawnSync(process.execPath,[new URL("../scripts/liquidity-reconcile-history.mjs",import.meta.url).pathname],{encoding:"utf8"});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/USAGE/);
});
