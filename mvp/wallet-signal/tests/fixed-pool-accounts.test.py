"""Synthetic offline checks only; no provider data or real credential input."""
import importlib.util
import io
import json
import base64
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
spec=importlib.util.spec_from_file_location('pool',Path(__file__).resolve().parents[1]/'scripts/collect-fixed-pool-accounts.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
from fixed_transfer_projection import ProjectionRejected
ENDPOINT='https://solana-mainnet.g.alchemy.com/v2/SYNTHETIC_ONLY_KEY_42'
def fixture():
 p=bytearray(243);p[:8]=bytes([241,154,109,4,17,177,109,188])
 for o,k in ((43,m.MINT),(75,m.QUOTE),(107,m.ADDRESSES[3]),(139,m.ADDRESSES[1]),(171,m.ADDRESSES[2])):p[o:o+32]=m.base58(k,size=32)
 arrays=[p]
 for mint,n in ((m.MINT,166),(m.QUOTE,165)):
  b=bytearray(n);b[:32]=m.base58(mint,size=32);b[32:64]=m.base58(m.ADDRESSES[0],size=32);b[108]=1
  if n==166:b[165]=2
  arrays.append(b)
 lp=bytearray(82);lp[45]=1;arrays.append(lp)
 return {'jsonrpc':'2.0','id':1,'result':{'context':{'slot':470000000},'value':[{'owner':o,'executable':False,'data':[base64.b64encode(b).decode(),'base64'],'space':len(b)} for o,b in zip((m.POOL_PROGRAM,m.TOKEN2022,m.CLASSIC,m.CLASSIC),arrays)]}}
def raw(obj):return json.dumps(obj).encode()
class Response(io.BytesIO):
 def __init__(self,b,status=200,length=None):super().__init__(b);self.status=status;self.headers={'Content-Length':str(len(b) if length is None else length)}
 def getcode(self):return self.status
class Checks(unittest.TestCase):
 def capture(self,b,status=200,length=None):
  with tempfile.TemporaryDirectory() as d:
   calls=[]
   def transport(req,timeout):calls.append(json.loads(req.data));return Response(b,status,length)
   out=Path(d)/'capture';result=m.collect(ENDPOINT,out,transport)
   self.assertEqual(calls,[m.REQUEST]);self.assertEqual(result['attempts'],1)
   return result, (out/'public/projection.json').read_bytes() if (out/'public/projection.json').exists() else None, (out/'response.bin').exists()
 def test_success_allowlist(self):
  r,p,_=self.capture(raw(fixture()));self.assertEqual(r['status'],'CAPTURED_REQUIRES_INDEPENDENT_REVIEW')
  j=json.loads(p);self.assertFalse(j['accountBytesIncluded']);self.assertEqual(len(j['accounts']),4);self.assertNotIn('dataBase64',p.decode());self.assertEqual(r['nominalCU'],20)
 def test_identity_and_schema(self):
  changes=[lambda j:j.update(id=True),lambda j:j['result']['context'].update(slot=True),lambda j:j['result']['value'].pop(),lambda j:j['result']['value'].__setitem__(0,None),lambda j:j['result']['value'][0].update(executable=True),lambda j:j['result']['value'][0].update(owner=m.CLASSIC),lambda j:j.update(error={'message':ENDPOINT}),lambda j:j['result']['value'][3].update(space=83)]
  for change in changes:
   j=fixture();change(j)
   with self.subTest(change=changes.index(change)):
    r,p,exists=self.capture(raw(j));self.assertEqual(r['status'],'STOP_RECONCILE_NO_RETRY');self.assertIsNone(p);self.assertFalse(exists);self.assertNotIn(ENDPOINT,json.dumps(r))
 def test_layout_and_mapping(self):
  for account,offset,value,suffix in ((0,43,1,b''),(0,0,0,b''),(1,165,1,b''),(1,108,2,b''),(3,45,0,b'')):
   j=fixture();v=j['result']['value'][account];b=bytearray(base64.b64decode(v['data'][0]));b[offset]=value;b+=suffix;v.update(data=[base64.b64encode(b).decode(),'base64'],space=len(b))
   r,p,_=self.capture(raw(j));self.assertEqual(r['status'],'STOP_RECONCILE_NO_RETRY');self.assertIsNone(p)
 def test_partial_error_and_limits(self):
  for b,status,length in ((raw(fixture())[:-1],200,None),(b'error '+ENDPOINT.encode(),503,None),(raw(fixture()),200,1),(b'x'*(m.MAX_BYTES+1),200,None)):
   r,p,exists=self.capture(b,status,length);self.assertEqual(r['status'],'STOP_RECONCILE_NO_RETRY');self.assertIsNone(p);self.assertFalse(exists)
 def test_base_and_extended_subset(self):
  for owner,length in ((m.TOKEN2022,165),(m.TOKEN2022,166),(m.TOKEN2022,170),(m.TOKEN2022,210)):
   j=fixture();v=j['result']['value'][1];b=bytearray(base64.b64decode(v['data'][0])[:165]);
   if length>165:b+=bytes([2])+b'Q'*(length-166)
   v.update(data=[base64.b64encode(b).decode(),'base64'],space=len(b),owner=owner)
   pool=j['result']['value'][0];pb=base64.b64decode(pool['data'][0])+b'uninterpreted suffix';pool.update(data=[base64.b64encode(pb).decode(),'base64'],space=len(pb))
   r,p,_=self.capture(raw(j));self.assertEqual(r['status'],'CAPTURED_REQUIRES_INDEPENDENT_REVIEW')
   out=json.loads(p);self.assertFalse(out['completeAccountSemanticsVerified']);self.assertFalse(out['accounts'][1]['extensionSemanticsVerified']);self.assertNotIn('uninterpreted suffix',p.decode())
 def test_lp_token2022_core_and_invalid_types(self):
  for length in (82,166,200):
   j=fixture();v=j['result']['value'][3];b=bytearray(base64.b64decode(v['data'][0]));
   if length>82:b+=bytes(83)+bytes([1])+b'Q'*(length-166)
   v.update(data=[base64.b64encode(b).decode(),'base64'],space=len(b),owner=m.TOKEN2022)
   self.assertEqual(self.capture(raw(j))[0]['status'],'CAPTURED_REQUIRES_INDEPENDENT_REVIEW')
  for account,length,tag in ((1,355,2),(1,166,1),(3,355,1),(3,166,2),(3,100,0)):
   j=fixture();v=j['result']['value'][account];b=bytearray(base64.b64decode(v['data'][0]));b=b[:length]+bytes(max(0,length-len(b)))
   if length>165:b[165]=tag
   v.update(data=[base64.b64encode(b).decode(),'base64'],space=len(b),owner=m.TOKEN2022)
   self.assertEqual(self.capture(raw(j))[0]['status'],'STOP_RECONCILE_NO_RETRY')
 def test_leak_variants_in_decoded_bytes(self):
  # All payloads are in omitted pool suffix: core schema MUST pass first.
  secret=ENDPOINT.rsplit('/',1)[1].encode()
  variants=(secret,ENDPOINT.encode(),base64.b64encode(secret),base64.urlsafe_b64encode(ENDPOINT.encode()),secret.hex().encode(),ENDPOINT.encode().hex().upper().encode(),''.join('%%%02X'%c for c in secret).encode())
  for leak in variants:
   j=fixture();v=j['result']['value'][0];b=base64.b64decode(v['data'][0])+b'|'+leak+b'|';v.update(data=[base64.b64encode(b).decode(),'base64'],space=len(b))
   obj,slot,accounts,binary=m.decode(raw(j));self.assertEqual(slot,470000000)
   with self.assertRaises((ProjectionRejected,m.Invalid)):m.leakage_gate(raw(j),obj,ENDPOINT,binary)
   with self.assertRaises((ProjectionRejected,m.Invalid)):m.leakage_gate(b'{}',{},ENDPOINT,binary)
   r,p,exists=self.capture(raw(j));self.assertEqual(r['status'],'STOP_RECONCILE_NO_RETRY');self.assertIsNone(p);self.assertFalse(exists)
 def test_leak_json_escapes_and_serialized_fields(self):
  j=fixture();j['extra']=ENDPOINT
  encoded=raw(j).replace(ENDPOINT.encode(),''.join('\\u%04x'%ord(c) for c in ENDPOINT).encode())
  obj,_,_,binary=m.decode(encoded)
  with self.assertRaises((ProjectionRejected,m.Invalid)):m.leakage_gate(encoded,obj,ENDPOINT,binary)
  # Direct field check isolates the post-projection gate from raw-body scanning.
  with self.assertRaises((ProjectionRejected,m.Invalid)):m.leakage_gate(b'{}',{'untrusted':ENDPOINT},ENDPOINT,[])
 def test_timeout_redacted_no_retry(self):
  with tempfile.TemporaryDirectory() as d:
   calls=[]
   def fail(*a,**k):calls.append(1);raise TimeoutError(ENDPOINT)
   r=m.collect(ENDPOINT,Path(d)/'out',fail);self.assertEqual(len(calls),1);self.assertEqual(r['status'],'STOP_RECONCILE_NO_RETRY');self.assertNotIn(ENDPOINT,json.dumps(r))
 def test_redirect_rejected(self):
  with self.assertRaises(m.Invalid):m.NoRedirect().redirect_request(None,None,302,'',{},ENDPOINT)
 def test_configuration_zero_calls(self):
  self.assertEqual(m.collect('http://wrong.invalid','unused',lambda *a: self.fail()),{'status':'REJECTED_CONFIGURATION','attempts':0})
 def test_workflow_inactive(self):
  p=Path(__file__).resolve().parents[1]/'docs/proposals/fixed-pool-accounts-workflow.yml';s=p.read_text()
  for v in ('workflow_dispatch:','default: false','GITHUB_RUN_ATTEMPT','reviewed_sha','retention-days: 1','persist-credentials: false','collect-fixed-pool-accounts.py'):self.assertIn(v,s)
  self.assertNotIn('always()',s);self.assertNotIn('schedule:',s)
  active=Path(__file__).resolve().parents[3]/'.github/workflows/glitch-holder-h06-pump-operation.yml'
  self.assertEqual(active.read_text(),s.split('\n',1)[1])
  self.assertNotIn('push:',active.read_text());self.assertNotIn('pull_request:',active.read_text())
if __name__=='__main__':unittest.main()
