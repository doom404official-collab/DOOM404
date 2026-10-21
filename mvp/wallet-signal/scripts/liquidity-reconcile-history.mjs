import {readFile,writeFile} from "node:fs/promises";
import {reconcileLiquidityHistory} from "../lib/liquidityHistoricalReconciliation.mjs";
const paths=process.argv.slice(2);
if(paths.length!==7)throw Error("USAGE: node scripts/liquidity-reconcile-history.mjs original.json replay1.json replay2.json replay3.json replay4.json recovery.json output.json");
const [originalPath,...rest]=paths;
const original=JSON.parse(await readFile(originalPath,"utf8"));
const replays=await Promise.all(rest.slice(0,4).map(async p=>JSON.parse(await readFile(p,"utf8"))));
const recovery=JSON.parse(await readFile(rest[4],"utf8"));
const result=reconcileLiquidityHistory(original,replays,recovery,original.pool);
if(result.reconciliation.verifiedDistinct!==34||result.reconciliation.originalSeen!==32||result.reconciliation.recoveredPending!==2)throw Error("UNEXPECTED_HISTORICAL_SOURCE_COUNTS");
// Never replace source evidence or an existing reconciliation, even through aliases.
await writeFile(rest[5],JSON.stringify(result,null,2),{flag:"wx"});
console.log(JSON.stringify({status:"RECONCILED_CHECKPOINT_PREPARED",...result.reconciliation,classification:result.classification,complete:result.complete,score:result.finalScore}));
