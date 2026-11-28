import {createHash} from 'node:crypto';import {decodeArchivedPumpAccount} from './liquidityArchiveStateDecoder.mjs';import {extractFeeSweepAccounts} from './liquidityFeeSweepAccounts.mjs';import {inspectFeeSettlementTransfers} from './liquidityFeeSettlementTransfers.mjs';import {assessFeeSettlement} from './liquidityFeeSettlementAssessment.mjs';import {assessHistoricalFeeAuthorization} from './liquidityHistoricalFeeAuthorization.mjs';
import {PublicKey} from '@solana/web3.js';
import {GLOBAL_CONFIG_PDA,poolPda} from '@pump-fun/pump-swap-sdk';
import {decodePumpAmmPoolState} from './pumpAmmPoolState.mjs';
/** Reconcile retained provider-attested historical bytes and parsed transfers.
 * An as-of-slot account is not transaction-index-specific state or a proof of
 * instruction authorization. Eligibility mismatch remains an explicit limitation. */
export function reconcileLiquidityLq09(evidence,expectedMint=null){
 const a=evidence,tx=a?.transaction,slot=a?.requestedSlot;
 if(a?.schemaVersion!==1||a.provider!=='alchemy'||a.historicalAccountReads!==2||a.transactionReads!==1||(!Number.isSafeInteger(slot)||slot<0)||tx?.slot!==slot||tx?.transaction?.signatures?.[0]!==a.signature||tx?.meta?.err!==null||!Array.isArray(a.records)||a.records.length!==2)throw Error('LQ09_IDENTITY_UNVERIFIED');
 const poolRecord=a.records.find(r=>r.role==='pump_amm_pool');
 const POOL=poolRecord?.address,GLOBAL=GLOBAL_CONFIG_PDA.toBase58();new PublicKey(POOL);
 const decoded={};for(const [role,address] of [['pump_amm_pool',POOL],['pump_amm_global_config',GLOBAL]]){
  const rows=a.records.filter(r=>r.role===role&&r.address===address);if(rows.length!==1)throw Error('LQ09_ACCOUNT_IDENTITY_UNVERIFIED');const r=rows[0];
  if(r.contextSlot!==slot||r.requestedSlot!==slot||r.providerHistoricalSlotSemanticsConfirmed!==true||r.account?.executable!==false||!Array.isArray(r.account?.data)||r.account.data[1]!=='base64')throw Error('LQ09_HISTORICAL_CONTEXT_UNVERIFIED');
  const bytes=Buffer.from(r.account.data[0],'base64');if(bytes.toString('base64')!==r.account.data[0]||createHash('sha256').update(bytes).digest('hex')!==r.accountDataSha256)throw Error('LQ09_BYTES_UNVERIFIED');
  decoded[role]=decodeArchivedPumpAccount(r.account,role);if(decoded[role].status!=='DECODED')throw Error('LQ09_LAYOUT_UNVERIFIED');
 }
 const MINT=decoded.pump_amm_pool.baseMint;
 if(expectedMint!==null&&MINT!==expectedMint)throw Error('LQ09_MINT_MISMATCH');
 const pool=decodePumpAmmPoolState(Buffer.from(poolRecord.account.data[0],'base64'),poolRecord.account.owner);
 if(!pool||poolPda(pool.index,new PublicKey(pool.creator),new PublicKey(pool.baseMint),new PublicKey(pool.quoteMint)).toBase58()!==POOL)throw Error('LQ09_POOL_IDENTITY_UNVERIFIED');
 const sweeps=extractFeeSweepAccounts(tx,POOL);const matched=sweeps.sweeps.filter(s=>s.poolMatched);
 if(matched.length!==2||matched.some(s=>s.globalConfigAddress!==GLOBAL))throw Error('LQ09_SWEEP_CONTEXT_UNVERIFIED');
 const transferEvidence=inspectFeeSettlementTransfers(tx,sweeps,{signature:a.signature,slot});
 const keys=tx.transaction.message.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),vault=matched[0].quoteVault;
 const balances=name=>tx.meta[name].filter(b=>keys[b.accountIndex]===vault);
 const before=balances('preTokenBalances'),after=balances('postTokenBalances');
 if(before.length!==1||after.length!==1||before[0].mint!==matched[0].quoteMint||after[0].mint!==matched[0].quoteMint)throw Error('LQ09_VAULT_BALANCE_UNVERIFIED');
 const vaultBalanceEvidence={vaults:[{vault,status:'observed',mintMatched:true,mint:before[0].mint,rawDelta:(BigInt(after[0].uiTokenAmount.amount)-BigInt(before[0].uiTokenAmount.amount)).toString()}]};
 const amounts=assessFeeSettlement({sweepAccounts:sweeps,transferEvidence,vaultBalanceEvidence});if(!amounts.amountReconciled)throw Error('LQ09_AMOUNTS_UNRECONCILED');
 const eligibility=assessHistoricalFeeAuthorization({transactionSlot:slot,poolState:{...decoded.pump_amm_pool,slot,verified:true},globalConfig:{...decoded.pump_amm_global_config,slot,verified:true},feeSweeps:matched});
 return {schemaVersion:1,mint:MINT,signature:a.signature,transactionSlot:slot,historicalAccountReads:2,provider:'alchemy',stateSemantics:'Provider-attested as-of-finalized-slot state; not transaction-index-specific',observedAt:a.records.map(r=>r.observedAt).sort().at(-1),
  amounts,recipientEligibility:eligibility.results,creatorRecipientMatchesHistoricalState:eligibility.results.find(r=>r.operation==='sweep_creator_fee')?.recipientEligible??null,protocolRecipientMatchesHistoricalState:eligibility.results.find(r=>r.operation==='sweep_protocol_fee')?.recipientEligible??null,
  historicalCoinCreator:decoded.pump_amm_pool.coinCreator,authorizationVerified:false,withdrawalConfirmed:false,historicalStateCryptographicallyCertified:false,scoreEligible:false,
  limitation:'Historical recipient eligibility and fee amounts do not prove instruction authorization or liquidity withdrawal. Creator-recipient mismatch and possible intra-slot state changes remain unresolved.'};
}
