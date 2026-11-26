import {PublicKey} from '@solana/web3.js';
import {createHash} from 'node:crypto';
import BN from 'bn.js';
import {CpmmPoolInfoLayout,CpmmConfigInfoLayout,CurveCalculator,getPdaPoolAuthority,getPdaVault,getPdaLpMint} from '@raydium-io/raydium-sdk-v2';
import {inspectTokenVault} from './liquidityVaultEvidence.mjs';
import {mintBaseObservation} from './mintBaseObservation.mjs';
import {decodeToken2022BinaryMint} from './token2022BinaryMint.mjs';
export const RAYDIUM_CPMM_PROGRAM='CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';
const SOL='So11111111111111111111111111111111111111112',USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const bn=x=>new BN(String(x));const pct=(n,d)=>Number(BigInt(n)*100000000n/BigInt(d))/1000000;
export function decodeCpmmPool(account){
 try{if(account?.owner.toBase58()!==RAYDIUM_CPMM_PROGRAM||account.executable!==false||!account.data.subarray(0,8).equals(createHash('sha256').update('account:PoolState').digest().subarray(0,8))||account.data.length!==CpmmPoolInfoLayout.span)return null;return CpmmPoolInfoLayout.decode(account.data);}catch{return null;}
}
export function projectRaydiumCpmmV2(raw,mint){
 try{
  if(raw?.schemaVersion!==1||raw.commitment!=='finalized'||!Number.isSafeInteger(raw.response?.context?.slot)||!Number.isFinite(Date.parse(raw.observedAt))||raw.addresses?.length<7)return null;
  const addresses=raw.addresses,accounts=raw.response.value.map(a=>{if(!a||a.executable!==false||a.data?.[1]!=='base64')throw Error();const d=Buffer.from(a.data[0],'base64');if(d.toString('base64')!==a.data[0]||d.length!==a.space)throw Error();return {...a,data:d,owner:new PublicKey(a.owner)};});
  const pool=decodeCpmmPool(accounts[0]);if(!pool||![pool.mintA.toBase58(),pool.mintB.toBase58()].includes(mint))return null;
  const isA=pool.mintA.toBase58()===mint,quoteMint=isA?pool.mintB:pool.mintA;
  if(![SOL,USDC].includes(quoteMint.toBase58()))return null;
  const protocol=new PublicKey(RAYDIUM_CPMM_PROGRAM),authority=getPdaPoolAuthority(protocol).publicKey.toBase58();
  if(addresses[1]!==pool.vaultA.toBase58()||addresses[2]!==pool.vaultB.toBase58()||addresses[3]!==pool.mintA.toBase58()||addresses[4]!==pool.mintB.toBase58()||addresses[5]!==pool.mintLp.toBase58()||addresses[6]!==pool.configId.toBase58()||accounts[6].owner.toBase58()!==RAYDIUM_CPMM_PROGRAM||!accounts[6].data.subarray(0,8).equals(createHash('sha256').update('account:AmmConfig').digest().subarray(0,8)))return null;
  if(getPdaVault(protocol,new PublicKey(addresses[0]),pool.mintA).publicKey.toBase58()!==addresses[1]||getPdaVault(protocol,new PublicKey(addresses[0]),pool.mintB).publicKey.toBase58()!==addresses[2]||getPdaLpMint(protocol,new PublicKey(addresses[0])).publicKey.toBase58()!==addresses[5])return null;
  const a=inspectTokenVault(accounts[1],addresses[3]),b=inspectTokenVault(accounts[2],addresses[4]);if(!a.verified||!b.verified||a.authority!==authority||b.authority!==authority)return null;
  const mintInfo=(i)=>{const account=accounts[i];if(account.owner.toBase58()===TOKEN&&account.data.length===82)return mintBaseObservation(account);const decoded=decodeToken2022BinaryMint(account,addresses[i])?.data?.parsed?.info;if(decoded?.extensions?.some(e=>!['metadataPointer','tokenMetadata'].includes(e.extension)))return null;return decoded;};
  const ma=mintInfo(3),mb=mintInfo(4),lp=mintInfo(5);if(!ma||!mb||!lp||lp.mintAuthority!==authority||lp.freezeAuthority!==null)return null;
  const ra=bn(a.rawAmount).sub(pool.protocolFeesMintA).sub(pool.fundFeesMintA).sub(pool.creatorFeesMintA),rb=bn(b.rawAmount).sub(pool.protocolFeesMintB).sub(pool.fundFeesMintB).sub(pool.creatorFeesMintB);
  const x=isA?ra:rb,y=isA?rb:ra,baseInfo=isA?ma:mb,quoteInfo=isA?mb:ma;if(x.lten(0)||y.lten(0)||pool.lpAmount.lten(0)||bn(lp.supply).gt(pool.lpAmount))return null;
  const config=CpmmConfigInfoLayout.decode(accounts[6].data);if(config.tradeFeeRate.gten(1000000)||config.creatorFeeRate.gten(1000000)||config.protocolFeeRate.add(config.fundFeeRate).gtn(1000000))return null;
  const unit=quoteMint.toBase58()===SOL?'SOL':'USDC',sizes=unit==='SOL'?[1,10,100]:[100,1000,10000];
  const feeOnInput=pool.feeOn===0||pool.feeOn===1&&isA||pool.feeOn===2&&!isA;
  const quotes=sizes.map(size=>{const notional=bn(size).mul(bn(10).pow(bn(quoteInfo.decimals))),amount=notional.mul(x).div(y);if(amount.lten(0))throw Error();const r=CurveCalculator.swapBaseInput(amount,x,y,config.tradeFeeRate,pool.enableCreatorFee?config.creatorFeeRate:bn(0),config.protocolFeeRate,config.fundFeeRate,feeOnInput);const spot=amount.mul(y).div(x);return {referenceNotional:size,quoteSymbol:unit,baseInputRaw:amount.toString(),quoteOutputRaw:r.outputAmount.toString(),impactIncludingFeesPct:pct(spot.sub(r.outputAmount).toString(),spot.toString())};});
  const maxClaim=pct(lp.supply,pool.lpAmount.toString());
  const flags=[{id:'protocol_upgrade_scope',severity:'information',detail:'Raydium CPMM current LP redemption rules verified; program upgrade authority and LP-lock program custody are separate evidence.'}];if(pool.status&4)flags.push({id:'selling_disabled',severity:'critical',detail:'Raydium CPMM swaps are currently disabled.'});if(maxClaim>20)flags.push({id:'outstanding_lp_withdrawal_upper_bound',severity:'high',detail:'Outstanding LP supply can potentially redeem a material reserve share; program locks may constrain individual holders and are not certified here.'});
  return {evidenceId:createHash('sha256').update(JSON.stringify({slot:raw.response.context.slot,addresses:raw.addresses,accounts:raw.response.value.map(a=>a?.data)})).digest('hex'),version:2,mint,pool:addresses[0],protocol:'raydium_cpmm',decoder:'@raydium-io/raydium-sdk-v2@0.2.87-alpha',observedAt:raw.observedAt,slot:raw.response.context.slot,provider:raw.provider,commitment:'finalized',atomic:true,baseReserveRaw:x.toString(),quoteReserveRaw:y.toString(),baseDecimals:baseInfo.decimals,quoteDecimals:quoteInfo.decimals,mintSupplyRaw:baseInfo.supply,referenceQuotes:quotes,liquidityToMarketCapPct:BigInt(baseInfo.supply)>0n?pct(2n*BigInt(x.toString()),baseInfo.supply):null,valuationDefinition:'Two-sided CPMM liquidity / spot fully diluted valuation in the quote asset.',executableDepth:{verified:true,method:'protocol_state_calculation',transactionSimulation:false},withdrawal:{maxCurrentWithdrawalPct:maxClaim,maxQuoteClaimRaw:y.mul(bn(lp.supply)).div(pool.lpAmount).toString(),outstandingLpRaw:lp.supply,protocolLpDenominatorRaw:pool.lpAmount.toString(),lpHolders:[],currentInstructionRulesOnly:true,adminOrProgramUpgradeRiskAssessed:false},flags,limitations:['Raydium CPMM calculations are not applied to AMM v4, CLMM, stable pools or unrelated architectures.','Token-2022 transfer fees and other unsupported transfer controls require separate quote handling.','LP locks and all-pool inventory are unverified; withdrawal exposure is a conservative upper bound.']};
 }catch{return null;}
}
