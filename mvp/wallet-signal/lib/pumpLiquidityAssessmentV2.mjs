import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import BN from 'bn.js';
import {PUMP_AMM_SDK,PUMP_AMM_PROGRAM_ID,PUMP_FEE_PROGRAM_ID,GLOBAL_CONFIG_PDA,PUMP_AMM_FEE_CONFIG_PDA,poolPda,sellBaseInput,withdraw,computeFeesBps} from '@pump-fun/pump-swap-sdk';
import {decodeToken2022BinaryMint} from './token2022BinaryMint.mjs';
import {projectCurrentPoolReserves} from './currentPoolReserves.mjs';
const b=x=>new BN(String(x));
const percent=(n,d)=>Number(BigInt(n)*100000000n/BigInt(d))/1000000;
/** Verified PumpSwap SDK math at one finalized account context. Quotes are
 * deterministic state calculations, not transaction simulations or fill guarantees. */
export function projectPumpLiquidityV2(raw,mint){
 try{
  const reserve=projectCurrentPoolReserves({...raw,addresses:raw.addresses.slice(0,6),response:{...raw.response,value:raw.response.value.slice(0,6)}},mint);
  if(!reserve||raw.addresses[6]!==GLOBAL_CONFIG_PDA.toBase58()||raw.addresses[7]!==PUMP_AMM_FEE_CONFIG_PDA.toBase58())return null;
  const get=i=>{const a=raw.response.value[i];if(!a||a.executable!==false||a.data?.[1]!=='base64')throw Error();const data=Buffer.from(a.data[0],'base64');if(a.space!==data.length||data.toString('base64')!==a.data[0])throw Error();return {...a,data};};
  const account=get(0),globalAccount=get(6),feeAccount=get(7);
  if(account.owner!==PUMP_AMM_PROGRAM_ID.toBase58()||globalAccount.owner!==account.owner||feeAccount.owner!==PUMP_FEE_PROGRAM_ID.toBase58())return null;
  const pool=PUMP_AMM_SDK.decodePool(account),global=PUMP_AMM_SDK.decodeGlobalConfig(globalAccount),feeConfig=PUMP_AMM_SDK.decodeFeeConfig(feeAccount);
  if(poolPda(pool.index,pool.creator,pool.baseMint,pool.quoteMint).toBase58()!==raw.addresses[0]||pool.lpSupply.lten(0))return null;
  const x=b(reserve.baseReserveRaw),q=b(reserve.quoteReserveRaw),buckets=pool.protocolFees.add(pool.creatorFees),effective=q.add(pool.virtualQuoteReserves),real=q.sub(buckets);
  if(effective.lten(0)||real.lten(0)||pool.isMayhemMode||pool.isCashbackCoin)return null; // unsupported variants never inherit standard-pool eligibility
  const mintDecoded=decodeToken2022BinaryMint(get(3),mint)?.data.parsed.info;
  if(get(3).owner!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'&&(!mintDecoded||mintDecoded.extensions.some(e=>!['metadataPointer','tokenMetadata'].includes(e.extension))))return null;
  const mintInfo={supply:BigInt(reserve.mintSupplyRaw)};
  const fees=computeFeesBps({globalConfig:global,feeConfig,creator:pool.creator,baseMintSupply:b(reserve.mintSupplyRaw),baseMint:pool.baseMint,baseReserve:x,quoteReserve:effective,quoteMint:pool.quoteMint,isMayhemMode:pool.isMayhemMode,creatorFeeBps:pool.creatorFeeBps});
  if(Object.values(fees).some(v=>v.isNeg()||v.gtn(10000)))return null;
  const quote=base=>sellBaseInput({base,slippage:0,baseReserve:x,quoteReserve:q,virtualQuoteReserves:pool.virtualQuoteReserves,feeBucketsTotal:buckets,globalConfig:global,feeConfig,baseMintAccount:mintInfo,baseMint:pool.baseMint,coinCreator:pool.coinCreator,creator:pool.creator,quoteMint:pool.quoteMint,isMayhemMode:false,creatorFeeBps:pool.creatorFeeBps});
  const referenceQuotes=[1,10,100].map(sol=>{
   if(global.disableFlags&16)return {referenceNotionalSol:sol,referenceNotional:sol,quoteSymbol:"SOL",quoteOutputRaw:null,impactIncludingFeesPct:null,executable:false,reason:"selling_disabled"};
   const notional=b(sol).mul(b(1e9)),base=notional.mul(x).div(effective);if(base.lten(0))throw Error();
   let r;try{r=quote(base);}catch(error){if(String(error?.message).includes('Insufficient real quote reserves'))return {referenceNotionalSol:sol,referenceNotional:sol,quoteSymbol:'SOL',baseInputRaw:base.toString(),quoteOutputRaw:null,impactIncludingFeesPct:null,executable:false,reason:'insufficient_real_quote_reserves'};throw error;}const spot=base.mul(effective).div(x);
   return {referenceNotionalSol:sol,referenceNotional:sol,quoteSymbol:"SOL",baseInputRaw:base.toString(),quoteOutputRaw:r.uiQuote.toString(),impactIncludingFeesPct:percent(spot.sub(r.uiQuote).toString(),spot.toString()),curveImpactPct:percent(spot.sub(r.internalQuoteAmountOut).toString(),spot.toString())};
  });
  // Max outstanding LP claim uses protocol accounting supply, not the mint supply.
  const outstanding=b(reserve.lpSupplyRaw);if(outstanding.gt(pool.lpSupply))return null;
  const redemption=outstanding.isZero()?{base:b(0),quote:b(0)}:withdraw(outstanding,0,x,real,pool.lpSupply);
  const maxCurrentWithdrawalPct=percent(outstanding.toString(),pool.lpSupply.toString());
  const lpHolders=[];let lpSum=0n;
  for(const key of raw.lpTokenAccounts||raw.addresses.slice(8,10)){
   const i=raw.addresses.indexOf(key);if(i<8)return null;
   const a=get(i),d=a.data;if(a.owner!==get(4).owner||d.length<165||new PublicKey(d.subarray(0,32)).toBase58()!==pool.lpMint.toBase58()||![1,2].includes(d[108]))return null;
   const owner=new PublicKey(d.subarray(32,64)).toBase58(),amount=d.readBigUInt64LE(64).toString();lpSum+=BigInt(amount);lpHolders.push({tokenAccount:raw.addresses[i],owner,amountRaw:amount,delegated:d.readUInt32LE(72)!==0,frozen:d[108]===2});
  }
  const flags=[];
  const delegatedVault=[1,2].some(i=>{const d=get(i).data;return d.readUInt32LE(72)!==0&&d.readBigUInt64LE(121)>0n&&new PublicKey(d.subarray(76,108)).toBase58()!==raw.addresses[0];});
  if(delegatedVault)flags.push({id:"external_vault_delegate",severity:"critical",detail:"A pool vault retains an external spending delegate. LP claims alone do not bound withdrawal exposure."});
  if(referenceQuotes.some(q=>q.executable===false))flags.push({id:'reference_exit_unavailable',severity:'critical',detail:'A defined reference sale cannot be funded by the real quote reserves under the current protocol calculation.'});
  if(global.disableFlags&16)flags.push({id:'selling_disabled',severity:'critical',detail:'PumpSwap global configuration currently disables selling.'});
  if(global.disableFlags&4)flags.push({id:'withdrawals_disabled',severity:'high',detail:'PumpSwap global configuration currently disables withdrawals.'});
  flags.push({id:'protocol_admin_controls',severity:global.admin?.toBase58?.()&&global.admin.toBase58()!=='11111111111111111111111111111111'?'high':'information',detail:'Protocol global operation controls remain separate from LP redemption exposure; a retained protocol administrator can change operation flags. Program upgrade authority is not certified by this calculation.'});
  if(maxCurrentWithdrawalPct>20)flags.push({id:'material_lp_withdrawal_exposure',severity:'critical',detail:'Outstanding LP tokens can claim more than 20% of pool reserves under current protocol rules.'});
  return {...reserve,evidenceId:createHash('sha256').update(JSON.stringify({slot:raw.response.context.slot,addresses:raw.addresses,accounts:raw.response.value.map(a=>a?.data)})).digest('hex'),version:2,protocol:'pump_amm',decoder:'@pump-fun/pump-swap-sdk@2.1.0',effectiveQuoteReserveRaw:effective.toString(),realQuoteReserveRaw:real.toString(),feeBucketsRaw:buckets.toString(),virtualQuoteReservesRaw:pool.virtualQuoteReserves.toString(),feesBps:Object.fromEntries(Object.entries(fees).map(([k,v])=>[k,v.toNumber()])),referenceQuotes,
   liquidityToMarketCapPct:percent(2n*BigInt(real.toString())*BigInt(reserve.baseReserveRaw),BigInt(reserve.mintSupplyRaw)*BigInt(effective.toString())),valuationDefinition:'Two-sided pool liquidity divided by spot fully diluted valuation, both denominated in SOL; not circulating market capitalization.',
   executableDepth:{method:'protocol_state_calculation',verified:true,maxReferenceQuoteSol:100,networkFeesIncluded:false,transactionSimulation:false},
   withdrawal:{maxCurrentWithdrawalPct:delegatedVault?null:maxCurrentWithdrawalPct,lpClaimOnlyMaxPct:maxCurrentWithdrawalPct,maxQuoteClaimRaw:redemption.quote.toString(),maxBaseClaimRaw:redemption.base.toString(),outstandingLpRaw:outstanding.toString(),protocolLpDenominatorRaw:pool.lpSupply.toString(),holderBalancesReconcile:lpSum===BigInt(outstanding.toString()),lpHolders,currentInstructionRulesOnly:true,adminOrProgramUpgradeRiskAssessed:false},
   flags,poolInventoryComplete:false,limitations:['Protocol quote at the observed slot, not a guaranteed transaction fill.','Pool concentration covers returned pools only; other architectures require their own decoder.','Historical fee-recipient authorization is a separate unresolved observation.']};
 }catch{return null;}
}
