/** Historical launch candidates are not attribution.
 * Candidate mints must be verified against their own creation instructions.
 */
export function collectCreatorLaunchCandidates({creator,observations=[]}={}){
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creator||'')||!Array.isArray(observations))throw Error('INVALID_LAUNCH_DISCOVERY_INPUT');
 const candidates=new Map();
 for(const observation of observations){
  if(!observation||typeof observation.mint!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(observation.mint))continue;
  if(!observation.signature||typeof observation.signature!=='string')continue;
  if(observation.role!=='launchpad_creator'||observation.creator!==creator)continue;
  const key=observation.mint;
  const verified=observation.creationInstructionVerified===true&&typeof observation.decoderVersion==='string'&&observation.decoderVersion.length>0;
  const old=candidates.get(key);
  if(!old||(!old.verified&&verified))candidates.set(key,{mint:key,creator,signature:observation.signature,
   verified,decoderVersion:verified?observation.decoderVersion:null,
   attributionStatus:verified?'CREATION_INSTRUCTION_VERIFIED':'CANDIDATE_UNVERIFIED'});
 }
 return {creator,candidates:[...candidates.values()],verifiedCount:[...candidates.values()].filter(x=>x.verified).length,
  discoveryCoverageComplete:false,noPriorLaunchesVerified:false};
}
