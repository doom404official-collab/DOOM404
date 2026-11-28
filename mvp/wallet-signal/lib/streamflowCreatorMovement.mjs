import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import bs58 from 'bs58';
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',STREAM='strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m',SYSTEM='11111111111111111111111111111111',COMPUTE='ComputeBudget111111111111111111111111111111';
export const STREAMFLOW_MOVEMENT_SOURCE=Object.freeze({repository:'streamflow-finance/rust-sdk',commit:'63df7d7b831340daa27f31d007eec2a98380364c',path:'programs/streamflow-sdk/src/lib.rs',scope:'Create account layout and instruction; state.rs find_escrow_account PDA seeds'});
const u=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Selection is investigative only: no escrow/creator/lock inference. */
export function selectMaterialSelfAuthority({mint,supplyRaw,accounts,verifiedInfrastructure=new Set()}){
 if(!u(supplyRaw)||BigInt(supplyRaw)===0n)return null;
 return accounts.filter(r=>{try{const a=r.account,i=a?.data?.parsed?.info;return !verifiedInfrastructure.has(r.pubkey)&&a.executable===false&&a.owner===TOKEN&&a.data.parsed.type==='account'&&i.mint===mint&&i.owner===r.pubkey&&!PublicKey.isOnCurve(new PublicKey(r.pubkey).toBuffer())&&i.state==='initialized'&&u(i.tokenAmount?.amount)&&BigInt(i.tokenAmount.amount)<=BigInt(supplyRaw)&&BigInt(i.tokenAmount.amount)*100n>=BigInt(supplyRaw)*5n;}catch{return false;}}).sort((a,b)=>BigInt(a.account.data.parsed.info.tokenAmount.amount)>BigInt(b.account.data.parsed.info.tokenAmount.amount)?-1:1)[0]||null;
}
export async function recoverMaterialAccountGenesis({candidate,mint,read,now=Date.now}){
 if(!candidate)return {transactions:[],requests:0,status:'no_material_candidate'};
 try{const p=await read('getTransactionsForAddress',[candidate.pubkey,{transactionDetails:'full',sortOrder:'asc',limit:1,commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:1,filters:{status:'succeeded'}}]);
 if(!Array.isArray(p?.data)||p.data.length>1)throw Error();
 const transactions=p.data.filter(tx=>tx.meta?.err===null&&Number.isSafeInteger(tx.slot)&&Number.isSafeInteger(tx.blockTime)&&tx.blockTime>=0&&tx.blockTime<=Math.floor(now()/1000)&&tx.transaction?.message?.accountKeys.some(k=>(typeof k==='string'?k:k.pubkey)===mint)&&tx.transaction.message.accountKeys.some(k=>(typeof k==='string'?k:k.pubkey)===candidate.pubkey));
 return {transactions,requests:1,status:transactions.length?'bounded_material_account_genesis_recovered':'no_matching_complete_transaction',historyComplete:false};
 }catch{return{transactions:[],requests:1,status:'material_account_index_unavailable',historyComplete:false};}
}
/** Separate narrow proof producer. Does not relax the existing Token2022 outer-transfer guard.
 * Streamflow create discriminator + escrow PDA + SPL lifecycle/balance proof.
 * Schedule and unrestricted ownership are deliberately outside this proof. */
export function verifyStreamflowCreatorEscrowTransfer({mint,creator,transaction:tx}){
 const fail=reason=>({verified:false,reason,event:null});
 try{
 if(!['legacy',0,1].includes(tx.version)||tx.meta.err!==null||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime))return fail('invalid_transaction');
 const msg=tx.transaction.message,keys=msg.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),sig=tx.transaction.signatures[0];
 if(!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(sig??'')||tx.blockTime<0)return fail('invalid_transaction_identity');
 if(!msg.accountKeys.some(k=>k.pubkey===creator&&k.signer===true)||msg.instructions.length!==2||msg.instructions[0].programId!==COMPUTE)return fail('unsupported_context');
 const ix=msg.instructions[1],a=ix.accounts;
 if(ix.programId!==STREAM||a.length!==18||a[0]!==creator||a[2]!==creator||a[5]!==a[1]||a[11]!==mint||a[14]!==STREAM||a[15]!==TOKEN||a[16]!=='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'||a[13]!=='SysvarRent111111111111111111111111111111111'||a[17]!==SYSTEM||!Buffer.from(bs58.decode(ix.data)).subarray(0,8).equals(createHash('sha256').update('global:create').digest().subarray(0,8)))return fail('unsupported_create_layout');
 const escrow=PublicKey.findProgramAddressSync([Buffer.from('strm'),new PublicKey(a[3]).toBuffer()],new PublicKey(STREAM))[0].toBase58();if(escrow!==a[4])return fail('escrow_pda_mismatch');
 const groups=tx.meta.innerInstructions;if(groups.length!==1||groups[0].index!==1||groups[0].instructions.length!==5)return fail('unsupported_cpi_context');
 const ins=groups[0].instructions;
 if(ins.some(i=>![SYSTEM,TOKEN].includes(i.programId)))return fail('unsupported_cpi_program');
 const meta=ins[0],birth=ins[2],init=ins[3],move=ins[4],info=move.parsed?.info;
 if(meta.programId!==SYSTEM||meta.parsed?.type!=='createAccount'||meta.parsed.info.newAccount!==a[3]||meta.parsed.info.owner!==STREAM||meta.parsed.info.space!==1104||meta.parsed.info.source!==creator||ins[1].programId!==SYSTEM||ins[1].parsed?.type!=='transfer'||ins[1].parsed.info.source!==creator||ins[1].parsed.info.destination!==a[3]||birth.programId!==SYSTEM||birth.parsed?.type!=='createAccount'||birth.parsed.info.newAccount!==escrow||birth.parsed.info.owner!==TOKEN||birth.parsed.info.space!==165||birth.parsed.info.source!==creator||init.programId!==TOKEN||init.parsed?.type!=='initializeAccount'||init.parsed.info.account!==escrow||init.parsed.info.owner!==escrow||init.parsed.info.mint!==mint||move.programId!==TOKEN||move.parsed?.type!=='transferChecked'||info.authority!==creator||info.source!==a[1]||info.destination!==escrow||info.mint!==mint||!u(info.tokenAmount?.amount)||BigInt(info.tokenAmount.amount)===0n)return fail('escrow_lifecycle_unverified');
 const before=tx.meta.preTokenBalances.filter(b=>b.mint===mint&&b.owner===creator),after=tx.meta.postTokenBalances.filter(b=>b.mint===mint&&b.owner===creator),dest=tx.meta.postTokenBalances.filter(b=>keys[b.accountIndex]===escrow);
 if(before.length!==1||after.length!==1||dest.length!==1||tx.meta.preTokenBalances.some(b=>keys[b.accountIndex]===escrow))return fail('ambiguous_balances');
 const b=before[0],c=after[0],d=dest[0],dec=info.tokenAmount.decimals;
 if(!Number.isInteger(dec)||dec<0||dec>255||[b,c,d].some(x=>x.programId!==TOKEN||x.uiTokenAmount.decimals!==dec||!u(x.uiTokenAmount.amount))||keys[b.accountIndex]!==info.source||keys[c.accountIndex]!==info.source||d.mint!==mint||d.owner!==escrow||d.uiTokenAmount.amount!==info.tokenAmount.amount||BigInt(b.uiTokenAmount.amount)-BigInt(c.uiTokenAmount.amount)!==BigInt(info.tokenAmount.amount))return fail('balance_mismatch');
 return{verified:true,source:STREAMFLOW_MOVEMENT_SOURCE,classification:'creator_funded_program_escrow',sourceRawBefore:b.uiTokenAmount.amount,sourceRawAfter:c.uiTokenAmount.amount,escrow,metadata:a[3],saleVerified:false,beneficialOwnershipEstablished:false,releaseConditionsVerified:false,historyComplete:false,event:{signature:sig,instructionIndex:1,innerInstructionIndex:4,mint,creator,type:'EXTERNAL_TRANSFER_OUT',timestamp:tx.blockTime,amountRaw:info.tokenAmount.amount,independentlyVerified:true,instructionVerified:true}};
 }catch{return fail('malformed_transaction');}
}
