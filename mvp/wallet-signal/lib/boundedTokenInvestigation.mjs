import {inspectLaunchLabTrade} from './launchLabTradeBoundary.mjs';
import {verifyStreamflowFundingBoundary} from './streamflowFundingBoundary.mjs';
import {discoverStreamflowAllocation} from './streamflowAllocationDiscovery.mjs';
import {recoverCreatorOriginCandidates} from './autonomousOriginFallback.mjs';
import {retainCreatorEventProvenance} from './creatorEventProvenance.mjs';
import {materialTransferRecipient,investigateMaterialRecipient} from './materialTransferRecipient.mjs';
import {inspectRoutedTokenTrade} from './routedTokenTrade.mjs';
import {selectMaterialSelfAuthority,recoverMaterialAccountGenesis,verifyStreamflowCreatorEscrowTransfer} from './streamflowCreatorMovement.mjs';
import {verifyStreamflowAllocationControls,normalizeStreamflowEscrowAccount,verifyStreamflowUpgradeControl,STREAMFLOW_PROGRAM,STREAMFLOW_PROGRAM_DATA} from './streamflowAllocationControls.mjs';
import {creatorOriginPage} from './sharedCreatorOriginV1.mjs';
import {traceSpan,traceEvent} from './scannerTrace.mjs';
import {reconcileCreatorHistoryWindow,deduplicateCreatorEvents} from './creatorHistoryAccountingV1.mjs';
import {collectCreatorTokenHistory,prepareCreatorHistoryCheckpoint,reusableCreatorTransactions,cacheCreatorTransactions} from './creatorTokenHistoryV1.mjs';
import {verifyPumpHolderRewardReceipt} from './pumpHolderRewardReceipt.mjs';
import {verifyCreatorDirectMovement} from './creatorDirectMovement.mjs';
import {reconcileCreatorReceipt} from './creatorReceiptReconciliation.mjs';
import {extractIndependentPumpFunBuySettlement} from './pumpFunIndependentBuySettlement.mjs';
import {promotePumpFunCreatorBuy} from './pumpFunCreatorBuyPromotion.mjs';
import {extractPumpFunSettlementEvidence} from './pumpFunSettlementEvidenceExtractor.mjs';
import {verifyPumpFunCreatorSettlement} from './pumpFunCreatorSettlement.mjs';
import {groupPumpFunSellInnerInstructions} from './pumpFunSellInnerInstructionGroups.mjs';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {verifyBoundedCreatorOrigin,diagnoseBoundedCreatorOrigin,creatorOriginLimitation} from './boundedCreatorOriginV2.mjs';
import {reconcileCreatorLaunchTransaction} from './creatorLaunchTransactionReconciliation.mjs';
import {reconcileCreatorNonSaleOutflow} from './creatorOutflowReconciliation.mjs';
import {verifySignedBurnInstructionV2} from './creatorSignedBurnProofV2.mjs';
import {extractHolderNetworkTransfers} from './holderNetworkTransfers.mjs';
import {summarizeCreatorAcquisitionLedger} from './creatorAcquisitionLedger.mjs';
const TOKEN=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
const key=x=>typeof x==='string'?x:x?.pubkey?.toBase58?.()||x?.pubkey;
/** A single finite investigation, not a lifetime scanner. Caller supplies admitted RPC.
 * 1 origin read + 2 snapshot reads + 1 classifications + 3 holder histories +
 * 1 current creator inventory + 1 token-specific indexed page + 8 transaction
 * reads = at most 17 logical requests, within the existing 18-request limit. */
export async function investigateToken({mint,rpc,now=Date.now,maxTransactions=8,previousObservation=null,providerName='admitted_rpc',alternateProviderName=null}={}){
 new PublicKey(mint);if(typeof rpc!=='function'||!Number.isInteger(maxTransactions)||maxTransactions<1||maxTransactions>8)throw Error('INVALID_INVESTIGATION');
 let requests=0;const attempted=[],failures=[],receiptSources=new Map();
 const read=async(method,params,provider='primary')=>{if(requests>=18)throw Error('BOUNDED_REQUEST_LIMIT');requests++;attempted.push(method);const result=await rpc(method,params,{provider});for(const tx of method==='getTransactionsForAddress'?(result?.data||[]):method==='getTransaction'?[result]:[]){const sig=tx?.transaction?.signatures?.[0];if(typeof sig==='string'&&tx.meta?.err===null&&Number.isSafeInteger(tx.slot))receiptSources.set(sig,{provider:provider==='secondary'?alternateProviderName:providerName,method});}return result;};
 const observation={version:1,investigationRevision:12,mint,status:'investigation_completed',observedAt:new Date(now()).toISOString(),scope:'One bounded recent window plus verified creation; histories remain incomplete',historyComplete:false,historicalEvidenceProvenance:{decoderVersion:'creator-token-history-v2-balance-mint-binding',source:'admitted_finalized_rpc',immutableReceiptsRevalidated:true}};
 let origin=null,originFailure=null,originCandidateCount=0;const originDiagnostics=[];
 try{const retainedOrigin=previousObservation?.mint===mint&&Array.isArray(previousObservation.transactionCache)?previousObservation.transactionCache.find(tx=>verifyBoundedCreatorOrigin(tx,mint)?.creator===previousObservation.creator?.creator):null;
 const r=retainedOrigin?(traceEvent('creator_origin_durable_cache_hit'),{data:[retainedOrigin]}):await traceSpan('creator_origin',()=>creatorOriginPage(mint,()=>recoverCreatorOriginCandidates({mint,read,alternateProvider:!!alternateProviderName})));if(!Array.isArray(r?.data)||r.data.length>12)throw Error('INVALID_ORIGIN_PAGE');observation.originRetrieval=r.originRetrieval||{terminalReason:'retained_protocol_origin_receipt'};if(r.originRetrieval?.terminalReason==='origin_retrieval_unavailable'&&!r.originRetrieval.attempts.some(a=>a.status==='returned')){originFailure=r.originRetrieval.attempts.some(a=>a.status==='indexed_method_unsupported')?'indexed_method_unsupported':'provider_temporarily_unavailable';failures.push({producer:'creator_origin',reason:originFailure});}const txs=r.data;originCandidateCount=txs.length;for(const tx of txs){originDiagnostics.push(diagnoseBoundedCreatorOrigin(tx,mint));const proof=verifyBoundedCreatorOrigin(tx,mint);if(proof){if(origin&&origin.proof.creator!==proof.creator)throw Error('CONFLICTING_CREATOR_EVIDENCE');origin={proof,tx};}}}
 catch(e){origin=null;originFailure=e.message==='CONFLICTING_CREATOR_EVIDENCE'?'conflicting_evidence':e.message==='INVALID_ORIGIN_PAGE'?'invalid_provider_response':e.code===-32601?'indexed_method_unsupported':'provider_temporarily_unavailable';failures.push({producer:'creator_origin',reason:originFailure});}
 const creator=origin?.proof.creator;let events=previousObservation?.mint===mint&&previousObservation?.creator?.creator===origin?.proof.creator?[...(previousObservation.creator.events||[])]:[];const transactions=new Map(),signatures=new Map(),creatorSignatures=new Set();
 if(origin){transactions.set(origin.proof.creationSignature,origin.tx);const launch=reconcileCreatorLaunchTransaction({mint,creator,signature:origin.proof.creationSignature,transaction:origin.tx});if(launch.event)events.push(launch.event);}
 let holders=[],supply=null,snapshotSlot=null,mintDecimals=null,materialCandidate=null,holderHistories=0,largestSampleTokenAccount=null;
 const materialProofs=[],allocationDiscoveries=[],preciseOutflows=new Map();
 try{
  const largest=await read('getTokenLargestAccounts',[mint,{commitment:'finalized'}]);
  const addresses=(largest?.value||[]).slice(0,20).map(x=>x.address);largestSampleTokenAccount=addresses[0]||null;
  if(!addresses.length)throw Error('NO_HOLDER_ACCOUNTS');
  const sample=await read('getMultipleAccounts',[[mint,...addresses],{encoding:'jsonParsed',commitment:'finalized',minContextSlot:largest.context.slot}]);
  const m=sample?.value?.[0],mi=m?.data?.parsed?.info;
  if(m?.executable!==false||!TOKEN.has(m.owner)||m.data.parsed.type!=='mint'||mi?.isInitialized!==true||!uint(mi.supply)||BigInt(mi.supply)===0n||!Number.isSafeInteger(sample.context?.slot))throw Error('INVALID_MINT_SNAPSHOT');
  supply=mi.supply;mintDecimals=Number.isInteger(mi.decimals)&&mi.decimals>=0&&mi.decimals<=255?mi.decimals:null;snapshotSlot=sample.context.slot;const grouped=new Map();
  for(const a of sample.value.slice(1)){const i=a?.data?.parsed?.info;if(a?.executable!==false||!TOKEN.has(a.owner)||a.data.parsed.type!=='account'||i?.mint!==mint||!uint(i.tokenAmount?.amount)||!PublicKey.isOnCurve(new PublicKey(i.owner).toBytes())||i.owner==='1nc1nerator11111111111111111111111111111111')continue;grouped.set(i.owner,(grouped.get(i.owner)||0n)+BigInt(i.tokenAmount.amount));}
  materialCandidate=selectMaterialSelfAuthority({mint,supplyRaw:supply,accounts:sample.value.slice(1).map((account,i)=>({pubkey:addresses[i],account}))});
  const owners=[...grouped.keys()];
  if(owners.length){const classes=await read('getMultipleAccounts',[owners,{encoding:'base64',commitment:'finalized',minContextSlot:snapshotSlot}]);if(!Number.isSafeInteger(classes.context?.slot)||classes.context.slot<snapshotSlot||classes.value?.length!==owners.length)throw Error('CLASSIFICATION_UNAVAILABLE');owners.forEach((w,i)=>{const a=classes.value[i];if(a!==null&&(a?.owner!=='11111111111111111111111111111111'||a.executable!==false))grouped.delete(w);});}
  holders=[...grouped].map(([wallet,amount])=>({wallet,amountRaw:amount.toString()})).sort((a,b)=>BigInt(a.amountRaw)>BigInt(b.amountRaw)?-1:BigInt(a.amountRaw)<BigInt(b.amountRaw)?1:0);
  if(holders.reduce((n,h)=>n+BigInt(h.amountRaw),0n)>BigInt(supply))throw Error('INVALID_SAMPLE_SUM');
  for(const h of holders.slice(0,materialCandidate?2:3)){
   holderHistories++;
   const rows=await read('getSignaturesForAddress',[h.wallet,{limit:6,commitment:'finalized'}]);
   for(const r of rows||[])if(r.err===null&&Number.isSafeInteger(r.blockTime)&&r.blockTime>=Math.floor(now()/1000)-7*86400)signatures.set(r.signature,(signatures.get(r.signature)||0)+1);
  }
 }catch{holders=[];failures.push({producer:'holder_relationships',reason:'eligible_snapshot_or_recent_history_unavailable'});}
 observation.materialAccountInvestigation={status:'no_material_candidate',requests:0};
 if(materialCandidate){const material=await traceSpan('material_allocation_genesis',()=>recoverMaterialAccountGenesis({candidate:materialCandidate,mint,read,now}));observation.materialAccountInvestigation={...material,transactions:undefined,tokenAccount:materialCandidate.pubkey,scope:'One material unclassified self-authority token account; replaces third holder history, not a backfill.'};for(const tx of material.transactions)transactions.set(tx.transaction.signatures[0],tx);}
 observation.adaptiveCreator={status:'not_triggered',additionalRequests:0};
 if(creator){
  for(const tx of reusableCreatorTransactions(previousObservation,mint,creator)){transactions.set(tx.transaction.signatures[0],tx);traceEvent('creator_transaction_cache_hit');}
  const history=await traceSpan('creator_history',()=>collectCreatorTokenHistory({mint,creator,origin,read,previous:prepareCreatorHistoryCheckpoint(previousObservation,mint,creator,now()),knownTransactions:[...transactions.values()],now,maxPages:3}));
  observation.adaptiveCreator={...history,transactions:undefined};observation.creatorHistoryCheckpoint=history.checkpoint;
  for(const tx of history.transactions){const sig=tx.transaction.signatures[0];transactions.set(sig,tx);creatorSignatures.add(sig);}
  if(history.status==='targeted_history_unavailable'||history.status==='token_account_discovery_unavailable')failures.push({producer:'creator_history',reason:history.status});
 }
 // Reserve creator candidates before overlapping holder activity. No shared transfer may starve the creator history.
 const priority=[...signatures].sort((a,b)=>Number(creatorSignatures.has(b[0]))-Number(creatorSignatures.has(a[0]))||b[1]-a[1]);
 // Extra token-specific pages replace holder receipt reads; the existing total
 // request ceiling and provider guard remain unchanged.
 const extraHistoryReads=Math.max(0,(observation.adaptiveCreator.additionalRequests||0)-2);
 const selected=priority.slice(0,Math.min(Math.max(0,maxTransactions-extraHistoryReads),Math.max(0,17-requests)));
 for(const [signature] of selected){if(transactions.has(signature))continue;if(requests>=18){observation.earlyStop='bounded_request_budget_exhausted';break;}try{const tx=await read('getTransaction',[signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:1}]);if(tx?.transaction?.signatures?.[0]===signature&&tx.meta?.err===null){transactions.set(signature,tx);
   const network=extractHolderNetworkTransfers({transaction:tx,signature});
   const eligible=new Map(holders.map(h=>[h.wallet,BigInt(h.amountRaw)]));
   const decisive=network.valid&&network.transfers.some(t=>eligible.has(t.from)&&eligible.has(t.to)&&t.from!==t.to&&(t.assetType==='SOL'?t.innerInstructionIndex===null&&BigInt(t.amountRaw)>=50000000n:t.mint===mint&&BigInt(t.amountRaw)*10000n>=BigInt(supply))&&(eligible.get(t.from)+eligible.get(t.to))*100n>=BigInt(supply)*20n);
   if(decisive){observation.materialRelationshipObserved=true;if(!selected.some(([s])=>creatorSignatures.has(s)&&!transactions.has(s))){observation.earlyStop='material_connected_exposure_observed';break;}}
  }else failures.push({producer:'transaction',reason:'transaction_unavailable_or_failed'});}catch{failures.push({producer:'transaction',reason:'provider_temporarily_unavailable'});break;}}
 // Token-specific indexed pages contain complete transactions; no separate
 // per-signature fetch is charged for the same immutable transaction.
 observation.routedTradeDiagnostics=[];
 const memberSet=new Set(holders.map(h=>h.wallet)),members=new Set(),relationships=[],fundingObservations=[];
 for(const [signature,tx] of transactions){
  if(materialCandidate){const discovered=discoverStreamflowAllocation({mint,tokenAccount:materialCandidate.pubkey,transaction:tx});if(discovered)allocationDiscoveries.push(discovered);}
  // An escrow sender is not automatically the original token creator.
  const fundingSigner=tx.transaction?.message?.instructions?.[1]?.accounts?.[0];
  const escrow=typeof fundingSigner==='string'?verifyStreamflowCreatorEscrowTransfer({mint,creator:fundingSigner,transaction:tx}):null;
  if(escrow?.verified)materialProofs.push({...escrow,fundingSigner,signature,slot:tx.slot});
  if(creator){await traceSpan('creator_transaction_decoding',async()=>{
   const routed=inspectRoutedTokenTrade({mint,creator,signature,transaction:tx}),launchTrade=inspectLaunchLabTrade({mint,creator,signature,transaction:tx});const verifiedTrades=[routed,launchTrade].filter(p=>p.event);if(verifiedTrades.length===1)events.push(verifiedTrades[0].event);observation.routedTradeDiagnostics.push({signature,slot:tx.slot,status:verifiedTrades.length===1?'verified_target_trade':verifiedTrades.length>1?'ambiguous_multiple_trade_proofs':routed.status,reason:verifiedTrades.length===1?null:routed.reason,protocolChecks:[{decoder:'pump-trade-cpi-boundary-v2',status:routed.status,reason:routed.reason},{decoder:'launchlab-economic-boundary-v1',status:launchTrade.status,reason:launchTrade.reason}]});
   const receipt=verifyCreatorDirectMovement({mint,creator,signature,transaction:tx})||reconcileCreatorReceipt({mint,creator,signature,transaction:tx})||verifyPumpHolderRewardReceipt({mint,creator,signature,transaction:tx});if(receipt)events.push(receipt);
   const independentSettlement=extractIndependentPumpFunBuySettlement({mint,creator,signature,transaction:tx});
   if(independentSettlement){const buy=promotePumpFunCreatorBuy({mint,creator,signature,transaction:tx,independentSettlement});if(buy.status==='VERIFIED')events.push(buy.event);}
   const settlement=extractPumpFunSettlementEvidence({mint,creator,signature,transaction:tx});
   if(settlement){const verified=verifyPumpFunCreatorSettlement({candidate:{status:'CORROBORATED_CANDIDATE',saleVerified:false,signature,creator,mint,soldRaw:settlement.soldRaw},settlement});
    const groups=groupPumpFunSellInnerInstructions({transaction:tx});
    if(verified.status==='VERIFIED'&&groups.length===1){const g=groups[0];const indices=g.innerInstructions.map((ix,i)=>({ix,i})).filter(({ix})=>['transfer','transferChecked'].includes(ix.parsed?.type)&&String(ix.parsed.info?.tokenAmount?.amount??ix.parsed.info?.amount)===settlement.soldRaw);
     if(indices.length===1)events.push({signature,instructionIndex:g.outerInstructionIndex,innerInstructionIndex:indices[0].i,mint,creator,type:'VERIFIED_SALE',timestamp:tx.blockTime,amountRaw:settlement.soldRaw,independentlyVerified:true,instructionVerified:true,settlementVerified:true});
    }
   }
   const streamFunding=verifyStreamflowFundingBoundary({mint,sender:creator,transaction:tx});
   if(streamFunding){for(const event of streamFunding.events){events.push(event);preciseOutflows.set(event.signature+':'+event.instructionIndex+':'+event.innerInstructionIndex,event);}}
   else if(escrow?.verified&&fundingSigner===creator)events.push(escrow.event);
   const outflow=reconcileCreatorNonSaleOutflow({mint,creator,signature,transaction:tx});if(outflow.event&&(outflow.event.type!=='VERIFIED_BURN'||verifySignedBurnInstructionV2(tx)))events.push(outflow.event);});}
  const network=extractHolderNetworkTransfers({transaction:tx,signature});
  if(network.valid)for(const t of network.transfers){if(memberSet.has(t.to)&&!memberSet.has(t.from)&&t.assetType==='SOL'&&t.innerInstructionIndex===null&&BigInt(t.amountRaw)>=50000000n&&PublicKey.isOnCurve(new PublicKey(t.from).toBytes()))fundingObservations.push({...t,sourceClassification:'unresolved',commonOwnershipEstablished:false});if(!memberSet.has(t.from)||!memberSet.has(t.to)||t.from===t.to)continue;const material=t.assetType==='SOL'?t.innerInstructionIndex===null&&BigInt(t.amountRaw)>=50000000n:t.mint===mint&&supply&&BigInt(t.amountRaw)*10000n>=BigInt(supply);if(!material)continue;members.add(t.from);members.add(t.to);relationships.push({...t,relation:'observed_material_transfer',commonOwnershipEstablished:false});}
 }
 observation.verifiedEscrowFundingWindows=materialProofs.filter(p=>p.fundingSigner===creator).map(p=>({mint,creator,signature:p.signature,slot:p.slot,instructionIndex:p.event.instructionIndex,innerInstructionIndex:p.event.innerInstructionIndex,openingRaw:p.sourceRawBefore,outflowRaw:p.event.amountRaw,closingRaw:p.sourceRawAfter,classification:'verified_external_transfer',historyComplete:false}));
 observation.materialAllocationEvidence={version:1,mint,observedAt:observation.observedAt,snapshotSlot:null,allocations:[],limitations:[]};
 // At most one fresh control read. All other discovery and decoding remains in
 // the original seventeen-request plan; the existing eighteenth slot is optional.
 const proof=materialProofs.find(p=>p.escrow===materialCandidate?.pubkey)||allocationDiscoveries.find(p=>p.escrow===materialCandidate?.pubkey);
 if(proof?.decoderVersion==='streamflow-create-metadata-binding-v1')observation.materialAccountInvestigation={...observation.materialAccountInvestigation,protocol:'streamflow',metadataDiscovery:proof};
 if(proof&&requests<18){try{
  const fresh=await read('getMultipleAccounts',[[proof.metadata,proof.escrow,STREAMFLOW_PROGRAM,STREAMFLOW_PROGRAM_DATA],{encoding:'base64',dataSlice:{offset:0,length:1104},commitment:'finalized',...(snapshotSlot!==null?{minContextSlot:snapshotSlot}:{})}]);
  if(!Number.isSafeInteger(fresh?.context?.slot)||fresh.context.slot<(snapshotSlot??0)||!Array.isArray(fresh.value)||fresh.value.length!==4)throw Error('INVALID_CONTROL_SNAPSHOT');
  const observedAt=new Date(now()).toISOString(),controlEvidence=verifyStreamflowAllocationControls({metadataAddress:proof.metadata,metadataAccount:fresh.value[0],tokenAccountAddress:proof.escrow,tokenAccount:normalizeStreamflowEscrowAccount(fresh.value[1]),mint,observedAt,evidenceSlot:fresh.context.slot,supportingSignature:proof.signature});
  if(controlEvidence&&proof.sender&&controlEvidence.sender!==proof.sender)throw Error('METADATA_SENDER_BINDING_MISMATCH');
  const upgradeControl=verifyStreamflowUpgradeControl({programAccount:fresh.value[2],programDataAddress:STREAMFLOW_PROGRAM_DATA,programDataAccount:fresh.value[3],dataSlice:{offset:0,length:1104}});
  if(controlEvidence&&upgradeControl){controlEvidence.upgradeControl=upgradeControl;controlEvidence.programUpgradeAuthorityVerified=true;controlEvidence.limitations=controlEvidence.limitations.filter(s=>!s.startsWith('Deployed program upgrade authority'));controlEvidence.limitations.push(upgradeControl.programUpgradeable?'Observed program upgrade authority can change code; current local restrictions are not a permanent guarantee.':'No loader upgrade authority observed; internal administrative paths remain unassessed.');}
  observation.materialAllocationEvidence.snapshotSlot=fresh.context.slot;
  observation.materialAllocationEvidence.observedAt=observedAt;
  observation.materialAllocationEvidence.allocations.push({tokenAccount:proof.escrow,metadataAddress:proof.metadata,proofSignature:proof.signature,proofSlot:proof.slot,controlEvidence,observedAt,snapshotSlot:fresh.context.slot});
  if(!controlEvidence)observation.materialAllocationEvidence.limitations.push('Fresh allocation controls could not be verified against the supported metadata layout.');
 }catch{observation.materialAllocationEvidence.limitations.push('Fresh allocation metadata or escrow account retrieval unavailable; funding transfer remains verified, current release controls unresolved.');}}
 else if(proof)observation.materialAllocationEvidence.limitations.push('Existing investigation budget exhausted before current allocation control refresh.');
 observation.materialTransferInvestigations=[];
 if(creator&&!proof&&requests<18){
  const recipients=events.map(event=>materialTransferRecipient({mint,creator,event,transaction:transactions.get(event.signature),supplyRaw:supply})).filter(Boolean).sort((a,b)=>BigInt(a.amountRaw)>BigInt(b.amountRaw)?-1:1);
  if(recipients.length)observation.materialTransferInvestigations.push(await investigateMaterialRecipient({target:recipients[0],read,now,minContextSlot:snapshotSlot??0,largestSampleTokenAccount}));
 }
 const holderSetHash=createHash('sha256').update(JSON.stringify(holders.map(h=>[h.wallet,h.amountRaw]).sort())).digest('hex');
 observation.holderRelationships=holders.length?{version:2,mint,sampleWallets:holders,holderSetHash,snapshotSlot,supplyRaw:supply,observedAt:observation.observedAt,eligibleWallets:holders.length,connectedExposurePct:Number(holders.filter(h=>members.has(h.wallet)).reduce((n,h)=>n+BigInt(h.amountRaw),0n)*1000000n/BigInt(supply))/10000,relationshipCount:relationships.length,relationships,fundingObservations,historyComplete:false,commonOwnershipEstablished:false,coverageScope:'Recent seven days; up to three eligible wallet histories (two when replaced by a material account genesis read) and eight prioritized transactions, plus token-specific creator history. No wallet-independence claim.'}:null;
 events=events.map(e=>{const precise=preciseOutflows.get(e.signature+':'+e.instructionIndex+':'+e.innerInstructionIndex);return precise&&e.type==='EXTERNAL_TRANSFER_OUT'&&!e.transferMechanism&&e.mint===precise.mint&&e.creator===precise.creator&&e.amountRaw===precise.amountRaw?{...e,...precise}:e;});
 events=retainCreatorEventProvenance(deduplicateCreatorEvents(events),{mint,creator,transactions,sources:receiptSources,observedAt:observation.observedAt,attributionBasis:origin?.proof.attributionMethod||null});
 const ledger=creator?summarizeCreatorAcquisitionLedger({mint,creator,events,historyComplete:false,attributionComplete:false}):null;
 observation.creator=creator?{creator,attribution:origin.proof,status:'evidence_available',behaviourV2:{version:2,mint,creator,currentWallet:observation.adaptiveCreator.currentWallet,ledger:{acceptedCount:ledger.acceptedCount,purchasedRaw:ledger.purchasedRaw,verifiedSoldRaw:ledger.verifiedSoldRaw,burnedRaw:ledger.burnedRaw,externalTransferredOutRaw:ledger.externalTransferredOutRaw},signatures:[...transactions.keys()],processedHistoricalSignatures:transactions.size,tokenHistoryDiagnostics:observation.adaptiveCreator.diagnostics,tokenAccountsDiscovered:observation.adaptiveCreator.tokenAccountsDiscovered??0,tokenSpecificTransactionsRecovered:creatorSignatures.size,verifiedEventsRecovered:ledger.acceptedCount,investigationStopReason:observation.earlyStop||(observation.adaptiveCreator.paginationRemaining?'token_account_page_budget_exhausted':observation.creatorHistoryCheckpoint?.addressWindowExhausted?'target_token_account_window_exhausted_other_accounts_unassessed':'bounded_transaction_cap_or_candidate_window'),historyStatus:ledger.acceptedCount?'incomplete_history_with_recovered_events':'no_matching_events_in_incomplete_history',directMintReceivedRaw:ledger.directMintReceivedRaw,launchRaw:ledger.launchRaw,externalReceivedRaw:ledger.externalReceivedRaw,rewardReceivedRaw:ledger.rewardReceivedRaw,ordinaryIncomingRaw:ledger.ordinaryIncomingRaw,escrowDepositedRaw:ledger.escrowDepositedRaw,protocolFeesPaidRaw:ledger.protocolFeesPaidRaw,ordinaryOutgoingRaw:ledger.ordinaryOutgoingRaw,totalAcquiredRaw:ledger.totalAcquiredRaw,historyComplete:false,lifetimeSellingPct:null,limitations:['Creation plus a bounded token-account-specific page and recent material holder window; acquisitions and disposals remain incomplete.','Unsupported swap instructions never become verified sales; burns and external transfers remain distinct.']},events}: {status:originFailure==='conflicting_evidence'?'attribution_conflict':originFailure?'provider_temporarily_unavailable':'attribution_inconclusive',reason:originFailure||creatorOriginLimitation(originDiagnostics)};
 observation.creatorAccounting=creator?reconcileCreatorHistoryWindow({mint,creator,events,closingBalanceRaw:observation.adaptiveCreator.currentWallet?.rawBalance,closingVerified:!!observation.adaptiveCreator.currentWallet}):null;
 observation.eventReceipts=[...transactions].filter(([signature])=>events.some(e=>e.signature===signature)).map(([signature,tx])=>({signature,slot:tx.slot,timestamp:tx.blockTime,mint,mintDecimals,commitment:'finalized',source:'admitted_rpc',preTokenBalances:(tx.meta?.preTokenBalances||[]).filter(b=>b.mint===mint&&b.owner===creator),postTokenBalances:(tx.meta?.postTokenBalances||[]).filter(b=>b.mint===mint&&b.owner===creator)}));
 observation.transactionCache=creator?cacheCreatorTransactions(transactions,mint,origin?.proof.creationSignature):[];
 observation.creatorInvestigation={indexedCandidateLimit:12,candidateDiagnostics:originDiagnostics,candidatesReturned:originCandidateCount,unresolvedReason:originFailure||(!origin?creatorOriginLimitation(originDiagnostics):null),supportedDecoders:['Pump.fun','Raydium LaunchLab'],identityRolesNotEquivalent:true,historyComplete:false,terminalReason:origin?'verified_protocol_creator_role':originFailure||creatorOriginLimitation(originDiagnostics)};
 observation.execution={requests,attempted,reusedTransactions:reusableCreatorTransactions(previousObservation,mint,creator).length,transactionsChecked:transactions.size,holderWalletsInvestigated:holderHistories,boundedWindowDays:7,maxTransactions,failures,stopReason:observation.earlyStop||(failures.length?'bounded_pass_completed_with_gaps':'bounded_material_evidence_pass_completed'),automatic:true};
 return observation;
}
