import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
test('actual workflow helper retries read-only GET but never POST after uncertain HTTP error',()=>{
 const source=readFileSync(new URL('../../../.github/workflows/glitch-holder-worker-auto.yml',import.meta.url),'utf8');
 const start=source.indexOf('          def request('),end=source.indexOf('          def status():',start);
 assert.ok(start>0&&end>start);
 const helper=source.slice(start,end).split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
 const code=`import urllib.request,urllib.error,json,time\nbase='https://offline.invalid';bypass='offline'\ntime.sleep=lambda _:None\nclass Opener:\n def __init__(self):self.calls=0\n def open(self,req,timeout):\n  self.calls+=1\n  raise failure(req)\nopener=Opener()\n${helper}\nfor failure in [lambda req:urllib.error.HTTPError(req.full_url,503,'unavailable',{},None),lambda req:TimeoutError('timeout'),lambda req:urllib.error.URLError('transport')]:\n for payload,expected in [({},1),(None,3)]:\n  opener.calls=0\n  try:request('/api/test',payload)\n  except (RuntimeError,TimeoutError,urllib.error.URLError):pass\n  else:raise AssertionError('uncertain outcome was swallowed')\n  assert opener.calls==expected,(payload,opener.calls)\nprint('GET=3 POST=1; no network')\n`;
 const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/GET=3 POST=1/);
});
