#!/usr/bin/env python3
"""Check all six rendered scene transitions against the common normalized packet clock.
Run normalize-export-candidates.js with --input-dir to regenerate file paths first.
Requires the raw-boundary observations retained in video-timing-diagnostics.json.
No speech transcription or uploaded audio is used.
"""
import argparse,concurrent.futures,importlib.util,json
from pathlib import Path
from PIL import ImageChops,ImageStat
base=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--report',type=Path,default=base/'webm-normalization-validation.json');args=parser.parse_args()
spec=importlib.util.spec_from_file_location('exports_inspector',base/'inspect-exports.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
report=json.loads(args.report.read_text())
def check(row):
    original=Path(row['originalFile']);normalized=Path(row['normalizedFile']);manifest=json.loads(original.with_name(row['name']+'-manifest.json').read_text());scenes=manifest['captionTimeline'];canonical=[m.frame(normalized,(s['startSeconds']+s['endSeconds'])/2+.12).crop((25,90,505,150))for s in scenes]
    def state(t):
        image=m.frame(normalized,t).crop((25,90,505,150));errors=[sum(ImageStat.Stat(ImageChops.difference(image,c)).mean)/3 for c in canonical];return min(range(7),key=lambda i:errors[i])
    observations=[]
    for b in row['mappedBoundaries']:
        target=b['normalizedVisualBoundarySeconds'];expected=b['scene']-1;before=state(max(0,target-.08));after=state(target+.03)
        observations.append({'scene':b['scene'],'mappedOriginalVisualBoundarySeconds':target,'mappedAudioPacketBoundarySeconds':b['normalizedEstimatedAudioBoundarySeconds'],'visualMinusAudioClockSeconds':target-b['normalizedEstimatedAudioBoundarySeconds'],'frameBeforeSeconds':max(0,target-.08),'frameBeforeDetectedScene':before+1,'frameAfterSeconds':target+.03,'frameAfterDetectedScene':after+1,'expectedSceneAfter':expected+1,'pass':before==expected-1 and after==expected and abs(target-b['normalizedEstimatedAudioBoundarySeconds'])<.15})
    row['independentNormalizedVisualBoundaries']={'observations':observations,'sixTransitionsPreserved':len(observations)==6 and all(b['pass']for b in observations),'method':'Header-region differences identify scene identity in actual decoded normalized frames before/after the mapped original transition. Audio clock is the same piecewise packet-duration mapping. No ASR or intelligibility determination.'}
    print(row['name'],row['independentNormalizedVisualBoundaries']['sixTransitionsPreserved'],flush=True)
    return row
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:report['files']=list(pool.map(check,report['files']))
report['status']='PASS_REAL_FILES_PAYLOAD_DECODE_AND_VISUAL_TIMING'if all(r['status']=='PASS'and r['independentNormalizedVisualBoundaries']['sixTransitionsPreserved']for r in report['files'])else'FAIL_VISUAL_TIMING'
args.report.write_text(json.dumps(report,indent=2)+'\n')
