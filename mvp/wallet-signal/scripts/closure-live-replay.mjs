import fs from 'node:fs';import {PublicKey} from '@solana/web3.js';
import {classifyHolderAllocations} from '../lib/holderAllocationClassification.mjs';
import {decodeToken2022BinaryMint} from '../lib/token2022BinaryMint.mjs';
import {projectSecurityConfiguration} from '../lib/securityConfigurationV2.mjs';
import {practicalAssessmentV2} from '../lib/practicalScoringV2.mjs';
import {assessmentDisplay} from '../lib/evidenceHudPresentation.mjs';
import {normalizeTransferFee} from '../lib/tokenTransferFeeEvidence.mjs';
const raw=JSON.parse(fs.readFileSync('docs/intelligence-closure-live-raw.json'));
const retry=JSON.parse(fs.readFileSync('docs/intelligence-closure-trump-owner-retry.json'));
const compressed=JSON.parse(fs.readFileSync('docs/intelligence-closure-trump-owner-compressed.json'));
const parse=r=>JSON.parse(r.content.find(x=>x.type==='text').text);
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',TOKEN22='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const rows=[];
for(const row of raw.sampleRows){
 const mint=row.mint,sample=parse(row.response),mintRow=raw.mintRows.find(x=>x.mint===mint),parsedMint=parse(mintRow.response),info=parsedMint.value?.data?.parsed?.info;
 const owners=new Map(),ownerRow=raw.ownerRows.find(x=>x.mint===mint);let ownerFailure=false;
 try{const d=parse(ownerRow.response);ownerRow.pubkeys.forEach((p,i)=>owners.set(p,d.value[i]));}catch{ownerFailure=true;}
 if(row.name==='TRUMP'){const a=parse(compressed.response),b=parse(retry[1].response);compressed.pubkeys.forEach((p,i)=>owners.set(p,a.value[i]));retry[1].pubkeys.forEach((p,i)=>owners.set(p,b.value[i]));}
 const mb=Buffer.from(sample.value[0].data[0],'base64'),supplyRaw=mb.readBigUInt64LE(36).toString();
 const accounts=sample.value.slice(1).map((a,i)=>{
  if(![TOKEN,TOKEN22].includes(a?.owner))return {pubkey:row.pubkeys[i+1],account:a};
  const b=Buffer.from(a.data[0],'base64');if(b.length<165||![0,1].includes(b.readUInt32LE(72))||![0,1].includes(b.readUInt32LE(129))||![1,2].includes(b[108]))return {pubkey:row.pubkeys[i+1],account:null};
  return {pubkey:row.pubkeys[i+1],account:{...a,data:{parsed:{type:'account',info:{mint:new PublicKey(b.subarray(0,32)).toBase58(),owner:new PublicKey(b.subarray(32,64)).toBase58(),tokenAmount:{amount:b.readBigUInt64LE(64).toString()},state:b[108]===2?'frozen':'initialized',delegate:b.readUInt32LE(72)?new PublicKey(b.subarray(76,108)).toBase58():null,closeAuthority:b.readUInt32LE(129)?new PublicKey(b.subarray(133,165)).toBase58():null}}}}};
 });
 const allocation=classifyHolderAllocations({mint,supplyRaw,accounts,ownerAccounts:owners});
 const total=allocation.wallets.reduce((n,w)=>n+BigInt(w.amountRaw),0n),largest=allocation.wallets.reduce((n,w)=>BigInt(w.amountRaw)>n?BigInt(w.amountRaw):n,0n),pct=n=>Number(n*1000000n/BigInt(supplyRaw))/10000;
 const result={mint,tokenProgram:parsedMint.value.owner===TOKEN?'spl-token':'spl-token-2022',authorityDetailsStatus:'available',mintAuthority:info.mintAuthority,freezeAuthority:info.freezeAuthority,supplyRaw,contextSlot:sample.context.slot};
 let extensions;
 if(parsedMint.value.owner===TOKEN22){const decoded=decodeToken2022BinaryMint(sample.value[0],mint,{allowUnknownExtensions:true}),mi=decoded?.data?.parsed?.info,fee=mi?.extensions?.find(e=>e.extension==='transferFeeConfig')?.state,old=normalizeTransferFee(fee?.olderTransferFee),next=normalizeTransferFee(fee?.newerTransferFee);
  extensions={mint,verified:!!mi,observedAt:row.observedAt,configuration:projectSecurityConfiguration(mi,{slot:sample.context.slot,commitment:'finalized'}),transferFee:fee?{status:'observed',configAuthorityReported:true,configAuthority:fee.transferFeeConfigAuthority,effectiveFee:old?.percentage===next?.percentage?{percentage:old.percentage}:null}:{status:'not_observed'}};
 }
 const input={now:Date.parse(row.observedAt),result,extensions,concentration:{mint,sampledWalletObservation:{version:2,atomicSubset:true,observedAt:row.observedAt,supplyRaw,wallets:allocation.wallets,eligibleWallets:allocation.wallets.length,returnedAccounts:10,resolvedSampleAccounts:allocation.allocations.length,excludedSampleAccounts:allocation.allocations.filter(a=>!a.eligible).length,observedSharePct:pct(total),largestSharePct:pct(largest),allocationClassification:allocation,contextSlots:{mint:sample.context.slot,sampledAccounts:sample.context.slot}}}};
 const a=practicalAssessmentV2(input);
 rows.push({name:row.name,mint,observedAt:row.observedAt,slot:sample.context.slot,validationStatus:'Partially complete',scope:'Mint controls and ten-account allocation subset; not an end-to-end scanner pass.',launchMechanism:['PAID','TOMO','ANSEM'].includes(row.name)?'Prior fixture Pump.fun; origin not reverified in this pass':row.name==='FLOAT'?'Prior fixture LaunchLab; origin not reverified in this pass':'Unverified in this pass',tokenProgram:result.tokenProgram,liquidityProtocol:null,overallRiskScore:assessmentDisplay(a,'overall').score,observedRiskFloor:a.riskScore,attributeScores:Object.fromEntries(Object.entries(a.scores).map(([k,v])=>[k,{score:assessmentDisplay(a,k).score,coveragePct:v.coveragePct}])),creatorAttributionResult:'Not investigated in this live subset',holderClassificationResult:allocation,criticalAndHighFindings:a.flags.filter(f=>['critical','high'].includes(f.severity)),exitQuoteConsistency:'Not tested: hosted scan requires authenticated session',providerRequests:row.name==='TRUMP'?7:row.name==='FLOAT'?11:4,initialReportResponseTimeMs:null,investigationCompletionTimeMs:null,remainingLimitations:['No live launch or creator history recovery in this subset.','Ten account subset cannot establish eligible Top-20 ranking, custody, treasury, vesting or escrow.','Liquidity quotes, withdrawal rights, alternative routes and hosted latency not tested.',...(ownerFailure?['Original owner response truncated; TRUMP owner metadata recovered using bounded split and compressed reads.']:[])],input});
}
fs.writeFileSync('docs/intelligence-closure-live-matrix.json',JSON.stringify({qualification:'NOT QUALIFIED — full 15-token end-to-end matrix and category diversity remain open',providerRequests:70,requestsBreakdown:{mint:15,largest:15,sample:15,owners:15,trumpRecovery:3,floatUnusableOriginTransaction:2,floatCurrentHoldings:1,floatSignaturePages:2,floatUnusableRecentTransactions:2},scanLatencyStatistics:{medianMs:null,p95Ms:null,maxMs:null,reason:'Hosted scanner runs not performed; connector round-trip timings are not scan latency'},rows},null,2));
console.log(JSON.stringify(rows.map(r=>({name:r.name,coverage:r.attributeScores.holder_intelligence.coveragePct,security:r.attributeScores.token_security,unknown:r.holderClassificationResult.unclassifiedSharePct,largest:Math.max(...r.holderClassificationResult.allocations.map(a=>a.sharePct))})),null,2));
