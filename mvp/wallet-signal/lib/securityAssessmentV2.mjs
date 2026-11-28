import {validSecurityConfiguration} from './securityConfigurationV2.mjs';
import {normalizeMintAuthority} from './mintAuthorityEvidence.mjs';
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
const round=x=>Math.round(x*100)/100;
/** Three distinct consequences: dilution, seizure, and exit friction. Freeze,
 * hooks, pausing and fees share one maximum-risk component to avoid double counting. */
export function assessSecurityV2({tokenProgram,authoritiesParsed,mintAuthority,freezeAuthority,extensions,now=Date.now()}={}){
 const supported=['spl-token','spl-token-2022','token-2022'].includes(tokenProgram),spl=tokenProgram==='spl-token';
 const at=Date.parse(extensions?.observedAt),fresh=Number.isFinite(at)&&at<=now&&now-at<=3600000;
 const c=!spl&&extensions?.verified===true&&fresh&&validSecurityConfiguration(extensions.configuration)?extensions.configuration:null;
 const p=c?.permissions||{},flags=[],missing=[],parts=[];
 const flag=(id,detail,severity='critical')=>flags.push({id,severity,detail});
 const part=(id,max,risk,complete)=>{parts.push({id,max,riskPoints:risk===null?0:round(risk),points:risk===null?null:round(max-risk),complete});if(!complete)missing.push(id);};
 const ma=normalizeMintAuthority(c?c.mintAuthority:mintAuthority),fa=normalizeMintAuthority(c?c.freezeAuthority:freezeAuthority),parsed=supported&&authoritiesParsed===true;
 const known=!!(spl&&parsed||c&&c.unknownExtensions.length===0);
 part('supply_dilution',30,parsed&&ma!==undefined?(ma===null?0:30):null,parsed&&ma!==undefined);
 if(parsed&&ma)flag('mint_authority_active','Additional supply can be issued; this does not establish malicious intent.','high');
 if(parsed&&fa)flag('freeze_authority_active','Token accounts can be frozen; this does not establish malicious intent.','high');
 part('holder_asset_seizure',35,p.delegate?35:known?0:null,!!p.delegate||known);
 if(p.delegate)flag('permanent_delegate','Delegate can transfer or burn holder tokens without their approval.');
 const restriction=!!(p.nonTransferable===true||p.defaultFrozen===true||p.hook?.programId||p.hook?.authority||p.pause?.paused===true||p.pause?.authority);
 if(restriction)flag('transfer_restrictions','Mint configuration restricts transfers or retains authority to change transfer behavior.');
 if(c?.unknownExtensions?.length)flag('unsupported_extensions','Unsupported mint extensions: '+c.unknownExtensions.join(', '));
 if(supported&&!spl&&!c)flag('unverified_extensions','Token-2022 extension configuration is unavailable or malformed; privileged controls cannot be excluded.');
 if(!supported)flag('unsupported_program','Token program configuration is unsupported.');
 const fee=extensions?.transferFee,authority=normalizeMintAuthority(fee?.configAuthority),rate=fee?.effectiveFee?.percentage;
 let feeRisk=spl&&parsed||known&&fee?.status==='not_observed'?0:null;
 if(c&&fee?.status==='observed'&&fee.configAuthorityReported===true&&authority!==undefined){
  feeRisk=authority!==null?1:finite(rate)?rate===0?0:rate<=1?0.2:rate<=3?0.52:rate<=5?0.8:1:null;
  if(authority)flag('mutable_transfer_fee','Active Token-2022 fee configuration authority can change both basis points (protocol ceiling 100%) and the raw per-transfer maximum fee. Current fee '+(finite(rate)?rate+'%':'unresolved')+' is not a ceiling on future fees. Changes use the program epoch schedule; no malicious intent is established.','critical');
  if(finite(rate)&&rate>0)flag('transfer_fee','Observed configured fee rate: '+rate+'%; amount-dependent caps may reduce it.','high');
 }
 const exitRestricted=parsed&&!!fa||restriction||feeRisk===1;
 const exitKnown=exitRestricted||known&&feeRisk!==null;
 part('transfer_and_fee_friction',35,exitRestricted?35:exitKnown?35*feeRisk:null,exitKnown);
 const riskScore=round(parts.reduce((n,c)=>n+c.riskPoints,0)),coveragePct=parts.reduce((n,c)=>n+(c.complete?c.max:0),0),earned=round(parts.reduce((n,c)=>n+(c.points??0),0));
 return {version:'2.0',attribute:'token_security',riskScore,score:earned,earnedPoints:earned,coveragePct,complete:coveragePct===100,calibrated:coveragePct===100&&supported&&(!c||c.unknownExtensions.length===0),calibrationVersion:'SECURITY_PERMISSION_POLICY_V2_20261126',methodologyValidated:true,components:parts,flags,missing,
  scope:'Observed mint-control risk, not fraud probability. Unknown criteria earn no safety points. Account-specific freezes and actual transfer execution remain separate.'};
}
