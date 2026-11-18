import unittest,importlib.util,sys,json,base64,tempfile,io,copy,signal,os,time,urllib.error
from unittest.mock import patch
from pathlib import Path
S=Path(__file__).resolve().parents[1]/'scripts'
sys.path.insert(0,str(S))
spec=importlib.util.spec_from_file_location('inv',S/'collect-lp-inventory.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
EP='https://solana-mainnet.g.alchemy.com/v2/SYNTHETIC_SECRET_42'
KEY=m.core.ADDRESSES[1]
def value(b):return {'owner':m.PROGRAM,'executable':False,'data':[base64.b64encode(b).decode(),'base64'],'space':len(b)}
def token():
 b=bytearray(165);b[:32]=m.core.base58(m.MINT,size=32);b[32:64]=m.core.base58(KEY,size=32);b[64:72]=(5).to_bytes(8,'little');b[108]=1;return b
def mint():
 b=bytearray(82);b[:4]=(1).to_bytes(4,'little');b[4:36]=m.core.base58(m.core.ADDRESSES[0],size=32);b[36:44]=(5).to_bytes(8,'little');b[44:46]=bytes([9,1]);return b
def env(i,rows,slot=10):return json.dumps({'jsonrpc':'2.0','id':i,'result':{'context':{'slot':slot},'value':rows}}).encode()
def first():return env(1,[{'pubkey':KEY,'account':value(token())}])
def second():return env(2,[value(token()),value(mint())])
class Response(io.BytesIO):
 def __init__(self,b,status=200):super().__init__(b);self.headers={'Content-Length':str(len(b))};self.status=status
 def getcode(self):return self.status
class Checks(unittest.TestCase):
 def run_capture(self,responses):
  calls=[]
  def open_(req,timeout):
   calls.append(json.loads(req.data));r=responses[len(calls)-1]
   if isinstance(r,Exception):raise r
   return Response(r)
  with tempfile.TemporaryDirectory() as d:
   r=m.collect(EP,Path(d)/'capture',open_)
   public=Path(d)/'capture/public/projection.json'
   out=json.loads(public.read_bytes()) if public.exists() else None
  return r,calls,out
 def test_success_and_exact_bounds(self):
  r,c,o=self.run_capture([first(),second()]);self.assertEqual(r['attempts'],2);self.assertFalse(o['custodyVerified']);self.assertTrue(o['observedBalancesEqualMintSupply']);self.assertEqual(o['accounts'][0]['address'],KEY);self.assertNotIn('dataSize',json.dumps(c));self.assertEqual(c[1]['params'][0],[KEY,m.MINT]);self.assertEqual(c[1]['params'][1]['minContextSlot'],10)
 def test_bad_discovery_never_second(self):
  cases=[b'{',env(1,[{'pubkey':KEY,'account':value(token())}]*2),env(1,[] ,True),env(1,[{}]*100),b'{"jsonrpc":"2.0","id":1,"error":{}}',b' '* (m.MAX_BYTES+1)]
  for raw in cases:
   r,c,o=self.run_capture([raw]);self.assertEqual(len(c),1);self.assertIsNone(o)
 def test_account_rejections(self):
  for mutate in [lambda v:v.update(owner=m.core.CLASSIC),lambda v:v.update(executable=True),lambda v:v.update(space=True),lambda v:v.update(data=['!','base64'])]:
   v=value(token());mutate(v)
   with self.assertRaises(Exception):m.account(v)
  for offset,val in [(0,1),(108,0),(72,2),(109,1)]:
   b=token();b[offset]=val
   with self.assertRaises(Exception):m.account(value(b))
 def test_extensions(self):
  m.account(value(token()+bytes([2,7,0,0,0])))
  for suffix in [bytes([1]),bytes([2,8,0,0,0]),bytes([2,7,0,1,0,0]),bytes([2])+bytes(189)]:
   with self.assertRaises(Exception):m.account(value(token()+suffix))
 def test_second_failures_no_retry(self):
  for raw in [env(2,[value(token()),value(mint())],9),env(2,[None,value(mint())]),env(2,[]),b'{',RuntimeError(EP)]:
   r,c,o=self.run_capture([first(),raw]);self.assertEqual(len(c),2);self.assertIsNone(o);self.assertNotIn(EP,json.dumps(r))
 def test_transport_failures(self):
  r,c,o=self.run_capture([TimeoutError(EP)]);self.assertEqual(len(c),1);self.assertIsNone(o)
 def test_leaks_schema_valid_before_gate(self):
  ep='https://solana-mainnet.g.alchemy.com/v2/DEMO_ONLY'
  for secret in [b'DEMO_ONLY',base64.b64encode(b'DEMO_ONLY'),b'DEMO_ONLY'.hex().encode(),b'%44%45%4d%4f%5f%4f%4e%4c%59']:
   b=token();b[76:76+min(len(secret),32)]=secret[:32]
   m.account(value(b))
   raw=env(1,[{'pubkey':KEY,'account':value(b)}])
   with self.assertRaises(Exception):m.discovery(raw,ep)
 def test_endpoint_leak(self):
  obj=json.loads(first());obj['unused']=EP
  m.envelope(json.dumps(obj).encode(),1)
  with self.assertRaises(Exception):m.discovery(json.dumps(obj).encode(),EP)
 def test_zero_inventory_not_complete(self):
  z=mint();z[36:44]=bytes(8)
  r,c,o=self.run_capture([env(1,[]),env(2,[value(z)])]);self.assertEqual(len(c),2);self.assertFalse(o['inventoryCompletenessVerified'])
 def test_bool_id_duplicate_json(self):
  for b in [b'{"id":1,"id":1}',env(True,[])]:
   with self.assertRaises(Exception):m.envelope(b,1)

 def test_exact_requests(self):
  r,c,o=self.run_capture([first(),second()])
  self.assertEqual(c,[{'jsonrpc':'2.0','id':1,'method':'getProgramAccounts','params':[m.PROGRAM,{'commitment':'finalized','encoding':'base64','withContext':True,'filters':[{'memcmp':{'offset':0,'bytes':m.MINT}}]}]}, {'jsonrpc':'2.0','id':2,'method':'getMultipleAccounts','params':[[KEY,m.MINT],{'commitment':'finalized','encoding':'base64','minContextSlot':10}]}])
  self.assertEqual(r['attempts'],2)
 def test_99_100_boundary(self):
  keys=[m.key(i.to_bytes(32,'big')) for i in range(1,101)]
  for n in (99,100):
   rows=[{'pubkey':k,'account':value(token())} for k in keys[:n]]
   lp=mint();lp[36:44]=(5*n).to_bytes(8,'little')
   r,c,o=self.run_capture([env(1,rows),env(2,[value(token()) for _ in range(n)]+[value(lp)])])
   self.assertEqual(len(c),2 if n==99 else 1)
   if n==99:self.assertEqual(len(c[1]['params'][0]),100)
 def test_typed_fields_inactive_garbage_omitted(self):
  b=token();b[76:108]=bytes([77])*32;b[121:129]=(123).to_bytes(8,'little');b[133:165]=bytes([88])*32
  out=json.loads(m.observation(env(2,[value(b),value(mint())]),EP,10,[KEY],'a'*64,len(first())))
  row=out['accounts'][0];self.assertNotIn('delegate',row);self.assertNotIn('closeAuthority',row)
  b[72:76]=(1).to_bytes(4,'little');b[129:133]=(1).to_bytes(4,'little')
  out=json.loads(m.observation(env(2,[value(b),value(mint())]),EP,10,[KEY],'a'*64,len(first())))
  self.assertEqual(out['accounts'][0]['delegate'],{'authority':m.key(bytes([77])*32),'delegatedAmountRaw':'123'})
  self.assertEqual(out['accounts'][0]['closeAuthority'],m.key(bytes([88])*32))
  self.assertEqual(out['mintAccount']['supplyRaw'],'5')
 def test_equal_and_advancing_slots_never_complete(self):
  for slot in (10,11):
   o=json.loads(m.observation(env(2,[value(token()),value(mint())],slot),EP,10,[KEY],'a'*64,len(first())))
   for name in ('inventoryCompletenessVerified','crossSlotMembershipVerified','custodyVerified','scorePromoted'):self.assertIs(o[name],False)
 def test_mint_layout_failures(self):
  cases=[]
  for offset,val in [(0,0),(4,1),(44,8),(45,0),(46,1)]:
   b=mint();b[offset]=val;cases.append(b)
  cases.extend([mint()+bytes(84),mint()[:-1]])
  for b in cases:
   r,c,o=self.run_capture([first(),env(2,[value(token()),value(b)])]);self.assertEqual(len(c),2);self.assertIsNone(o)
 def transport_case(self,response):
  calls=[]
  def op(req,timeout):calls.append(req);return response
  with tempfile.TemporaryDirectory() as d:
   r=m.collect(EP,Path(d)/'cap',op)
   self.assertFalse((Path(d)/'cap/public/projection.json').exists())
  self.assertEqual(len(calls),1);self.assertEqual(r['status'],'STOP_RECONCILE_NO_RETRY');self.assertTrue(response.closed)
 def test_http_error_status(self):self.transport_case(Response(first(),503))
 def test_content_length_mismatch(self):
  r=Response(first());r.headers['Content-Length']='1';self.transport_case(r)
 def test_short_non_eof_read(self):
  class Short(Response):
   def read(self,n=-1):return super().read(min(n,10))
  self.transport_case(Short(first()))
 def test_short_eof_claimed_length(self):
  r=Response(first()[:-1]);r.headers['Content-Length']=str(len(first()));self.transport_case(r)
 def test_redirect_rejection(self):
  with self.assertRaises(Exception):m.core.NoRedirect().redirect_request(None,None,302,'',{},'https://example.invalid')
 def test_alarm_installed_invoked_and_restored(self):
  old=signal.getsignal(signal.SIGALRM);timers=[];calls=[]
  def op(req,timeout):
   calls.append(req);self.assertEqual(timeout,30)
   time.sleep(0.1) # real SIGALRM must interrupt this blocked synthetic transport
   self.fail('deadline did not interrupt')
  real=signal.setitimer
  def timer(which,value,*args):timers.append(value);return real(which,0.01 if value==30 else value,*args)
  with tempfile.TemporaryDirectory() as d,patch.object(signal,'setitimer',side_effect=timer):
   r=m.collect(EP,Path(d)/'cap',op)
  self.assertEqual(len(calls),1);self.assertIn(30,timers);self.assertEqual(timers[-1],0);self.assertEqual(signal.getsignal(signal.SIGALRM),old);self.assertEqual(signal.getitimer(signal.ITIMER_REAL)[0],0)
 def test_projection_failure_no_artifact(self):
  with patch.object(m,'observation',side_effect=RuntimeError(EP)):
   r,c,o=self.run_capture([first(),second()]);self.assertEqual(len(c),2);self.assertIsNone(o)
 def test_projected_fields_go_through_leak_gate(self):
  real=m.core.leakage_gate;seen=[]
  def gate(raw,obj,endpoint,binary):
   seen.append(obj)
   if obj.get('schema')=='LP_INVENTORY_TYPED_V1':
    self.assertEqual(obj['accounts'][0]['amountRaw'],'5');self.assertEqual(obj['accounts'][0]['ownerAuthority'],KEY)
    raise m.core.Invalid('SYNTHETIC_PROJECTION_REJECTION')
   return real(raw,obj,endpoint,binary)
  with patch.object(m.core,'leakage_gate',side_effect=gate):
   r,c,o=self.run_capture([first(),second()]);self.assertIsNone(o)
  self.assertTrue(any(x.get('schema')=='LP_INVENTORY_TYPED_V1' for x in seen))

 def test_http_exception(self):
  r,c,o=self.run_capture([urllib.error.HTTPError(EP,403,'private text',{},None)])
  self.assertEqual(len(c),1);self.assertIsNone(o);self.assertNotIn(EP,json.dumps(r))
 def test_body_deadline_closes_response(self):
  class Slow(Response):
   def read(self,n=-1):time.sleep(0.1);return super().read(n)
  real=signal.setitimer
  def timer(which,value,*args):return real(which,0.01 if value==30 else value,*args)
  with patch.object(signal,'setitimer',side_effect=timer):self.transport_case(Slow(first()))
  self.assertEqual(signal.getitimer(signal.ITIMER_REAL)[0],0)

 def test_inactive_workflow_contract(self):
  w=(S.parent/'docs/proposals/lp-inventory-workflow.yml').read_text()
  for text in ["on:\n  workflow_dispatch:","GITHUB_RUN_ATTEMPT']=='1'","GITHUB_SHA']==os.environ['REVIEWED_SHA']","GITHUB_REF']=='refs/heads/integration/glitch-app-main-20261118'",'default: false','contents: read','persist-credentials: false','retention-days: 1','scripts/collect-lp-inventory.py --approved-once','lp-inventory-private/public/projection.json','lp-inventory-private/public/manifest.json','actions/checkout@11d5960a326750d5838078e36cf38b85af677262','actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02']:
   self.assertIn(text,w)
  for text in ['always()','push:','pull_request:','schedule:','id-token:','response.bin']:
   self.assertNotIn(text,w)
if __name__=='__main__':unittest.main()
