import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import time
import base64
import urllib.parse
sys.path.insert(0,str(Path('scripts').resolve()))
variant=sys.argv[1:] == ['--eligible-variant']
assert not sys.argv[1:] or variant
script='scripts/collect-eligible-transfer-witness.py' if variant else 'scripts/collect-fixed-transfer-witness.py'
spec=importlib.util.spec_from_file_location('collector',script)
loaded=importlib.util.module_from_spec(spec);spec.loader.exec_module(loaded)
m=loaded.collector if variant else loaded
URL='https://solana-mainnet.g.alchemy.com/v2/SYNTHETIC_ONLY'
checks=0
def check(fn):
    global checks
    fn();checks+=1
fixture={'jsonrpc':'2.0','id':1,'result':{'slot':m.SLOT,'version':0,'transaction':{'signatures':[m.SIGNATURE],'message':{'header':{'numRequiredSignatures':1,'numReadonlySignedAccounts':0,'numReadonlyUnsignedAccounts':0},'recentBlockhash':'11111111111111111111111111111111','accountKeys':[m.MINT,'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'],'instructions':[{'programIdIndex':1,'accounts':[0,0,0,0],'data':'hAi4NanWfhtQd'}]}},'meta':{'err':None,'innerInstructions':[],'preTokenBalances':[],'postTokenBalances':[{'accountIndex':0,'mint':m.MINT,'uiTokenAmount':{'amount':'22632179539','decimals':6}}],'loadedAddresses':{'writable':[],'readonly':[]}}}}
class Response(io.BytesIO):
    def __init__(self,raw,status=200,length=None):
        super().__init__(raw);self.status=status;self.headers={} if length is None else {'Content-Length':str(length)}
    def getcode(self):return self.status

def run(raw=None,mutate=None,status=200,length=None,fail=None):
    data=copy.deepcopy(fixture)
    if mutate:mutate(data)
    if raw is None:raw=json.dumps(data).encode()
    calls=[]
    with tempfile.TemporaryDirectory() as t:
        path=Path(t)/'capture'
        def transport(req,timeout):
            calls.append(1)
            assert req.full_url==URL and req.method=='POST' and timeout==30
            assert json.loads(req.data)==m.REQUEST
            assert json.loads((path/'receipt.json').read_text())['status']=='DISPATCH_INTENT'
            if fail:raise fail
            return Response(raw,status,length)
        out=m.collect(URL,path,opener=transport)
        assert len(calls)==1 and out['attempts']==1 and out['retries']==0
        assert URL not in json.dumps(out) and 'SYNTHETIC_ONLY' not in json.dumps(out)
        if out['status']=='CAPTURED_REQUIRES_INDEPENDENT_REVIEW':
            assert (path/'response.bin').read_bytes()==raw
            assert (path/'public/projection.json').is_file()
        else:
            assert not (path/'response.bin').exists()
            assert not (path/'public/projection.json').exists()
        assert json.loads((path/'receipt.json').read_text())==out
        assert (path/'receipt.json').stat().st_mode & 0o777 == 0o600
        return out

def valid():
    o=run();assert o['status']=='CAPTURED_REQUIRES_INDEPENDENT_REVIEW';assert o['observation']['settlementVerified'] is False
check(valid)
def rejects(**kw):assert run(**kw)['status']=='STOP_RECONCILE_NO_RETRY'
check(lambda:rejects(raw=b'{"result": [truncated'))
check(lambda:rejects(mutate=lambda x:x.update(error={'message':'SYNTHETIC_ONLY'})))
check(lambda:rejects(mutate=lambda x:x['result'].update(slot=m.SLOT+1)))
check(lambda:rejects(mutate=lambda x:x['result']['transaction'].update(signatures=['foreign'])))
check(lambda:rejects(mutate=lambda x:x['result'].update(version=1)))
check(lambda:rejects(mutate=lambda x:x['result']['meta'].pop('postTokenBalances')))
check(lambda:rejects(status=401))
check(lambda:rejects(length=9999))
check(lambda:rejects(fail=TimeoutError(URL)))
check(lambda:rejects(fail=KeyboardInterrupt(URL)))
def oversized():
    old=m.MAX_BYTES;m.MAX_BYTES=16
    try:rejects(raw=b'x'*17)
    finally:m.MAX_BYTES=old
check(oversized)
def closed():
    with tempfile.TemporaryDirectory() as t:
        p=Path(t)/'out'
        for bad in ['http://solana-mainnet.g.alchemy.com/v2/x',URL+'?key=x',URL+'/extra','https://foreign/v2/x',None]:
            assert m.collect(bad,p,opener=lambda *a,**k:(_ for _ in ()).throw(AssertionError()))['attempts']==0
            assert not p.exists()
        p.mkdir()
        try:m.collect(URL,p,opener=lambda *a,**k:(_ for _ in ()).throw(AssertionError()))
        except FileExistsError:pass
        else:raise AssertionError()
    try:m.NoRedirect().redirect_request(None,None,302,'',{},'https://foreign')
    except m.Invalid:pass
    else:raise AssertionError()
check(closed)
def disabled():
    p=subprocess.run([sys.executable,script],capture_output=True,text=True)
    assert p.returncode==0 and json.loads(p.stdout)=={'status':'DISABLED','attempts':0} and not p.stderr
check(disabled)
def deadline():
    with tempfile.TemporaryDirectory() as t:
        old=m.DEADLINE_SECONDS;m.DEADLINE_SECONDS=0.02;calls=[]
        def stalled(req,timeout):
            calls.append(1);time.sleep(0.2);raise AssertionError()
        try:
            o=m.collect(URL,Path(t)/'out',opener=stalled)
            assert o['status']=='STOP_RECONCILE_NO_RETRY' and calls==[1]
        finally:m.DEADLINE_SECONDS=old
check(deadline)
check(lambda:rejects(raw=b'{"jsonrpc":"2.0","id":1,"id":1,"result":null}'))
check(lambda:rejects(mutate=lambda x:x['result']['meta'].update(err={'InstructionError':[0,'Custom']})))
def leaks():
    key='SYNTHETIC_ONLY'
    variants=[key,URL,urllib.parse.quote(URL,safe=''),base64.b64encode(key.encode()).decode(),key.encode().hex(),''.join('%%%02x'%c for c in key.encode())]
    for value in variants:
        rejects(mutate=lambda x:x['result']['meta'].update(logMessages=[value]))
    raw=json.dumps(fixture).replace('"result":', '"extra":"'+''.join('\\u%04x'%ord(c) for c in key)+'","result":').encode()
    rejects(raw=raw)
check(leaks)
def invalid_structure():
    mutations=[lambda x:x['result']['transaction']['message']['instructions'][0].update(programIdIndex=True),
      lambda x:x['result']['transaction']['message']['instructions'][0].update(accounts=[999]),
      lambda x:x['result']['transaction']['message']['instructions'][0].update(data='0'),
      lambda x:x['result']['transaction']['message'].update(accountKeys=['short']),
      lambda x:x['result']['meta']['postTokenBalances'][0]['uiTokenAmount'].update(amount=True),
      lambda x:x['result']['meta']['postTokenBalances'][0]['uiTokenAmount'].update(amount='18446744073709551616'),
      lambda x:x['result']['meta']['postTokenBalances'][0]['uiTokenAmount'].update(decimals=True)]
    for mutation in mutations:rejects(mutate=mutation)
check(invalid_structure)
def staging_escape():
    with tempfile.TemporaryDirectory() as t:
        root=Path(t);outside=root/'outside';outside.mkdir();marker=outside/'projection.json';marker.write_text('KEEP')
        path=root/'capture'
        def transport(req,timeout):
            (path/'public').symlink_to(outside,target_is_directory=True)
            return Response(json.dumps(fixture).encode())
        o=m.collect(URL,path,opener=transport)
        assert o['status']=='STOP_RECONCILE_NO_RETRY' and marker.read_text()=='KEEP'
        assert not (path/'public').exists()
check(staging_escape)
def projection_excludes_text():
    with tempfile.TemporaryDirectory() as t:
        data=copy.deepcopy(fixture);data['result']['meta']['logMessages']=['UNTRUSTED_FREE_FORM_LOG'];data['extra']='https://arbitrary.invalid'
        path=Path(t)/'capture';raw=json.dumps(data).encode()
        o=m.collect(URL,path,opener=lambda *a,**k:Response(raw))
        assert o['status']=='CAPTURED_REQUIRES_INDEPENDENT_REVIEW'
        projected=(path/'public/projection.json').read_bytes();manifest=json.loads((path/'public/manifest.json').read_text())
        assert b'UNTRUSTED' not in projected and b'arbitrary.invalid' not in projected
        assert manifest['originalResponseSha256']!=manifest['projectionSha256']
        assert manifest['originalResponseIncluded'] is False
check(projection_excludes_text)
print('OFFLINE_COLLECTOR_CHECKS='+str(checks))
