import {verifyDirectNativeSale} from './nativeTradeLamports.mjs';
import {normalizeLegacyPumpTrade} from './pumpLegacyTradeLayout.mjs';
import {readPumpTradeEvent} from './pumpTradeEvent.mjs';
import {PUMP_AMM_SDK,GLOBAL_CONFIG_PDA,PUMP_AMM_FEE_CONFIG_PDA,PUMP_AMM_EVENT_AUTHORITY_PDA,userVolumeAccumulatorPda,PUMP_GLOBAL_PDA,PUMP_EVENT_AUTHORITY_PDA,PUMP_FEE_CONFIG_PDA,bondingCurvePda} from '@pump-fun/pump-swap-sdk';
import {PublicKey} from '@solana/web3.js';
import {decodeInstructionBytes} from './liquidityInstructionBytes.mjs';
const PROGRAM='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const TOKENS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
const CURVE='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const specs=PUMP_AMM_SDK.offlineProgram.idl.instructions.filter(x=>['sellV2','buyV2','buyExactQuoteInV2'].includes(x.name)).map(x=>({...x,program:PROGRAM,accountCount:17,indices:null}));
// Official pump-public-docs/idl/pump.json: the account contract is protocol
// configuration. No mint, creator or transaction reference is included.
const curveSpecs=[
 ['sellV3','1c92de7726c469d5',17,[5,8,0,1,2,9,10,6,7,3,4,14,11,12,13,15,16]],
 ['sellV2','5df6823ce7e940b2',26,[10,13,0,1,2,14,15,11,12,3,4,23,19,21,9,24,25]],
 ['buyV3','07051dc4f5176550',17,[5,8,0,1,2,9,10,6,7,3,4,14,11,12,13,15,16]],
 ['buyExactQuoteInV3','e1f7501ed5b38488',17,[5,8,0,1,2,9,10,6,7,3,4,14,11,12,13,15,16]],
 ['buyV2','b817ee6167c5d33d',27,[10,13,0,1,2,14,15,11,12,3,4,24,20,22,9,25,26]],
 ['buyExactQuoteInV2','c2ab1c46684d5b2f',27,[10,13,0,1,2,14,15,11,12,3,4,24,20,22,9,25,26]]
].map(([name,hex,accountCount,indices])=>({name,discriminator:[...Buffer.from(hex,'hex')],program:CURVE,accountCount,indices}));
specs.push(...curveSpecs);
/** Verify the target asset's economic boundary, not router log names. Only the
 * pinned PumpSwap V2 and Pump curve V2/V3 account contracts are supported. Other route legs are
 * not called independently verified protocols by this decoder. */
export function inspectRoutedTokenTrade({mint,creator,signature,transaction:tx}={}){
 const result={event:null,status:'unsupported_or_unresolved_route',reason:'supported_target_trade_not_found',historyComplete:false};
 try{
  if(tx?.meta?.err!==null||tx.transaction?.signatures?.[0]!==signature||!['legacy',0,1].includes(tx.version)||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0)return {...result,reason:'invalid_transaction_identity'};
  const message=tx.transaction.message,keys=message.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),outer=message.instructions,groups=tx.meta.innerInstructions;
  if(!message.accountKeys.some(k=>k.pubkey===creator&&k.signer===true)||!Array.isArray(groups)||new Set(groups.map(g=>g.index)).size!==groups.length)return {...result,reason:'creator_signer_or_instruction_context_missing'};
  const flat=[];
  for(let i=0;i<outer.length;i++){
   flat.push({ix:outer[i],outer:i,inner:null});
   const group=groups.find(g=>g.index===i);
   for(let j=0;j<(group?.instructions.length||0);j++)flat.push({ix:group.instructions[j],outer:i,inner:j});
  }
  const row=(name,address)=>{const rows=tx.meta[name].filter(b=>keys[b.accountIndex]===address);if(rows.length>1)throw Error('duplicate_balance_identity');const b=rows[0];if(b&&(!TOKENS.has(b.programId)||!uint(b.uiTokenAmount?.amount)||(!Number.isSafeInteger(b.uiTokenAmount.decimals)||b.uiTokenAmount.decimals<0||b.uiTokenAmount.decimals>255)))throw Error('invalid_raw_balance');return b;};
  const owners=address=>{const pre=row('preTokenBalances',address),post=row('postTokenBalances',address);if(pre&&post&&(pre.owner!==post.owner||pre.mint!==post.mint||pre.programId!==post.programId||pre.uiTokenAmount.decimals!==post.uiTokenAmount.decimals))throw Error('mutable_account_identity');if(post||pre)return post||pre;
   const init=flat.filter(t=>TOKENS.has(t.ix.programId)&&['initializeAccount','initializeAccount2','initializeAccount3'].includes(t.ix.parsed?.type)&&t.ix.parsed.info?.account===address);
   if(init.length!==1||flat.some(t=>t.ix.parsed?.type==='setAuthority'&&t.ix.parsed.info?.account===address))return null;
   const i=init[0].ix,p=i.parsed.info,decimals=new Set([...tx.meta.preTokenBalances,...tx.meta.postTokenBalances].filter(b=>b.mint===p.mint&&b.programId===i.programId).map(b=>b.uiTokenAmount?.decimals));
   if(decimals.size===0&&p.mint==='So11111111111111111111111111111111111111112'&&i.programId==='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')decimals.add(9);
   if(decimals.size!==1)return null;const n=[...decimals][0];if(!Number.isInteger(n)||n<0||n>255)return null;
   return {mint:p.mint,owner:p.owner,programId:i.programId,uiTokenAmount:{amount:'0',decimals:n},identityBasis:'explicit_token_account_initialization'};
  };
  const delta=name=>{const seen=new Set();return tx.meta[name].filter(b=>b.mint===mint&&b.owner===creator).reduce((n,b)=>{if(seen.has(b.accountIndex)||!TOKENS.has(b.programId)||!uint(b.uiTokenAmount?.amount))throw Error('invalid_creator_balances');seen.add(b.accountIndex);owners(keys[b.accountIndex]);return n+BigInt(b.uiTokenAmount.amount);},0n);};
  const net=delta('postTokenBalances')-delta('preTokenBalances');
  if(net===0n)return {...result,status:'no_net_target_trade',reason:'zero_target_boundary_delta_intermediate_movements_excluded'};
  const candidates=flat.map(p=>{if(![PROGRAM,CURVE].includes(p.ix.programId))return null;const bytes=decodeInstructionBytes(p.ix.data);const spec=bytes?specs.find(s=>s.program===p.ix.programId&&bytes.subarray(0,8).equals(Buffer.from(s.discriminator))&&(bytes.length===24||s.program===CURVE&&s.name.startsWith('buy')&&bytes.length===25&&bytes[24]<=1))||normalizeLegacyPumpTrade({program:p.ix.programId,accounts:p.ix.accounts,bytes}):null;const accounts=spec?.normalizedAccounts||(spec?.indices?spec.indices.map(i=>p.ix.accounts?.[i]):p.ix.accounts);return spec?{...p,bytes,spec,accounts}:null;}).filter(p=>p&&p.accounts?.[3]===mint&&p.accounts[1]===creator);
  if(candidates.length!==1)return {...result,reason:'ambiguous_or_unsupported_target_trade_count'};
  const p=candidates[0],a=p.accounts,isCurve=p.spec.program===CURVE,isSale=p.spec.name.startsWith('sell'),baseAmount=p.bytes.readBigUInt64LE(8),limit=p.bytes.readBigUInt64LE(16);
  if(p.ix.accounts.length!==p.spec.accountCount||a.length!==17||a[2]!==(isCurve?PUMP_GLOBAL_PDA:GLOBAL_CONFIG_PDA).toBase58()||a[13]!==(isCurve?PUMP_FEE_CONFIG_PDA:PUMP_AMM_FEE_CONFIG_PDA).toBase58()||a[15]!==(isCurve?PUMP_EVENT_AUTHORITY_PDA:PUMP_AMM_EVENT_AUTHORITY_PDA).toBase58()||a[16]!==p.spec.program||a[11]!=='11111111111111111111111111111111'||a[12]!==(isCurve?PublicKey.findProgramAddressSync([Buffer.from('user_volume_accumulator'),new PublicKey(creator).toBuffer()],new PublicKey(CURVE))[0]:userVolumeAccumulatorPda(new PublicKey(creator))).toBase58()||isCurve&&a[0]!==bondingCurvePda(new PublicKey(mint)).toBase58()||!TOKENS.has(a[9])||!TOKENS.has(a[10])||a[3]===a[4])return {...result,reason:'protocol_layout_or_pda_mismatch'};
  const nativeQuote=isCurve&&a[4]==='So11111111111111111111111111111111111111112'&&a[10]==='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const userBase=owners(a[5]),userQuote=nativeQuote?null:owners(a[6]),poolBase=owners(a[7]),poolQuote=nativeQuote?null:owners(a[8]);
  for(const [b,m,owner,program]of [[userBase,mint,creator,a[9]],[poolBase,mint,a[0],a[9]],...(nativeQuote?[]:[[userQuote,a[4],creator,a[10]],[poolQuote,a[4],a[0],a[10]]])])if(!b||b.mint!==m||b.owner!==owner||b.programId!==program)return {...result,reason:'trade_account_ownership_not_corroborated'};
  const group=groups.find(g=>g.index===p.outer)?.instructions||[],depth=p.inner===null?1:p.ix.stackHeight;
  if(!Number.isInteger(depth)||depth<1)return {...result,reason:'instruction_stack_unavailable'};
  const start=p.inner===null?0:p.inner+1;let end=group.length;
  for(let j=start;j<group.length;j++)if(group[j].stackHeight<=depth){end=j;break;}
  const transfers=group.slice(start,end).map((ix,j)=>({ix,index:start+j})).filter(t=>TOKENS.has(t.ix.programId)&&t.ix.parsed?.type==='transferChecked');
  const base=transfers.filter(t=>t.ix.programId===a[9]&&t.ix.stackHeight===depth+1&&t.ix.parsed.info?.mint===mint&&t.ix.parsed.info.source===(isSale?a[5]:a[7])&&t.ix.parsed.info.destination===(isSale?a[7]:a[5]));
  const quote=transfers.filter(t=>t.ix.programId===a[10]&&t.ix.stackHeight===depth+1&&t.ix.parsed.info?.mint===a[4]&&t.ix.parsed.info.source===(isSale?a[8]:a[6])&&t.ix.parsed.info.destination===(isSale?a[6]:a[8]));
  const nativeFlows=group.slice(start,end).filter(ix=>ix.programId==='11111111111111111111111111111111'&&ix.stackHeight===depth+1&&ix.parsed?.type==='transfer').map(ix=>ix.parsed.info);
  const nativeSettlement=nativeFlows.filter(i=>i.source===(isSale?a[0]:creator)&&i.destination===(isSale?creator:a[0]));
  if(base.length!==1)return {...result,reason:'settlement_transfers_missing_or_ambiguous'};
  const typedSaleEvent=nativeQuote&&isSale&&p.spec.name==='sellV3'?readPumpTradeEvent({instructions:group.slice(start,end),program:CURVE,eventAuthority:a[15],depth,mint,user:creator,amountRaw:base[0].ix.parsed.info.tokenAmount?.amount,isSale,timestamp:tx.blockTime}):null;
  const directNative=nativeQuote&&nativeSettlement.length===0&&typedSaleEvent?verifyDirectNativeSale({tx,flat,keys,creator,event:typedSaleEvent,identity:owners}):null;
  if(nativeQuote?nativeSettlement.length!==1&&!directNative:quote.length!==1)return {...result,reason:'settlement_transfers_missing_or_ambiguous'};
  if(nativeQuote&&nativeFlows.some(i=>!Number.isSafeInteger(i.lamports)||i.lamports<0))return {...result,reason:'invalid_native_quote_amount'};
  const amount=base[0].ix.parsed.info.tokenAmount,paid=nativeQuote?{amount:directNative?.paidRaw??String(nativeSettlement[0].lamports),decimals:9}:quote[0].ix.parsed.info.tokenAmount;
  const quoteDebit=nativeQuote&&!isSale?nativeFlows.filter(i=>i.source===creator).reduce((n,i)=>n+BigInt(i.lamports),0n):BigInt(paid?.amount||'0');
  if(!uint(amount?.amount)||!uint(paid?.amount)||BigInt(amount.amount)===0n||BigInt(paid.amount)===0n||amount.decimals!==userBase.uiTokenAmount.decimals||!nativeQuote&&paid.decimals!==userQuote.uiTokenAmount.decimals||base[0].ix.parsed.info.authority!==(isSale?creator:a[0])||!nativeQuote&&quote[0].ix.parsed.info.authority!==(isSale?a[0]:creator))return {...result,reason:'invalid_settlement_amount_or_authority'};
  const raw=BigInt(amount.amount);
  const nativeEvent=nativeQuote?readPumpTradeEvent({instructions:group.slice(start,end),program:CURVE,eventAuthority:a[15],depth,mint,user:creator,amountRaw:raw.toString(),isSale,timestamp:tx.blockTime}):null;
  const quoteLimitDebit=nativeEvent&&!isSale?BigInt(nativeEvent.solAmountRaw)+BigInt(nativeEvent.protocolFeeRaw)+BigInt(nativeEvent.creatorFeeRaw):quoteDebit;
  if(quoteLimitDebit>quoteDebit)return {...result,reason:'native_event_cost_exceeds_observed_debits'};
  if(net!==(isSale?-raw:raw)||isSale&&BigInt(paid.amount)<limit||/^buyV[123]$/.test(p.spec.name)&&quoteLimitDebit>limit||/^buyExactQuoteInV[123]$/.test(p.spec.name)&&quoteLimitDebit>baseAmount||isSale&&raw!==baseAmount||/^buyV[123]$/.test(p.spec.name)&&raw!==baseAmount||/^buyExactQuoteInV[123]$/.test(p.spec.name)&&raw<limit)return {...result,reason:'target_boundary_does_not_reconcile'};
  const born=(account,owner,asset,program)=>{const index=keys.indexOf(account);return index>=0&&tx.meta.preBalances[index]===0&&flat.filter(t=>t.ix.programId===program&&['initializeAccount','initializeAccount2','initializeAccount3'].includes(t.ix.parsed?.type)&&t.ix.parsed.info?.account===account&&t.ix.parsed.info.owner===owner&&t.ix.parsed.info.mint===asset).length===1&&flat.some(t=>t.ix.programId==='11111111111111111111111111111111'&&t.ix.parsed?.type==='createAccount'&&t.ix.parsed.info.newAccount===account&&t.ix.parsed.info.owner===program);};
  const poolPre=row('preTokenBalances',a[7]),poolPost=row('postTokenBalances',a[7]);
  if(!poolPost||!poolPre&&!born(a[7],a[0],mint,a[9]))return {...result,reason:'pool_base_opening_unverified'};
  if(!row('preTokenBalances',a[5])&&!born(a[5],creator,mint,a[9]))return {...result,reason:'trader_base_opening_unverified'};
  let baseFlow=0n;
  for(const {ix}of flat){if(ix.programId!==a[9])continue;const i=ix.parsed?.info,type=ix.parsed?.type;
   if(type==='transferChecked'&&(i.source===a[7]||i.destination===a[7])){if(i.mint!==mint||!uint(i.tokenAmount?.amount)||i.tokenAmount.decimals!==poolBase.uiTokenAmount.decimals)return {...result,reason:'pool_base_flow_unverified'};baseFlow+=(i.destination===a[7]?1n:-1n)*BigInt(i.tokenAmount.amount);}
   else if(['mintTo','mintToChecked'].includes(type)&&(i.account||i.destination)===a[7]){const amount=i.amount??i.tokenAmount?.amount;if(i.mint!==mint||!uint(amount))return {...result,reason:'pool_mint_receipt_unverified'};baseFlow+=BigInt(amount);}
   else if(['burn','burnChecked'].includes(type)&&i.account===a[7])return {...result,reason:'pool_burn_not_supported_in_trade_window'};
  }
  if(BigInt(poolPost.uiTokenAmount.amount)-BigInt(poolPre?.uiTokenAmount.amount||'0')!==baseFlow)return {...result,reason:'pool_base_delta_does_not_reconcile'};
  if(nativeQuote){
   const index=keys.indexOf(a[0]),before=tx.meta.preBalances[index],after=tx.meta.postBalances[index];if(!Number.isSafeInteger(before)||!Number.isSafeInteger(after))return {...result,reason:'native_curve_balance_unavailable'};
   let flow=0n;for(const {ix}of flat){if(ix.programId!=='11111111111111111111111111111111')continue;const i=ix.parsed?.info;if(ix.parsed?.type==='transfer'&&(i.source===a[0]||i.destination===a[0])){if(!Number.isSafeInteger(i.lamports)||i.lamports<0)return {...result,reason:'invalid_native_curve_flow'};flow+=(i.destination===a[0]?1n:-1n)*BigInt(i.lamports);}else if(ix.parsed?.type==='createAccount'&&i.newAccount===a[0]){if(i.owner!==CURVE||!Number.isSafeInteger(i.lamports)||before!==0)return {...result,reason:'native_curve_birth_unverified'};flow+=BigInt(i.lamports);}}
   let directBuyback=0n;
   if(p.spec.name.endsWith('V3')){
    const event=nativeEvent;
    if(!event)return {...result,reason:'native_curve_trade_event_unverified'};
    directBuyback=BigInt(event.buybackFeeRaw);
    if(directBuyback>0n){
     const recipient=keys.indexOf(a[14]),pre=tx.meta.preBalances[recipient],post=tx.meta.postBalances[recipient];
     if(!Number.isSafeInteger(pre)||!Number.isSafeInteger(post)||a[14]===a[0]||a[14]===creator)return {...result,reason:'native_buyback_recipient_unverified'};
     let explicit=0n;for(const {ix}of flat){const i=ix.parsed?.info;if(ix.programId==='11111111111111111111111111111111'&&ix.parsed?.type==='transfer'&&(i.source===a[14]||i.destination===a[14])){if(!Number.isSafeInteger(i.lamports)||i.lamports<0)return {...result,reason:'invalid_native_buyback_flow'};explicit+=(i.destination===a[14]?1n:-1n)*BigInt(i.lamports);}}
     if(BigInt(post)-BigInt(pre)-explicit!==directBuyback)return {...result,reason:'native_buyback_delta_does_not_reconcile'};
    }
   }
   if(BigInt(after)-BigInt(before)!==flow-directBuyback-(directNative?BigInt(directNative.paidRaw):0n))return {...result,reason:'native_curve_delta_does_not_reconcile'};
  }else{
   const quotePre=row('preTokenBalances',a[8]),quotePost=row('postTokenBalances',a[8]);
   const vaultQuoteFlows=flat.filter(t=>t.ix.programId===a[10]&&t.ix.parsed?.type==='transferChecked').map(t=>t.ix.parsed.info).filter(i=>i.source===a[8]||i.destination===a[8]);
   if(!quotePost||!quotePre&&!born(a[8],a[0],a[4],a[10])||vaultQuoteFlows.some(i=>i.mint!==a[4]||!uint(i.tokenAmount?.amount)||i.tokenAmount.decimals!==poolQuote.uiTokenAmount.decimals))return {...result,reason:'pool_quote_identity_unresolved'};
   const quoteNet=vaultQuoteFlows.reduce((n,i)=>n+(i.destination===a[8]?1n:-1n)*BigInt(i.tokenAmount.amount),0n);
   if(BigInt(quotePost.uiTokenAmount.amount)-BigInt(quotePre?.uiTokenAmount.amount||'0')!==quoteNet)return {...result,reason:'pool_quote_delta_does_not_reconcile'};
  }
  // Any other target movement across creator custody makes this narrow single
  // trade projection incomplete. Fees/refunds cannot be silently double counted.
  const boundary=flat.filter(t=>TOKENS.has(t.ix.programId)&&['transfer','transferChecked','mintTo','mintToChecked','burn','burnChecked'].includes(t.ix.parsed?.type)).filter(t=>{const i=t.ix.parsed.info,s=owners(i.source||i.account),d=owners(i.destination);return (s?.mint===mint&&s.owner===creator)||(d?.mint===mint&&d.owner===creator);});
  if(boundary.length!==1||boundary[0].outer!==p.outer||boundary[0].inner!==base[0].index)return {...result,reason:'additional_target_custody_movements_unresolved'};
  return {...result,status:'verified_target_trade',reason:null,event:{mint,creator,signature,slot:tx.slot,instructionIndex:p.outer,innerInstructionIndex:base[0].index,timestamp:tx.blockTime,type:isSale?'VERIFIED_SALE':'PURCHASE',amountRaw:raw.toString(),independentlyVerified:true,instructionVerified:true,settlementVerified:true,decoderVersion:'pump-trade-cpi-boundary-v3',protocol:isCurve?'pump_fun':'pump_amm',protocolInstruction:p.spec.name,quoteMint:a[4],quoteAmountRaw:paid.amount,quoteDebitIncludingObservedFeesRaw:quoteDebit.toString(),quoteSettlement:nativeQuote?(directNative?'native_sol_direct_program_payout_reconciled':'native_sol_system_transfers'):'verified_quote_token_transfers',sourceTokenAccount:isSale?a[5]:a[7],destinationTokenAccount:isSale?a[7]:a[5],routerProgram:outer[p.outer].programId,targetBoundaryNetRaw:net.toString(),historyComplete:false}};
 }catch(e){return {...result,reason:/^[a-z_]{1,80}$/.test(e.message||'')?e.message:'malformed_or_unsupported_route'};}
}
