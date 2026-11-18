"""Inactive review proposal. Typed inventory only; never custody certification."""
import importlib.util
import json
import hashlib
import base64
import os
import signal
import sys
import urllib.request
import urllib.error
from pathlib import Path

spec=importlib.util.spec_from_file_location('fixed_pool',Path(__file__).with_name('collect-fixed-pool-accounts.py'))
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
MINT=core.ADDRESSES[3]
MAX_BYTES=1048576
PROGRAM=core.TOKEN2022

def require(ok):
    core.require(ok)

def envelope(raw,expected_id):
    require(len(raw)<=MAX_BYTES)
    obj=json.loads(raw.decode('utf-8'),object_pairs_hook=core.unique_object,
        parse_constant=lambda _: (_ for _ in ()).throw(core.Invalid('NONFINITE')))
    require(type(obj) is dict and obj.get('jsonrpc')=='2.0' and type(obj.get('id')) is int and obj['id']==expected_id and 'error' not in obj)
    r=obj.get('result');require(type(r) is dict)
    c=r.get('context');require(type(c) is dict)
    slot=c.get('slot');require(type(slot) is int and 0<slot<=2**53-1)
    require(type(r.get('value')) is list)
    return obj,slot,r['value']

def account(v,mint=False):
    require(type(v) is dict and v.get('owner')==PROGRAM and v.get('executable') is False)
    d=v.get('data');require(type(d) is list and len(d)==2 and d[1]=='base64' and type(d[0]) is str)
    b=base64.b64decode(d[0],validate=True)
    require(base64.b64encode(b).decode()==d[0] and len(b)<=4096)
    require('space' not in v or type(v['space']) is int and v['space']==len(b))
    if mint:
        # Known base-82 mint only. Changed mint extensions require independent review.
        require(len(b)==82 and b[45]==1 and b[44]==9)
        require(int.from_bytes(b[:4],'little')==1 and b[4:36]==core.base58(core.ADDRESSES[0],size=32))
        require(int.from_bytes(b[46:50],'little')==0)
        return b
    require(len(b)>=165 and len(b)!=355 and b[:32]==core.base58(MINT,size=32) and b[108] in (1,2))
    for o in (72,109,129):require(int.from_bytes(b[o:o+4],'little') in (0,1))
    require(int.from_bytes(b[109:113],'little')==0) # LP must not be native token
    if len(b)>165:
        require(b[165]==2)
        tail=b[166:]
        # Only exact ImmutableOwner TLV, or no TLV, is supported. No opaque suffix.
        require(tail in (b'',b'\x07\x00\x00\x00'))
    return b

def key(b):
    alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    n=int.from_bytes(b,'big');out=''
    while n:n,r=divmod(n,58);out=alphabet[r]+out
    return '1'*(len(b)-len(b.lstrip(b'\0')))+out

def typed(address,b,slot,mint=False):
    common={'address':address,'program':PROGRAM,'observationSlot':slot,
            'dataBytes':len(b),'dataSha256':hashlib.sha256(b).hexdigest()}
    if mint:
        return dict(common,supplyRaw=str(int.from_bytes(b[36:44],'little')),decimals=b[44],initialized=True,
                    mintAuthority=key(b[4:36]),freezeAuthority=None,supportedExtensionIds=[])
    out=dict(common,mint=MINT,amountRaw=str(int.from_bytes(b[64:72],'little')),
             ownerAuthority=key(b[32:64]),state=b[108],supportedExtensionIds=[7] if len(b)==170 else [])
    if int.from_bytes(b[72:76],'little')==1:
        out['delegate']={'authority':key(b[76:108]),'delegatedAmountRaw':str(int.from_bytes(b[121:129],'little'))}
    if int.from_bytes(b[129:133],'little')==1:out['closeAuthority']=key(b[133:165])
    return out

def discovery(raw,endpoint):
    obj,slot,rows=envelope(raw,1);require(len(rows)<=99)
    keys=[];binary=[]
    for row in rows:
        require(type(row) is dict and set(row)=={'pubkey','account'})
        k=row['pubkey'];core.base58(k,size=32)
        require(k not in keys and k!=MINT)
        keys.append(k);binary.append(account(row['account']))
    core.leakage_gate(raw,obj,endpoint,binary)
    return slot,keys

def observation(raw,endpoint,slot,keys,discovery_hash,discovery_bytes):
    obj,newslot,rows=envelope(raw,2)
    require(newslot>=slot and len(rows)==len(keys)+1)
    binary=[account(x) for x in rows[:-1]]+[account(rows[-1],True)]
    core.leakage_gate(raw,obj,endpoint,binary)
    tokens=binary[:-1];supply=int.from_bytes(binary[-1][36:44],'little')
    observed=sum(int.from_bytes(b[64:72],'little') for b in tokens)
    require(observed<=supply)
    out={'schema':'LP_INVENTORY_TYPED_V1','mint':MINT,'discoverySlot':slot,'observationSlot':newslot,
         'accountCount':len(keys),'nonzeroAccountCount':sum(int.from_bytes(b[64:72],'little')>0 for b in tokens),
         'delegatedAccountCount':sum(int.from_bytes(b[72:76],'little')==1 for b in tokens),
         'closeAuthorityAccountCount':sum(int.from_bytes(b[129:133],'little')==1 for b in tokens),
         'frozenAccountCount':sum(b[108]==2 for b in tokens),
         'observedBalancesEqualMintSupply':observed==supply,
         'discoveryResponseSha256':discovery_hash,'discoveryResponseBytes':discovery_bytes,
         'observationResponseSha256':hashlib.sha256(raw).hexdigest(),'observationResponseBytes':len(raw),
         'inventoryCompletenessVerified':False,'crossSlotMembershipVerified':False,'custodyVerified':False,
         'withdrawalRightsVerified':False,'historicalOwnershipVerified':False,'scorePromoted':False,
         'individualRecordsIncluded':True,'rawBytesIncluded':False,
         'discoveryAddresses':keys,
         'accounts':[typed(k,b,newslot) for k,b in zip(keys,tokens)],
         'mintAccount':typed(MINT,binary[-1],newslot,True)}
    encoded=json.dumps(out,sort_keys=True,separators=(',',':')).encode()
    core.leakage_gate(encoded,out,endpoint,[])
    return encoded

def collect(endpoint,directory,opener=None):
    require(core.endpoint_valid(endpoint))
    root=Path(directory);root.mkdir(mode=0o700,exist_ok=False)
    attempts=0
    old=signal.getsignal(signal.SIGALRM)
    def timeout(*_):raise core.Invalid('DEADLINE')
    signal.signal(signal.SIGALRM,timeout)
    def request(method,params):
        nonlocal attempts
        require(attempts<2);attempts+=1
        # Durable attempt intent, contains no response, URL or discovered identities.
        with os.fdopen(os.open(root/'intent.json',os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600),'w') as f:
            json.dump({'attempts':attempts,'retries':0},f);f.flush();os.fsync(f.fileno())
        signal.setitimer(signal.ITIMER_REAL,30)
        response=None
        try:
            req=urllib.request.Request(endpoint,data=json.dumps({'jsonrpc':'2.0','id':attempts,'method':method,'params':params}).encode(),headers={'Content-Type':'application/json','Accept-Encoding':'identity'},method='POST')
            try:
                response=(opener or urllib.request.build_opener(core.NoRedirect()).open)(req,timeout=30)
            except urllib.error.HTTPError as error:
                response=error
            require(response.getcode()==200)
            raw=response.read(MAX_BYTES+1);require(len(raw)<=MAX_BYTES)
            # read(size) need not exhaust a response: explicit EOF check.
            require(response.read(1)==b'')
            length=response.headers.get('Content-Length')
            require(length is None or length.isdecimal() and int(length)==len(raw))
            return raw
        finally:
            try:
                if response is not None:response.close()
            finally:signal.setitimer(signal.ITIMER_REAL,0)
    try:
        first=request('getProgramAccounts',[PROGRAM,{'commitment':'finalized','encoding':'base64','withContext':True,'filters':[{'memcmp':{'offset':0,'bytes':MINT}}]}])
        slot,keys=discovery(first,endpoint)
        second=request('getMultipleAccounts',[keys+[MINT],{'commitment':'finalized','encoding':'base64','minContextSlot':slot}])
        encoded=observation(second,endpoint,slot,keys,hashlib.sha256(first).hexdigest(),len(first))
        manifest=json.dumps({'schema':'LP_INVENTORY_MANIFEST_V1','projectionSha256':hashlib.sha256(encoded).hexdigest(),'projectionBytes':len(encoded),'rawIncluded':False,'attempts':attempts,'retries':0},sort_keys=True).encode()
        public=root/'public';public.mkdir(mode=0o700)
        for name,data in [('projection.json',encoded),('manifest.json',manifest)]:
            with os.fdopen(os.open(public/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb') as f:f.write(data)
        return {'status':'TYPED_CAPTURED_NOT_CUSTODY','attempts':attempts,'retries':0}
    except BaseException:
        for name in ('projection.json','manifest.json'):
            p=root/'public'/name
            if p.exists():p.unlink()
        return {'status':'STOP_RECONCILE_NO_RETRY','attempts':attempts,'retries':0}
    finally:
        signal.setitimer(signal.ITIMER_REAL,0);signal.signal(signal.SIGALRM,old)

if __name__=='__main__':
    os.umask(0o077)
    if sys.argv[1:]!=['--approved-once']:
        print('{"status":"DISABLED","attempts":0}');sys.exit(0)
    try:r=collect(os.environ.get('ALCHEMY_SOLANA_ARCHIVE_RPC_URL'),'lp-inventory-private')
    except BaseException:r={'status':'STOP_RECONCILE_NO_RETRY'}
    print(json.dumps(r));sys.exit(0 if r['status']=='TYPED_CAPTURED_NOT_CUSTODY' else 1)
