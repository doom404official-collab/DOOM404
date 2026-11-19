import {groupPumpFunSellInnerInstructions} from './pumpFunSellInnerInstructionGroups.mjs';
/** Decode parsed SPL token transfers only inside matching Pump.fun sell inner groups.
 * A transfer candidate alone does not prove pool settlement.
 */
export function observePumpFunSellTokenTransfers({transaction}={}){
 const groups=groupPumpFunSellInnerInstructions({transaction});
 return groups.map(group=>({
  outerInstructionIndex:group.outerInstructionIndex,
  soldRaw:group.soldRaw,
  transfers:group.innerInstructions.filter(ix=>
   ['spl-token','spl-token-2022'].includes(ix?.program)&&
   ['transfer','transferChecked'].includes(ix?.parsed?.type))
   .map(ix=>({source:ix.parsed.info?.source||null,
    destination:ix.parsed.info?.destination||null,
    mint:ix.parsed.info?.mint||null,
    amountRaw:String(ix.parsed.info?.tokenAmount?.amount??ix.parsed.info?.amount??''),
    verified:false})),
  settlementVerified:false
 }));
}
