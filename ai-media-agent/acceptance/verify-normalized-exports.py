import json,subprocess,concurrent.futures
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Independently compare encoded-packet and fully decoded VP8/Opus hashes for normalization candidates. Run normalize-export-candidates.js --input-dir first.')
parser.add_argument('--report',type=Path,default=Path(__file__).resolve().parent/'webm-normalization-validation.json')
args=parser.parse_args()
p=args.report;data=json.loads(p.read_text())
def cmd(args):
 r=subprocess.run(args,capture_output=True,text=True,timeout=180);return {'returnCode':r.returncode,'stdout':r.stdout.strip(),'stderr':r.stderr.strip()}
def check(row):
 r=dict(row);r['independentFfprobe']={}
 for key,path in [('original',r['originalFile']),('normalized',r['normalizedFile'])]:
  q=cmd(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',path]);r['independentFfprobe'][key]=json.loads(q['stdout'])
 r['independentEncodedPacketHashes']={};r['independentDecodedMediaHashes']={}
 for key,path in [('original',r['originalFile']),('normalized',r['normalizedFile'])]:
  q=cmd(['ffprobe','-v','error','-show_packets','-show_entries','packet=stream_index,data_hash','-show_data_hash','sha256','-of','json',path]);r['independentEncodedPacketHashes'][key]=json.loads(q['stdout'])['packets']
  for kind,mapping,codec in [('video','0:v:0','rawvideo'),('audio','0:a:0','pcm_s16le')]:
   args=['ffmpeg','-hide_banner','-v','error','-xerror','-threads','1','-i',path,'-map',mapping]
   if kind=='video':args+=['-fps_mode','passthrough','-enc_time_base','demux','-pix_fmt','yuv420p','-c:v',codec]
   else:args+=['-c:a',codec]
   args+=['-f','hash','-hash','sha256','-']
   r['independentDecodedMediaHashes'][key+'_'+kind]=cmd(args)
 checks={'independent_encoded_packet_hashes_identical':r['independentEncodedPacketHashes']['original']==r['independentEncodedPacketHashes']['normalized'],'video_decoded_pixels_identical':r['independentDecodedMediaHashes']['original_video']['stdout']==r['independentDecodedMediaHashes']['normalized_video']['stdout'],'audio_decoded_pcm_identical':r['independentDecodedMediaHashes']['original_audio']['stdout']==r['independentDecodedMediaHashes']['normalized_audio']['stdout'],'all_decodes_return_zero':all(v['returnCode']==0 for v in r['independentDecodedMediaHashes'].values()),'normalized_decode_no_errors':all(not v['stderr'] for k,v in r['independentDecodedMediaHashes'].items()if k.startswith('normalized')),'normalized_duration_under_0_2s_from_narration':abs(float(r['independentFfprobe']['normalized']['format']['duration'])-r['expectedNarrationDurationSeconds'])<.2}
 # Packet hashes are exact compared above; retain compact independent count/digest.
 import hashlib
 r['independentEncodedPacketHashes']={k:{'packets':len(v),'sha256':hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()}for k,v in r['independentEncodedPacketHashes'].items()};r['independentChecks']=checks;r['status']='PASS'if all(checks.values())else'FAIL';print(r['name'],r['status'],checks,flush=True);return r
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:data['files']=list(pool.map(check,data['files']))
data['status']='PASS_DECODE_AND_PAYLOAD_CHECKS_VISUAL_BOUNDARY_CHECKS_PENDING'if all(r['status']=='PASS'for r in data['files'])else'FAIL'
p.write_text(json.dumps(data,indent=2)+'\n')
