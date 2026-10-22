import {readFile} from "node:fs/promises";
import {assessAutomaticHistoryCheckpoint} from "../lib/liquidityAutomaticHistoryGate.mjs";
const path=process.argv[2],pool=process.env.GLITCH_LIQUIDITY_POOL;
if(!path||!pool)throw Error("CHECKPOINT_AND_POOL_REQUIRED");
const state=JSON.parse(await readFile(path,"utf8"));
const decision=assessAutomaticHistoryCheckpoint(state,pool);
console.log(JSON.stringify({status:"SHADOW_GATE_EVALUATED",...decision,processed:state.seen.length,pending:state.pendingSignatures?.length||0,score:null}));
if(decision.action.startsWith("PAUSE"))process.exitCode=2;
