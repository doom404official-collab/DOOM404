import fs from 'node:fs';import {performance} from 'node:perf_hooks';
import {runStagedTokenScan} from '../lib/stagedTokenScan.mjs';import {replay} from '../tests/fixtures/ui-assessment-replay.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];
for(const cache of ['cold_fixture','warm_fixture'])for(const trial of [1,2,3]){
 const r=replay(),mint=r.result.mint,scale=cache==='cold_fixture'?1:.3,delays={mint:20,holders:35,creator:15,market:25,quotes:35,history:80,vault:15,currentCreator:25};
 const start=performance.now();await sleep(delays.mint*scale);await Promise.all([sleep(delays.holders*scale),sleep(delays.creator*scale),sleep(delays.market*scale)]);await sleep(delays.history*scale);await Promise.all([sleep(delays.vault*scale),sleep(delays.currentCreator*scale)]);await sleep(delays.quotes*scale);const baselineMs=performance.now()-start;
 const calls=[],now=()=>performance.now(),s=now();let initialMs=null;
 const scan=await runStagedTokenScan({mint,now,read:async path=>{calls.push(path.split('?')[0]);const p=path.split('?')[0];
  if(p==='/api/token-current'){await sleep(delays.mint*scale);return r.result;}
  if(p==='/api/token-concentration'){await sleep(delays.holders*scale);return {mint,sampledWalletObservation:{version:2,atomicSubset:true,eligibleWallets:1,observedAt:new Date().toISOString(),supplyRaw:'1000',wallets:[{wallet:'wallet',amountRaw:'10'}],observedSharePct:1,largestSharePct:1,contextSlots:{mint:1,sampledAccounts:1}}};}
  if(p==='/api/creator-evidence'){await sleep(delays.creator*scale);return r.creatorEvidence;}
  if(p==='/api/current-creator'){await sleep(delays.currentCreator*scale);return r.currentCreator;}
  if(p==='/api/scoring-evidence'){await sleep(delays.vault*scale);return r.workerEvidence;}
  if(p==='/api/token-liquidity'){await sleep(delays.market*scale);return {...r.reportedLiquidity,pools:[{pairAddress:r.currentLiquidity.pool}]};}
  if(p==='/api/current-liquidity'){await sleep(delays.quotes*scale);return {mint,observation:r.currentLiquidity};}
  if(p==='/api/token-investigation'){await sleep(delays.history*scale);return {mint,status:'investigation_completed',creator:{creator:r.currentCreator.creator}};}
  return {mint};
 },onInitial:()=>{initialMs=now()-s;}});
 rows.push({fixture:'PAID retained UI replay',trial,cache,scope:'Synthetic transport-delay experiment using identical response fixtures and the measured baseline dependency graph; not hosted performance qualification.',baselineReportMs:+baselineMs.toFixed(2),stagedInitialReportMs:+initialMs.toFixed(2),stagedBoundedReportMs:scan.inspectionTiming.boundedReportMs,stages:scan.inspectionTiming.stages,logicalEndpointReads:calls.length});
}
const report={scope:'Deterministic architecture experiment only. Hosted cold/warm results must be recorded separately.',rows};fs.writeFileSync('docs/wp01-dependency-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(rows.map(({stages,...r})=>r),null,2));
