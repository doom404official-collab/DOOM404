import {locatePumpFunSellInstructions} from './pumpFunSellInstructionLink.mjs';
/** Associate inner instructions with the exact Pump.fun sell outer instruction index.
 * Grouping does not prove payment or token movement.
 */
export function groupPumpFunSellInnerInstructions({transaction}={}){
 const sells=locatePumpFunSellInstructions({transaction});
 const groups=transaction?.meta?.innerInstructions||[];
 return sells.map(sell=>{
  const group=groups.find(x=>x.index===sell.outerInstructionIndex);
  return {outerInstructionIndex:sell.outerInstructionIndex,soldRaw:sell.soldRaw,
   innerInstructions:Array.isArray(group?.instructions)?group.instructions:[],
   instructionGroupFound:Boolean(group),settlementVerified:false};
 });
}
