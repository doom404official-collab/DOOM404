import {assessSecurityV2} from './securityAssessmentV2.mjs';
const round=x=>Math.round(x*100)/100;
const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const raw=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
const pct=(n,d)=>raw(n)&&raw(d)&&BigInt(d)>0n?Number(BigInt(n)*1000000n/BigInt(d))/10000:null;
const ramp=(x,low,high)=>Math.max(0,Math.min(1,(x-low)/(high-low)));
const fresh=(x,now,max=3600000)=>Number.isFinite(Date.parse(x))&&Date.parse(x)<=now&&now-Date.parse(x)<=max;
const part=(id,max,risk,complete)=>({id,max,riskPoints:number(risk)?round(Math.min(max,risk)):0,complete:complete===true});
const assessment=(id,components,flags=[],missing=[],metrics={})=>({version:'2.0',attribute:id,riskScore:round(components.reduce((n,c)=>n+c.riskPoints,0)),coveragePct:round(components.reduce((n,c)=>n+(number(c.observedWeight)?Math.min(c.max,c.observedWeight):c.complete?c.max:0),0)),components,flags:flags.map(f=>({...f})),missing:[...missing],metrics});
/** Risk points are observed adverse evidence, higher = more observed risk.
 * Unknown criteria never generate safety credit or shrink the denominator.
 * A limited risk floor is never labelled low risk or a complete rating. */
export function practicalAssessmentV2({result,extensions,workerEvidence,creatorEvidence,concentration,currentLiquidity,currentCreator,reportedLiquidity,now=Date.now()}={}){
 const mint=result?.mint,same=x=>!!mint&&x?.mint===mint;
 const bridge=workerEvidence?.version==='1.1'&&same(workerEvidence)?workerEvidence:null;
 const ext=same(extensions)?extensions:null;
 const security=assessSecurityV2({tokenProgram:result?.tokenProgram,authoritiesParsed:result?.authorityDetailsStatus==='available',mintAuthority:result?.mintAuthority,freezeAuthority:result?.freezeAuthority,extensions:ext,now});
 security.metrics={program:result?.tokenProgram,observedAt:ext?.observedAt||result?.observedAt,scope:security.scope,configuredFeePct:ext?.transferFee?.effectiveFee?.percentage};
 const s=bridge?.canonicalHolder;
 const canonical=same(s)&&s.schemaVersion===2&&s.status==='canonical_observation'&&s.snapshotId==='0596510d6dc07e1dce934fba0dcf96a5594b38807383bd6d829d9d6fe441177b'&&s.holderSetHash==='77f749040d291e057c546d1f4872f4de9432bdda4be512a0dc94bda14bc20daa'&&number(s.top20SharePct)&&s.top20SharePct<=100&&number(s.largestHolderSharePct)&&s.largestHolderSharePct<=s.top20SharePct?s:null;
 const sampled=same(concentration)&&concentration.sampledWalletObservation?.version===2&&concentration.sampledWalletObservation.atomicSubset===true&&Number.isSafeInteger(concentration.sampledWalletObservation.contextSlots?.mint)&&concentration.sampledWalletObservation.contextSlots.mint===concentration.sampledWalletObservation.contextSlots.sampledAccounts&&Number.isSafeInteger(concentration.sampledWalletObservation.eligibleWallets)&&concentration.sampledWalletObservation.eligibleWallets>=0&&concentration.sampledWalletObservation.eligibleWallets<=20?concentration.sampledWalletObservation:null;
 const share=canonical?.top20SharePct??sampled?.observedSharePct,largest=canonical?.largestHolderSharePct??sampled?.largestSharePct;
 const distribution=number(share)&&share<=100&&number(largest)&&largest<=100?70*Math.max(ramp(share,15,65),ramp(largest,2,20)):null;
 const boundedRelationships=bridge?.holderRelationships;
 const matchingSample=sampled&&boundedRelationships?.supplyRaw===sampled.supplyRaw&&Number.isSafeInteger(boundedRelationships.snapshotSlot)&&fresh(boundedRelationships.observedAt,now)&&Array.isArray(boundedRelationships.sampleWallets)&&boundedRelationships.sampleWallets.length===sampled.eligibleWallets&&sampled.wallets&&JSON.stringify(boundedRelationships.sampleWallets.map(h=>h.wallet).sort())===JSON.stringify(sampled.wallets.map(h=>h.wallet).sort());
 const rel=same(boundedRelationships)&&boundedRelationships.version===2&&(canonical&&boundedRelationships.holderSetHash===canonical.holderSetHash||matchingSample)?boundedRelationships:null;
 const connectedMembers=matchingSample&&rel?new Set((rel.relationships||[]).flatMap(e=>[e.from,e.to])):null;
 const connected=connectedMembers?Number(sampled.wallets.filter(h=>connectedMembers.has(h.wallet)).reduce((n,h)=>n+BigInt(h.amountRaw),0n)*1000000n/BigInt(sampled.supplyRaw))/10000:number(rel?.connectedExposurePct)&&rel.connectedExposurePct<=100?rel.connectedExposurePct:null;
 const holderMissing=[...(!canonical?['Full eligible-wallet ranking; current account sample is bounded']:[]),'Bounded relationship observations do not prove wallet independence or common ownership.'];
 const distributionPart={...part('eligible_distribution_risk',70,distribution,!!canonical||distribution===70),observedWeight:canonical||distribution===70?70:sampled&&distribution!==null?70*sampled.eligibleWallets/20:0};
 const holder=assessment('holder_intelligence',[distributionPart,part('material_relationship_exposure',30,connected===null?null:30*ramp(connected,0,20),rel?.historyComplete===true)],[],holderMissing,{top20Pct:share,largestPct:largest,connectedExposurePct:connected,relationshipCount:rel?.relationshipCount??rel?.relationships?.length??null,snapshotSlot:canonical?.contextSlots?.inventory,snapshotObservedAt:canonical?.observedAt??sampled?.observedAt,distributionScope:canonical?'Accepted frozen eligible Top-20 baseline; classifications use a separate slot.':sampled?.scope,eligibleObservedWallets:canonical?20:sampled?.eligibleWallets,relationshipScope:rel?.coverageScope,historyComplete:false,commonOwnershipEstablished:false});
 if(number(share)&&share>50)holder.flags.push({id:'high_holder_concentration',severity:'high',detail:'Observed eligible/sample holders account for more than half of mint supply.'});
 if(connected!==null&&connected>=10)holder.flags.push({id:'connected_holder_exposure',severity:'high',detail:'Material observed transfer links involve holders of at least 10% of mint supply; common ownership is not established.'});
 const liq=same(currentLiquidity)?currentLiquidity:bridge?.liquidity?.currentScoringV2;
 const l=same(liq)&&liq.version===2&&liq.executableDepth?.verified===true&&fresh(liq.observedAt,now)&&liq.referenceQuotes?.length===3?liq:null;
 const ref=l?.referenceQuotes?.[2],small=l?.referenceQuotes?.[1];
 const impactLarge=ref?.impactIncludingFeesPct??ref?.quoteRecoveryShortfallPct??ref?.providerPriceImpactPct,impactSmall=small?.impactIncludingFeesPct??small?.quoteRecoveryShortfallPct??small?.providerPriceImpactPct;
 const depth=l?.referenceQuotes.some(q=>q.executable===false)?50:number(impactLarge)&&number(impactSmall)?50*Math.max(ramp(impactLarge,1,15),ramp(impactSmall,1,5)):null;
 const withdrawal=number(l?.withdrawal?.maxCurrentWithdrawalPct)&&l.withdrawal.maxCurrentWithdrawalPct<=100?l.withdrawal.maxCurrentWithdrawalPct:null;
 const ratio=number(l?.liquidityToMarketCapPct)?l.liquidityToMarketCapPct:null;
 const liquidity=assessment('liquidity_quality_safety',[part('exit_cost_and_depth',50,depth,depth!==null),part('current_lp_withdrawal_exposure',35,withdrawal!==null&&(withdrawal<=1||l?.withdrawal?.actualRightsVerified===true)?35*ramp(withdrawal,1,20):null,withdrawal!==null&&(withdrawal<=1||l?.withdrawal?.actualRightsVerified===true)),part('reserve_valuation_buffer',15,ratio===null?null:15*(1-ramp(ratio,2,20)),ratio!==null)],l?.flags||[],l?.limitations||['Current protocol-specific liquidity calculation unavailable; reserve observations alone are insufficient.'],l?{pool:l.pool,observedAt:l.observedAt,slot:l.slot,protocol:l.protocol,baseReserveRaw:l.baseReserveRaw,quoteReserveRaw:l.quoteReserveRaw,baseDecimals:l.baseDecimals,quotes:l.referenceQuotes,liquidityToFullyDilutedValuePct:ratio,maxCurrentWithdrawalPct:withdrawal,lpHolders:l.withdrawal?.lpHolders,scope:l.valuationDefinition}:{});
 if(depth===50&&!liquidity.flags.some(f=>['reference_exit_unavailable','selling_disabled'].includes(f.id)))liquidity.flags.push({id:'severe_reference_exit_cost',severity:'critical',detail:'A defined reference sale has severe observed exit cost against its stated valuation basis. Review the trade size, quote method and current pool evidence.'});
 const reported=same(reportedLiquidity)&&fresh(reportedLiquidity.observedAt,now)&&reportedLiquidity.status==='pools_reported'?reportedLiquidity:null;
 liquidity.metrics.reportedPoolCount=Number.isSafeInteger(reported?.poolCountReturned)?reported.poolCountReturned:null;
 liquidity.metrics.reportedLargestPoolSharePct=number(reported?.largestReportedPoolSharePct)&&reported.largestReportedPoolSharePct<=100?reported.largestReportedPoolSharePct:null;
 if(liquidity.metrics.reportedLargestPoolSharePct>80)liquidity.flags.push({id:'reported_pool_concentration',severity:'high',detail:'Provider-returned liquidity is concentrated in one reported pool. This is not an exhaustive on-chain pool inventory or proof of independent control.'});
 const historical=bridge?.liquidity?.lq09Observation;
 if(same(historical)&&historical.creatorRecipientMatchesHistoricalState===false)liquidity.flags.push({id:'historical_fee_recipient_mismatch',severity:'high',detail:'Historical creator fee recipient differs from historical pool creator. Authorization remains unresolved; this is not proof of liquidity withdrawal.'});
 const c=bridge?.creator,b=c?.behaviourV2;
 const currentAttribution=same(currentCreator)&&currentCreator.version===2&&currentCreator.attribution?.verified===true&&['transaction_local_protocol_creator','reviewed_persisted_attribution'].includes(currentCreator.attribution.verification)?currentCreator:null;
 const attributedCreator=same(creatorEvidence)&&creatorEvidence.status==='VERIFIED'&&creatorEvidence.independentlyReviewed===true?creatorEvidence.creator:currentAttribution?.creator||(same(c)&&c.attribution?.verified===true&&c.attribution.verification==='transaction_local_protocol_creator'?c.attribution.creator:null);
 const identity=!!attributedCreator&&(!b||same(b)&&b.version===2&&b.creator===attributedCreator);
 const wallet=identity&&same(currentCreator)&&currentCreator.version===2&&currentCreator.creator===attributedCreator&&currentCreator.status==='verified_current_wallet'&&fresh(currentCreator.observedAt,now)?currentCreator:identity&&b?.currentWallet&&fresh(b.currentWallet.observedAt,now)?b.currentWallet:null;
 const resultSupply=result?.supplyRaw||result?.rawSupply;
 const useMintResult=raw(resultSupply)&&(!raw(l?.mintSupplyRaw)||Number.isSafeInteger(result.contextSlot)&&result.contextSlot>=l.slot);
 const supply=useMintResult?resultSupply:l?.mintSupplyRaw,supplySlot=useMintResult?result.contextSlot:l?.slot;
 const currentPct=wallet&&raw(wallet.rawBalance)&&raw(supply)&&BigInt(wallet.rawBalance)<=BigInt(supply)?pct(wallet.rawBalance,supply):null;
 const ledger=identity?b?.ledger:null,acquired=ledger?.purchasedRaw;
 const transferBaseline=ledger?pct(ledger.externalTransferredOutRaw,acquired):null,saleBaseline=ledger?pct(ledger.verifiedSoldRaw,acquired):null;
 // Reported against a fixed verified purchase baseline, not total lifetime acquisitions.
 const behaviorRisk=number(transferBaseline)&&number(saleBaseline)?40*Math.max(ramp(saleBaseline,0,50),0.25*ramp(transferBaseline,0,50)):null;
 const creator=assessment('creator_intelligence',[part('attributed_wallet_exposure',60,currentPct===null?null:60*ramp(currentPct,2,20),currentPct!==null),part('observed_market_and_transfer_disposals',40,behaviorRisk,false)],[],identity?(b?.limitations||['Current creator identity is known; compatible historical behavior evidence is unavailable.']):['Verified creator attribution or compatible retained behavior evidence unavailable.'],{creator:identity?attributedCreator:null,currentWalletRaw:wallet?.rawBalance,currentWalletSlot:wallet?.slot,currentWalletObservedAt:wallet?.observedAt,currentWalletSharePct:currentPct,supplyObservationSlot:supplySlot,exposureAtomic:wallet?.slot===supplySlot,exposureScope:'Direct wallet balance / observed mint total supply; separate slots are not an atomic snapshot and linked wallets are not inferred.',purchaseBaselineRaw:acquired,burnedRaw:ledger?.burnedRaw,externalTransfersRaw:ledger?.externalTransferredOutRaw,verifiedSalesRaw:ledger?.verifiedSoldRaw,transferToPurchaseBaselinePct:transferBaseline,lifetimeSellingPct:null,processedSignatures:b?.processedHistoricalSignatures,verifiedEventCount:ledger?.acceptedCount,historyComplete:false});
 if(number(transferBaseline)&&transferBaseline>=20)creator.flags.push({id:'creator_material_external_transfers',severity:'high',detail:'Verified external token transfers reach at least 20% of the fixed verified purchase baseline. They are not classified as sales; recipient ownership and later disposal remain unresolved.'});
 if(number(saleBaseline)&&saleBaseline>=20)creator.flags.push({id:'creator_verified_disposals',severity:'high',detail:'Verified market sales reach at least 20% of the fixed verified purchase baseline; this is not a lifetime selling percentage.'});
 const scores={token_security:security,holder_intelligence:holder,liquidity_quality_safety:liquidity,creator_intelligence:creator};
 // All four approved category weights remain 25%. No normalization by available evidence.
 const values=Object.values(scores),coveragePct=round(values.reduce((n,a)=>n+a.coveragePct,0)/4),riskScore=round(values.reduce((n,a)=>n+a.riskScore,0)/4);
 const flags=values.flatMap(a=>a.flags.map(f=>({...f,attribute:a.attribute}))).sort((a,b)=>({critical:0,high:1,information:2}[a.severity]??3)-({critical:0,high:1,information:2}[b.severity]??3));
 const reliable=coveragePct>=80&&values.every(a=>a.coveragePct>=50)&&liquidity.coveragePct===100&&security.coveragePct===100;
 return {version:'2.0',mint,scores,riskScore,coveragePct,flags,status:reliable?'bounded_assessment':'limited_assessment',complete:values.every(a=>a.coveragePct===100),riskDirection:'Higher means more observed risk. Missing evidence is not evidence of safety.',unresolved:values.flatMap(a=>a.missing.map(detail=>({attribute:a.attribute,detail}))),calibration:'Control-policy and protocol-math validation; product calibration is reported separately.'};
}
