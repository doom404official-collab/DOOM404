import {normalizeTransferFee} from '../../../lib/tokenTransferFeeEvidence.mjs';
import {normalizeMintAuthority} from '../../../lib/mintAuthorityEvidence.mjs';
import {mintAuthorityEvidence} from '../../../lib/mintAuthorityEvidence.mjs';
import {mintBaseObservation} from '../../../lib/mintBaseObservation.mjs';
import {NextResponse} from 'next/server';
import {PublicKey} from '@solana/web3.js';
import {createReliableConnection} from '../../../lib/reliableConnection.js';
import {decodeToken2022BinaryMint} from '../../../lib/token2022BinaryMint.mjs';
import {projectSecurityConfiguration} from '../../../lib/securityConfigurationV2.mjs';
import {withProviderUsage} from '../../../lib/providerUsage.mjs';
export const dynamic='force-dynamic';
async function handle(request){
 const mint=new URL(request.url).searchParams.get('mint')||'';let key;
 try{key=new PublicKey(mint);if(key.toBase58()!==mint)throw Error();}catch{return NextResponse.json({mint,error:'INVALID_MINT'},{status:400});}
 try{
  const c=createReliableConnection({timeoutMs:3000,retries:0,maxResponseBytes:2000000}),r=await c.getParsedAccountInfo(key,'confirmed'),a=r.value,owner=a?.owner?.toBase58();
  if(!a||a.executable!==false||!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(owner))return NextResponse.json({mint,error:'NOT_A_SUPPORTED_TOKEN_MINT'},{status:422});
  const token2022=owner.startsWith('Tokenz'),decoded=Buffer.isBuffer(a.data)?(token2022?decodeToken2022BinaryMint(a,mint,{allowUnknownExtensions:true}):null):a;
  const i=decoded?.data?.parsed?.type==='mint'?decoded.data.parsed.info:Buffer.isBuffer(a.data)&&(token2022||a.data.length===82)?mintBaseObservation(a):null;
  if(!i||i.isInitialized!==true||!/^(0|[1-9][0-9]{0,19})$/.test(i.supply||'')||BigInt(i.supply)>18446744073709551615n||!Number.isInteger(i.decimals)||i.decimals<0||i.decimals>255)return NextResponse.json({mint,error:'MINT_CONFIGURATION_UNSUPPORTED'},{status:422});
  const observedAt=new Date().toISOString(),program=token2022?'spl-token-2022':'spl-token';
  const base={mint,tokenProgram:program,...mintAuthorityEvidence(i,{parsed:true}),supplyRaw:i.supply,rawSupply:i.supply,decimals:i.decimals,supply:Number(i.supply)/10**i.decimals,observedAt,contextSlot:r.context.slot,inspectionMode:'current',verificationMethod:'current_onchain_mint'};
  const configuration=token2022?projectSecurityConfiguration(i,{slot:r.context.slot}):null;
  const feeEntry=i.extensions?.find(x=>(x.extension||x.type)==='transferFeeConfig'),feePresent=!!feeEntry,feeState=feeEntry?.state;
  const authority=normalizeMintAuthority(feeState?.transferFeeConfigAuthority),olderFee=normalizeTransferFee(feeState?.olderTransferFee),newerFee=normalizeTransferFee(feeState?.newerTransferFee);
  const transferFee=feePresent?{status:'observed',configAuthorityReported:authority!==undefined,configAuthority:authority??null,olderFee,newerFee,
   effectiveFee:olderFee&&newerFee&&olderFee.basisPoints===newerFee.basisPoints?{basisPoints:olderFee.basisPoints,percentage:olderFee.percentage,resolution:'identical_stored_percentage_schedules',maximumFeeStatus:'not_resolved_for_transaction'}:null}:{status:'not_observed'};
  return NextResponse.json({...base,currentExtensions:token2022&&configuration?{mint,verified:true,observedAt,configuration,extensionCount:i.extensions.length,extensions:i.extensions.map(x=>({type:x.extension||x.type,label:x.extension||x.type,observed:true})),transferFee}:null},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({mint,error:'CURRENT_MINT_UNAVAILABLE'},{status:503});}
}
export async function GET(request){return withProviderUsage(handle,request);}
