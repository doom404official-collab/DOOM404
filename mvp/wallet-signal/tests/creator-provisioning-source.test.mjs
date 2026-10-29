import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../docs/proposals/creator-provisioning/'+n,import.meta.url),'utf8');
test('provisioning proposal has no ambient activation, secret arguments, legacy key fallback or TLS bypass',()=>{
 const s=read('Set-CreatorMachinePasswords.ps1'),m=read('CreatorProvisioning.psm1');
 assert.ok(s.indexOf('if(-not $ExecuteApprovedProvisioning)')<s.indexOf('Import-Module'));
 assert.match(s,/Read-Host \$label -AsSecureString/);assert.match(s,/#requires -Version 5\.1/);
 assert.doesNotMatch(m+s,/ServerCertificateCustomValidationCallback|SkipCertificateCheck|Set-ExecutionPolicy|Start-Transcript|Set-Content|Out-File|WriteAllText|Authorization.*Bearer/);
 assert.match(m,/Headers\.Add\('apikey',\$keyText\)/);assert.match(m,/AllowAutoRedirect=\$false/);assert.match(m,/CancelAfter\(15000\)/);
 assert.doesNotMatch(m+s,/\?\?|\?\.|ForEach-Object -Parallel|Invoke-Expression|Start-Process/);
 assert.equal((m.match(/supabase\.co\/auth\/v1\/admin\/users\//g)||[]).length,1);
});
