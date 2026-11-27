// Deterministic presentation fixture. These values never enter application code.
// Shapes follow the existing accepted evidence contracts; not a new live receipt.
export const referenceMint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
export function replay(mint=referenceMint){
 const observedAt=new Date().toISOString(),creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
 const result={mint,tokenProgram:'spl-token',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null,supplyRaw:'1000000000000000',observedAt,contextSlot:474107048};
 const quotes=[1,10,100].map((referenceNotional,i)=>({referenceNotional,quoteSymbol:'SOL',impactIncludingFeesPct:[1.02,1.69,7.908][i],executable:true}));
 const currentLiquidity={version:2,mint,observedAt,slot:474107032,protocol:'PumpSwap',pool:'6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA',executableDepth:{verified:true},referenceQuotes:quotes,withdrawal:{maxCurrentWithdrawalPct:0.003645},liquidityToMarketCapPct:20,flags:[{id:'protocol_admin_controls',severity:'high',detail:'Protocol administrator retains operation controls.'}],limitations:['Protocol administration is separate from current LP redemption rights.']};
 const currentCreator={version:2,mint,creator,status:'verified_current_wallet',rawBalance:'599036011328',observedAt,slot:474107048};
 const creatorEvidence={mint,creator,status:'VERIFIED',independentlyReviewed:true};
 const workerEvidence={version:'1.1',mint,canonicalHolder:{schemaVersion:2,mint,status:'canonical_observation',snapshotId:'0596510d6dc07e1dce934fba0dcf96a5594b38807383bd6d829d9d6fe441177b',holderSetHash:'77f749040d291e057c546d1f4872f4de9432bdda4be512a0dc94bda14bc20daa',top20SharePct:24.5379,largestHolderSharePct:2.1151,observedAt,contextSlots:{inventory:474029636}},holderRelationships:{version:2,mint,holderSetHash:'77f749040d291e057c546d1f4872f4de9432bdda4be512a0dc94bda14bc20daa',connectedExposurePct:2.6224,historyComplete:false},liquidity:{mint,lq09Observation:{mint,creatorRecipientMatchesHistoricalState:false}},creator:{mint,behaviourV2:{version:2,mint,creator,ledger:{purchasedRaw:'1000000000',externalTransferredOutRaw:'332000000',verifiedSoldRaw:'0',burnedRaw:'0',acceptedCount:6},processedHistoricalSignatures:4656,limitations:['Recipient ownership and historical selling coverage remain unresolved.']}}};
 const reportedLiquidity={mint,status:'pools_reported',observedAt,poolCountReturned:1,largestReportedPoolSharePct:100,pools:[]};
 return {result,currentLiquidity,currentCreator,creatorEvidence,workerEvidence,reportedLiquidity};
}
