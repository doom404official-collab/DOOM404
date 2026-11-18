import {isDeepStrictEqual} from 'node:util';
/** Preserve retained rows and conflicts verbatim. Assessment, not merge order,
 * decides eligibility. Only exact incoming duplicates are omitted on resume. */
export function mergeCreatorAcquisitionEvidence(retained,incoming){
 if(!Array.isArray(retained)||!Array.isArray(incoming))throw Error('INVALID_CREATOR_ACQUISITION_EVIDENCE');
 const merged=structuredClone(retained);
 for(const event of incoming)if(!merged.some(existing=>isDeepStrictEqual(existing,event)))merged.push(structuredClone(event));
 return merged;
}
