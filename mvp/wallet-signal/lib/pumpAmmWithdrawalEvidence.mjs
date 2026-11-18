// Pump AMM IDL withdraw requires user signer, LP token input, and user LP token account.
// This is a protocol capability, not proof that any particular holder can withdraw.
export function assessPumpAmmWithdrawalRights({lpMintEvidence,lpHolderEvidence}={}) {
 const mintValid=lpMintEvidence?.mintAccountVerified===true;
 const holdersVerified=lpHolderEvidence?.inventoryComplete===true;
 return {
  protocol:"pump_amm",
  withdrawalInstructionAvailable:true,
  withdrawalRequiresUserSignature:true,
  withdrawalRequiresLpTokens:true,
  lpMintValidated:mintValid,
  lpHolderInventoryComplete:holdersVerified,
  verifiedWithdrawableLpAmount:null,
  verifiedLockedLpAmount:null,
  verifiedBurnedLpAmount:null,
  lpCustodyVerified:false,
  withdrawalRightsVerified:false,
  lpSecurityPoints:null,
  limitation:"LP holders, custody controls, burns, locks, and actual redemption rights require independent evidence."
 };
}
