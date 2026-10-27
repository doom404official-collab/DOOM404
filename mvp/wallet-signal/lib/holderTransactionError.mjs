// Recognized Solana serde error forms only. Unknown variants stay unverified.
// https://github.com/anza-xyz/solana-sdk/blob/master/transaction-error/src/lib.rs
// https://github.com/anza-xyz/solana-sdk/blob/master/instruction-error/src/lib.rs
const transactionUnits=new Set(`AccountInUse AccountLoadedTwice AccountNotFound ProgramAccountNotFound InsufficientFundsForFee InvalidAccountForFee AlreadyProcessed BlockhashNotFound CallChainTooDeep MissingSignatureForFee InvalidAccountIndex SignatureFailure InvalidProgramForExecution SanitizeFailure ClusterMaintenance AccountBorrowOutstanding WouldExceedMaxBlockCostLimit UnsupportedVersion InvalidWritableAccount WouldExceedMaxAccountCostLimit WouldExceedAccountDataBlockLimit TooManyAccountLocks AddressLookupTableNotFound InvalidAddressLookupTableOwner InvalidAddressLookupTableData InvalidAddressLookupTableIndex InvalidRentPayingAccount WouldExceedMaxVoteCostLimit WouldExceedAccountDataTotalLimit MaxLoadedAccountsDataSizeExceeded InvalidLoadedAccountsDataSizeLimit ResanitizationNeeded UnbalancedTransaction ProgramCacheHitMaxLimit CommitCancelled BailOut`.split(' '));
const instructionUnits=new Set(`GenericError InvalidArgument InvalidInstructionData InvalidAccountData AccountDataTooSmall InsufficientFunds IncorrectProgramId MissingRequiredSignature AccountAlreadyInitialized UninitializedAccount UnbalancedInstruction ModifiedProgramId ExternalAccountLamportSpend ExternalAccountDataModified ReadonlyLamportChange ReadonlyDataModified DuplicateAccountIndex ExecutableModified RentEpochModified NotEnoughAccountKeys AccountDataSizeChanged AccountNotExecutable AccountBorrowFailed AccountBorrowOutstanding DuplicateAccountOutOfSync InvalidError ExecutableDataModified ExecutableLamportChange ExecutableAccountNotRentExempt UnsupportedProgramId CallDepth MissingAccount ReentrancyNotAllowed MaxSeedLengthExceeded InvalidSeeds InvalidRealloc ComputationalBudgetExceeded PrivilegeEscalation ProgramEnvironmentSetupFailure ProgramFailedToComplete ProgramFailedToCompile Immutable IncorrectAuthority AccountNotRentExempt InvalidAccountOwner ArithmeticOverflow UnsupportedSysvar IllegalOwner MaxAccountsDataAllocationsExceeded MaxInstructionTraceLengthExceeded BuiltinProgramsMustConsumeComputeUnits`.split(' '));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uint=(x,max)=>Number.isInteger(x)&&x>=0&&x<=max;
function instructionError(error){
 if(typeof error==='string')return instructionUnits.has(error);
 if(!object(error)||Object.keys(error).length!==1)return false;
 if(Object.hasOwn(error,'Custom'))return uint(error.Custom,4294967295);
 return Object.hasOwn(error,'BorshIoError')&&typeof error.BorshIoError==='string';
}
export function isRecognizedHolderTransactionError(error){
 if(typeof error==='string')return transactionUnits.has(error);
 if(!object(error)||Object.keys(error).length!==1)return false;
 if(Object.hasOwn(error,'InstructionError')){
  const pair=error.InstructionError;
  return Array.isArray(pair)&&pair.length===2&&uint(pair[0],255)&&instructionError(pair[1]);
 }
 if(Object.hasOwn(error,'DuplicateInstruction'))return uint(error.DuplicateInstruction,255);
 for(const name of ['InsufficientFundsForRent','ProgramExecutionTemporarilyRestricted']){
  if(Object.hasOwn(error,name)){const value=error[name];return object(value)&&Object.keys(value).length===1&&Object.hasOwn(value,'account_index')&&uint(value.account_index,255);}
 }
 return false;
}
