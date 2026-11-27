import {extractIndependentPumpFunBuySettlement} from './pumpFunIndependentBuySettlement.mjs';
import {promotePumpFunCreatorBuy} from './pumpFunCreatorBuyPromotion.mjs';
import {extractPumpFunSettlementEvidence} from './pumpFunSettlementEvidenceExtractor.mjs';
import {verifyPumpFunCreatorSettlement} from './pumpFunCreatorSettlement.mjs';
import {groupPumpFunSellInnerInstructions} from './pumpFunSellInnerInstructionGroups.mjs';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {verifyBoundedCreatorOrigin} from './boundedCreatorOriginV2.mjs';
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
 * 1 creator history + 8 transaction reads = at most 16 logical requests. */
export async function investigateToken({mint,rpc,now=Date.now,maxTransactions=8,previousObservation=null}={}){
 new PublicKey(mint);if(typeof rpc!=='function'||!Number.isInteger(maxTransactions)||maxTransactions<1||maxTransactions>8)throw Error('INVALID_INVESTIGATION');
 let requests=0;const attempted=[],failures=[];
 const read=async(method,params)=>{if(requests>=18)throw Error('BOUNDED_REQUEST_LIMIT');requests++;attempted.push(method);return rpc(method,params);};
 const observation={version:1,investigationRevision:2,mint,status:'investigation_completed',observedAt:new Date(now()).toISOString(),scope:'One bounded recent window plus verified creation; histories remain incomplete',historyComplete:false};
 let origin=null;
 try{const r=await read('getTransactionsForAddress',[mint,{transactionDetails:'full',sortOrder:'asc',limit:3,commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:1,filters:{status:'succeeded'}}]);const txs=r?.data||[];for(const tx of txs){const proof=verifyBoundedCreatorOrigin(tx,mint);if(proof){if(origin&&origin.proof.creator!==proof.creator)throw Error('CONFLICTING_CREATOR_EVIDENCE');origin={proof,tx};}}}
 catch(e){failures.push({producer:'creator_origin',reason:e.code===-32601?'indexed_method_unsupported':'provider_temporarily_unavailable'});}
 const creator=origin?.proof.creator,events=previousObservation?.mint===mint&&previousObservation?.creator?.creator===origin?.proof.creator?[...(previousObservation.creator.events||[])]:[],transactions=new Map(),signatures=new Map();
 if(origin){transactions.set(origin.proof.creationSignature,origin.tx);const launch=reconcileCreatorLaunchTransaction({mint,creator,signature:origin.proof.creationSignature,transaction:origin.tx});if(launch.event)events.push(launch.event);}
 let holders=[],supply=null,snapshotSlot=null,mintDecimals=null;
 try{
  const largest=await read('getTokenLargestAccounts',[mint,{commitment:'finalized'}]);
  const addresses=(largest?.value||[]).slice(0,20).map(x=>x.address);
  if(!addresses.length)throw Error('NO_HOLDER_ACCOUNTS');
  const sample=await read('getMultipleAccounts',[[mint,...addresses],{encoding:'jsonParsed',commitment:'finalized',minContextSlot:largest.context.slot}]);
  const m=sample?.value?.[0],mi=m?.data?.parsed?.info;
  if(m?.executable!==false||!TOKEN.has(m.owner)||m.data.parsed.type!=='mint'||mi?.isInitialized!==true||!uint(mi.supply)||BigInt(mi.supply)===0n||!Number.isSafeInteger(sample.context?.slot))throw Error('INVALID_MINT_SNAPSHOT');
  supply=mi.supply;mintDecimals=Number.isInteger(mi.decimals)&&mi.decimals>=0&&mi.decimals<=255?mi.decimals:null;snapshotSlot=sample.context.slot;const grouped=new Map();
  for(const a of sample.value.slice(1)){const i=a?.data?.parsed?.info;if(a?.executable!==false||!TOKEN.has(a.owner)||a.data.parsed.type!=='account'||i?.mint!==mint||!uint(i.tokenAmount?.amount)||!PublicKey.isOnCurve(new PublicKey(i.owner).toBytes())||i.owner==='1nc1nerator11111111111111111111111111111111')continue;grouped.set(i.owner,(grouped.get(i.owner)||0n)+BigInt(i.tokenAmount.amount));}
  const owners=[...grouped.keys()];
  if(owners.length){const classes=await read('getMultipleAccounts',[owners,{encoding:'base64',commitment:'finalized',minContextSlot:snapshotSlot}]);if(!Number.isSafeInteger(classes.context?.slot)||classes.context.slot<snapshotSlot||classes.value?.length!==owners.length)throw Error('CLASSIFICATION_UNAVAILABLE');owners.forEach((w,i)=>{const a=classes.value[i];if(a!==null&&(a?.owner!=='11111111111111111111111111111111'||a.executable!==false))grouped.delete(w);});}
  holders=[...grouped].map(([wallet,amount])=>({wallet,amountRaw:amount.toString()})).sort((a,b)=>BigInt(a.amountRaw)>BigInt(b.amountRaw)?-1:BigInt(a.amountRaw)<BigInt(b.amountRaw)?1:0);
  if(holders.reduce((n,h)=>n+BigInt(h.amountRaw),0n)>BigInt(supply))throw Error('INVALID_SAMPLE_SUM');
  for(const h of holders.slice(0,3)){
   const rows=await read('getSignaturesForAddress',[h.wallet,{limit:6,commitment:'finalized'}]);
   for(const r of rows||[])if(r.err===null&&Number.isSafeInteger(r.blockTime)&&r.blockTime>=Math.floor(now()/1000)-7*86400)signatures.set(r.signature,(signatures.get(r.signature)||0)+1);
  }
 }catch{holders=[];failures.push({producer:'holder_relationships',reason:'eligible_snapshot_or_recent_history_unavailable'});}
 if(creator)try{const rows=await read('getSignaturesForAddress',[creator,{limit:12,commitment:'finalized'}]);for(const r of rows||[])if(r.err===null&&Number.isSafeInteger(r.blockTime)&&r.blockTime>=Math.floor(now()/1000)-7*86400)signatures.set(r.signature,(signatures.get(r.signature)||0)+2);}catch{failures.push({producer:'creator_history',reason:'provider_temporarily_unavailable'});}
 const selected=[...signatures].sort((a,b)=>b[1]-a[1]).slice(0,maxTransactions);
 for(const [signature] of selected){if(transactions.has(signature))continue;try{const tx=await read('getTransaction',[signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:1}]);if(tx?.transaction?.signatures?.[0]===signature&&tx.meta?.err===null){transactions.set(signature,tx);
   const network=extractHolderNetworkTransfers({transaction:tx,signature});
   const eligible=new Map(holders.map(h=>[h.wallet,BigInt(h.amountRaw)]));
   const decisive=network.valid&&network.transfers.some(t=>eligible.has(t.from)&&eligible.has(t.to)&&t.from!==t.to&&(t.assetType==='SOL'?t.innerInstructionIndex===null&&BigInt(t.amountRaw)>=50000000n:t.mint===mint&&BigInt(t.amountRaw)*10000n>=BigInt(supply))&&(eligible.get(t.from)+eligible.get(t.to))*100n>=BigInt(supply)*20n);
   if(decisive){observation.earlyStop='material_connected_exposure_observed';break;}
  }else failures.push({producer:'transaction',reason:'transaction_unavailable_or_failed'});}catch{failures.push({producer:'transaction',reason:'provider_temporarily_unavailable'});break;}}
 // Spend only the two existing spare requests on a material launch-purchase gap.
 // No quota increase, unbounded pagination, or synchronous first-assessment work.
 const initialLedger=creator?summarizeCreatorAcquisitionLedger({mint,creator,events,historyComplete:false,attributionComplete:false}):null;
 observation.adaptiveCreator={status:'not_triggered',additionalRequests:0};
 if(creator&&uint(supply)&&BigInt(supply)>0n&&uint(initialLedger?.purchasedRaw)&&BigInt(initialLedger.purchasedRaw)*100n>=BigInt(supply)&&requests<=16){
  try{
   const accounts=await read('getTokenAccountsByOwner',[creator,{mint},{encoding:'jsonParsed',commitment:'finalized'}]);
   observation.adaptiveCreator.additionalRequests++;
   if(!Number.isSafeInteger(accounts?.context?.slot)||!Array.isArray(accounts.value)||accounts.value.length>1000)throw Error('INVALID_WALLET');
   const seen=new Set();let current=0n;
   for(const row of accounts.value){const a=row.account,i=a?.data?.parsed?.info;
    if(seen.has(row.pubkey)||a?.executable!==false||!TOKEN.has(a.owner)||a.data?.parsed?.type!=='account'||i?.mint!==mint||i.owner!==creator||!uint(i.tokenAmount?.amount))throw Error('INVALID_WALLET');
    seen.add(row.pubkey);current+=BigInt(i.tokenAmount.amount);
   }
   observation.adaptiveCreator.currentWallet={rawBalance:current.toString(),slot:accounts.context.slot,observedAt:new Date(now()).toISOString(),accountCount:seen.size};
   if(current*100n<BigInt(initialLedger.purchasedRaw)){
    observation.adaptiveCreator.status='targeted_early_history';
    const launchAccount=(origin.tx.meta?.postTokenBalances||[]).find(b=>b.mint===mint&&b.owner===creator);
    const target=launchAccount?key(origin.tx.transaction.message.accountKeys[launchAccount.accountIndex]):creator;
    observation.adaptiveCreator.targetAddress=target||creator;
    const page=await read('getTransactionsForAddress',[target||creator,{transactionDetails:'full',sortOrder:'asc',limit:12,commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:1,filters:{status:'succeeded'}}]);
    observation.adaptiveCreator.additionalRequests++;
    if(!Array.isArray(page?.data)||page.data.length>12)throw Error('INVALID_TARGETED_PAGE');
    for(const tx of page.data){const sig=tx?.transaction?.signatures?.[0];if(typeof sig==='string'&&tx.meta?.err===null&&Number.isSafeInteger(tx.slot)&&Number.isSafeInteger(tx.blockTime)&&tx.blockTime>=origin.proof.creationTime&&tx.transaction?.message?.accountKeys?.some(k=>key(k)===mint))transactions.set(sig,tx);}
    observation.adaptiveCreator.status='bounded_early_history_assessed';
    observation.adaptiveCreator.scope='Up to 12 earliest launch token-account transactions (creator wallet fallback); only matching mint after verified creation is classified. No lifetime reconciliation.';
   }else observation.adaptiveCreator.status='current_holdings_do_not_trigger_enrichment';
  }catch{observation.adaptiveCreator.status='evidence_unavailable';failures.push({producer:'adaptive_creator',reason:'targeted_evidence_unavailable'});}
 }
 const memberSet=new Set(holders.map(h=>h.wallet)),members=new Set(),relationships=[],fundingObservations=[];
 for(const [signature,tx] of transactions){
  if(creator){
   const independentSettlement=extractIndependentPumpFunBuySettlement({mint,creator,signature,transaction:tx});
   if(independentSettlement){const buy=promotePumpFunCreatorBuy({mint,creator,signature,transaction:tx,independentSettlement});if(buy.status==='VERIFIED')events.push(buy.event);}
   const settlement=extractPumpFunSettlementEvidence({mint,creator,signature,transaction:tx});
   if(settlement){const verified=verifyPumpFunCreatorSettlement({candidate:{status:'CORROBORATED_CANDIDATE',saleVerified:false,signature,creator,mint,soldRaw:settlement.soldRaw},settlement});
    const groups=groupPumpFunSellInnerInstructions({transaction:tx});
    if(verified.status==='VERIFIED'&&groups.length===1){const g=groups[0];const indices=g.innerInstructions.map((ix,i)=>({ix,i})).filter(({ix})=>['transfer','transferChecked'].includes(ix.parsed?.type)&&String(ix.parsed.info?.tokenAmount?.amount??ix.parsed.info?.amount)===settlement.soldRaw);
     if(indices.length===1)events.push({signature,instructionIndex:g.outerInstructionIndex,innerInstructionIndex:indices[0].i,mint,creator,type:'VERIFIED_SALE',timestamp:tx.blockTime,amountRaw:settlement.soldRaw,independentlyVerified:true,instructionVerified:true,settlementVerified:true});
    }
   }
   const outflow=reconcileCreatorNonSaleOutflow({mint,creator,signature,transaction:tx});if(outflow.event&&(outflow.event.type!=='VERIFIED_BURN'||verifySignedBurnInstructionV2(tx)))events.push(outflow.event);}
  const network=extractHolderNetworkTransfers({transaction:tx,signature});
  if(network.valid)for(const t of network.transfers){if(memberSet.has(t.to)&&!memberSet.has(t.from)&&t.assetType==='SOL'&&t.innerInstructionIndex===null&&BigInt(t.amountRaw)>=50000000n&&PublicKey.isOnCurve(new PublicKey(t.from).toBytes()))fundingObservations.push({...t,sourceClassification:'unresolved',commonOwnershipEstablished:false});if(!memberSet.has(t.from)||!memberSet.has(t.to)||t.from===t.to)continue;const material=t.assetType==='SOL'?t.innerInstructionIndex===null&&BigInt(t.amountRaw)>=50000000n:t.mint===mint&&supply&&BigInt(t.amountRaw)*10000n>=BigInt(supply);if(!material)continue;members.add(t.from);members.add(t.to);relationships.push({...t,relation:'observed_material_transfer',commonOwnershipEstablished:false});}
 }
 const holderSetHash=createHash('sha256').update(JSON.stringify(holders.map(h=>[h.wallet,h.amountRaw]).sort())).digest('hex');
 observation.holderRelationships=holders.length?{version:2,mint,sampleWallets:holders,holderSetHash,snapshotSlot,supplyRaw:supply,observedAt:observation.observedAt,eligibleWallets:holders.length,connectedExposurePct:Number(holders.filter(h=>members.has(h.wallet)).reduce((n,h)=>n+BigInt(h.amountRaw),0n)*1000000n/BigInt(supply))/10000,relationshipCount:relationships.length,relationships,fundingObservations,historyComplete:false,commonOwnershipEstablished:false,coverageScope:'Recent seven days; up to three eligible wallet histories and eight prioritized transactions, plus matching early creator transactions when triggered. No wallet-independence claim.'}:null;
 const ledger=creator?summarizeCreatorAcquisitionLedger({mint,creator,events,historyComplete:false,attributionComplete:false}):null;
 observation.creator=creator?{creator,attribution:origin.proof,status:'evidence_available',behaviourV2:{version:2,mint,creator,ledger:{acceptedCount:ledger.acceptedCount,purchasedRaw:ledger.purchasedRaw,verifiedSoldRaw:ledger.verifiedSoldRaw,burnedRaw:ledger.burnedRaw,externalTransferredOutRaw:ledger.externalTransferredOutRaw},processedHistoricalSignatures:transactions.size,historyComplete:false,lifetimeSellingPct:null,limitations:['Creation plus a bounded recent window; acquisitions and disposals remain incomplete.','Unsupported swap instructions never become verified sales; burns and external transfers remain distinct.']},events}: {status:failures.some(x=>x.producer==='creator_origin')?'provider_temporarily_unavailable':'unsupported_protocol',reason:failures.some(x=>x.producer==='creator_origin')?'indexed_creation_temporarily_unavailable':'no_supported_protocol_creator_instruction_in_three_earliest_transactions'};
 observation.eventReceipts=[...transactions].filter(([signature])=>events.some(e=>e.signature===signature)).map(([signature,tx])=>({signature,slot:tx.slot,timestamp:tx.blockTime,mint,mintDecimals,commitment:'finalized',source:'admitted_rpc',preTokenBalances:(tx.meta?.preTokenBalances||[]).filter(b=>b.mint===mint&&b.owner===creator),postTokenBalances:(tx.meta?.postTokenBalances||[]).filter(b=>b.mint===mint&&b.owner===creator)}));
 observation.execution={requests,attempted,transactionsChecked:transactions.size,holderWalletsInvestigated:Math.min(3,holders.length),boundedWindowDays:7,maxTransactions,failures,stopReason:observation.earlyStop||(failures.length?'bounded_pass_completed_with_gaps':'bounded_material_evidence_pass_completed'),automatic:true};
 return observation;
}
