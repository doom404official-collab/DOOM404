import {canonicalQuote} from './riskCalibrationV1.mjs';
import {validSecurityConfiguration} from './securityConfigurationV2.mjs';
export function assessmentDisplay(assessment,selected){
 const attribute=assessment.scores[selected];
 const coverage=attribute?attribute.coveragePct:assessment.coveragePct;
 const assessed=coverage>0&&(!!attribute||coverage>=60&&assessment.scores.token_security.coveragePct>=65);
 return {assessed,coverage,score:assessed?(attribute?attribute.riskScore:assessment.riskScore):null,label:coverage===0?'Not assessed':assessed?null:'Insufficient evidence'};
}
export const holderSampleLabel=n=>!Number.isSafeInteger(n)?'Wallet sample not established':n<20?'Sampled '+n+' wallets':'Top-20 wallets';
/** Display-only formatting. No score calculation, evidence promotion or network access. */
export function formatMetric(value,suffix=''){
 return typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:value>0&&value<0.01?6:2})+suffix:'Not assessed';
}
export function formatTokenQuantity(raw,decimals,compact=true){
 if(typeof raw!=='string'||!/^\d+$/.test(raw)||!Number.isInteger(decimals)||decimals<0||decimals>255)return 'Not assessed';
 const n=BigInt(raw),base=10n**BigInt(decimals),whole=n/base,fraction=(n%base).toString().padStart(decimals,'0').replace(/0+$/,'');
 if(!compact)return whole.toLocaleString('en-US')+(fraction?'.'+fraction:'');
 for(const [threshold,suffix] of [[1000000000n,'B'],[1000000n,'M'],[1000n,'K']])if(whole>=threshold){const scaled=n*100n/(base*threshold);return formatMetric(Number(scaled)/100)+suffix;}
 return whole.toLocaleString('en-US')+(fraction?'.'+fraction.slice(0,6)+(fraction.length>6?'…':''):'');
}
export function exitQuoteValue(q){return canonicalQuote(q).value;}

export function protocolName(id){return ({pump_amm:'PumpSwap',pump_swap:'PumpSwap',alchemy_executable_routes:'Underlying protocol unresolved (routed quote)','spl-token-2022':'Solana Token-2022','token-2022':'Solana Token-2022','spl-token':'Solana Token Program',raydium_amm:'Raydium AMM',raydium_cpmm:'Raydium CPMM',raydium_clmm:'Raydium CLMM',orca_whirlpool:'Orca Whirlpools'})[id]||(['PumpSwap','Raydium','Orca','Raydium AMM','Raydium CPMM','Raydium CLMM','Orca Whirlpools'].includes(id)?id:'Unidentified program');}
export function chartMaximum(values){const max=Math.max(0,...values.filter(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0));if(max===0)return 1;const unit=10**Math.floor(Math.log10(max));return Math.ceil(max/unit/0.25)*unit*0.25;}
export function securityControls(a,result,extensions){
 const flags=new Set((a.flags||[]).map(f=>f.id)),known=id=>a.components?.find(c=>c.id===id)?.complete===true;
 const parsed=result?.authorityDetailsStatus==='available'&&['spl-token','spl-token-2022','token-2022'].includes(result?.tokenProgram);
 const same=extensions?.mint&&extensions.mint===result?.mint;
 const at=Date.parse(extensions?.observedAt),fresh=Number.isFinite(at)&&at<=Date.now()&&Date.now()-at<=3600000;
 const c=same&&extensions.verified===true&&fresh&&validSecurityConfiguration(extensions.configuration)?extensions.configuration:null;
 const authority=(v,active,absent)=>v===null?absent:typeof v==='string'&&v.length?active:'Unresolved';
 const freeze=c?c.freezeAuthority:result?.freezeAuthority;
 const other=c?.permissions;
 return [
 {label:'Mint authority',status:known('supply_dilution')?(flags.has('mint_authority_active')?'Active':'Revoked'):'Unresolved',active:flags.has('mint_authority_active')},
 {label:'Delegate / seizure controls',status:flags.has('permanent_delegate')?'Permanent delegate active':known('holder_asset_seizure')?'No seizure control observed':'Unresolved',active:flags.has('permanent_delegate')},
 {label:'Freeze authority',status:parsed?authority(freeze,'Active','Revoked'):'Unresolved',active:flags.has('freeze_authority_active')},
 {label:'Transfer restrictions',status:flags.has('transfer_restrictions')?'Restriction / control observed':flags.has('freeze_authority_active')?'Freeze control active':known('transfer_and_fee_friction')&&known('holder_asset_seizure')?'No scored restriction observed':'Unresolved',active:flags.has('transfer_restrictions')||flags.has('freeze_authority_active')},
 {label:'Transfer fees',status:flags.has('mutable_transfer_fee')?'Mutable fee authority active':c&&typeof a.metrics.configuredFeePct==='number'?formatMetric(a.metrics.configuredFeePct,'% configured'):result?.tokenProgram==='spl-token'&&parsed||c&&extensions?.transferFee?.status==='not_observed'&&known('holder_asset_seizure')?'No additional fee observed':'Unresolved',active:flags.has('mutable_transfer_fee')||flags.has('transfer_fee')},
 {label:'Other privileged controls',status:other?[other.closeAuthority&&'Mint close authority',other.confidentialAuthority&&'Confidential transfer authority',other.confidentialFeeAuthority&&'Confidential fee authority',c.unknownExtensions?.length&&'Unsupported extensions'].filter(Boolean).join(' · ')||'None in supported configuration':result?.tokenProgram==='spl-token'&&parsed?'No extension controls supported':'Unresolved',active:!!(other?.closeAuthority||other?.confidentialAuthority||other?.confidentialFeeAuthority||flags.has('unsupported_extensions'))}
 ];
}
