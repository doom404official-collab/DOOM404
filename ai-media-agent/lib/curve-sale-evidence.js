'use strict';
const {tradeEvent}=require('./pump-trade-event');
function curveSale(t,c,call,d,mint,seller,signature){
 const {isToken,raw,nativeLedger,WSOL}=require('./sale-reconciliation');
 const a=d.accountRoles,base=a.mint||a.base_mint,user=a.user,source=a.associated_user||a.associated_base_user,vault=a.associated_bonding_curve||a.associated_base_bonding_curve;
 const reject=rejection=>({rejection});
 if(base!==mint)return reject('MINT_MISMATCH');
 if(seller&&user!==seller)return reject('SELLER_MISMATCH');
 if(a.quote_mint&&a.quote_mint!==WSOL)return reject('UNSUPPORTED_CURVE_QUOTE');
 if(!c.msg.accountKeys.some(k=>k.pubkey===user&&k.signer)||!c.owner(source,user,mint)||!c.owner(vault,a.bonding_curve,mint))return reject('CURVE_ACCOUNT_ATTRIBUTION_MISMATCH');
 const transfers=call.inner.filter(x=>x.stackHeight===call.depth+1&&isToken(x)&&['transfer','transferChecked'].includes(x.parsed?.type)&&x.parsed.info.source===source&&x.parsed.info.destination===vault&&x.parsed.info.authority===user&&(!x.parsed.info.mint||x.parsed.info.mint===mint));
 const out=transfers.reduce((n,x)=>n+(raw(x)||0n),0n);
 if(out<=0n||out.toString()!==d.rawInstructionAmount||c.delta(source)!==-out||c.delta(vault)!==out)return reject('CURVE_TOKEN_OUTFLOW_UNRECONCILED');
 const events=call.inner.filter(x=>x.programId===d.program&&x.stackHeight===call.depth+1).map(tradeEvent).filter(Boolean);
 if(events.length!==1)return reject('CURVE_TRADE_EVENT_REQUIRED');const e=events[0];
 if(e.mint!==mint||e.user!==user||e.is_buy!==false||e.ix_name!=='sell'||e.token_amount!==out.toString()||e.fee_recipient!==a.fee_recipient||e.shareholders?.length||e.quote_mint&&e.quote_mint!=='11111111111111111111111111111111')return reject('CURVE_EVENT_ATTRIBUTION_MISMATCH');
 if(['cashback','buyback_fee','holder_rewards'].some(k=>BigInt(e[k]||'0')!==0n))return reject('CURVE_ADDITIONAL_FEE_LAYOUT_UNSUPPORTED');
 const gross=BigInt(e.sol_amount),fee=BigInt(e.fee),creatorFee=BigInt(e.creator_fee),net=gross-fee-creatorFee;
 if(net<=0n||!a.creator_vault)return reject('CURVE_PROCEEDS_INVALID');
 const implicit=[[a.bonding_curve,user,net],[a.bonding_curve,a.fee_recipient,fee],[a.bonding_curve,a.creator_vault,creatorFee]];
 if(!nativeLedger(t,c,implicit))return reject('CURVE_NATIVE_SETTLEMENT_UNRECONCILED');
 return {evidence:{protocol:d.protocol,instruction:d.instruction,seller:user,mint,tokenOutRaw:out.toString(),quoteMint:'NATIVE_SOL',quoteProceedsRaw:net.toString(),grossProceedsRaw:gross.toString(),protocolFeeRaw:fee.toString(),creatorFeeRaw:creatorFee.toString(),outerIndex:call.i,...(call.innerIndex===undefined?{}:{innerIndex:call.innerIndex}),settlement:{type:'CURVE_NATIVE_SOL_SETTLEMENT',nativeBalanceReconciled:true,transactionFeeLamports:String(t.meta.fee)},source:d.source,...(signature?{signature,slot:t.slot,url:'https://solscan.io/tx/'+signature}:{})}};
}
module.exports={curveSale};
