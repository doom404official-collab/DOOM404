import {readFile} from "node:fs/promises";
import {assessHistorySuccessor} from "../lib/liquidityHistorySuccessor.mjs";
const priorPath=process.argv[2],nextPath=process.argv[3],pool=process.env.GLITCH_LIQUIDITY_POOL;
if(!priorPath||!nextPath||!pool)throw Error("PRIOR_NEXT_POOL_REQUIRED");
const prior=JSON.parse(await readFile(priorPath,"utf8"));
const next=JSON.parse(await readFile(nextPath,"utf8"));
const after=assessHistorySuccessor(prior,next,pool);
console.log(JSON.stringify({status:"HISTORY_SUCCESSOR_VALIDATED",priorSeen:prior.seen.length,nextSeen:next.seen.length,action:after.action,classification:after.classification,score:null}));
