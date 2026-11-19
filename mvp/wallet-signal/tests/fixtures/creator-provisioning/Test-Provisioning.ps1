# Synthetic only. Core tests inject an in-memory transport; no network or real key.
$ErrorActionPreference='Stop'
$module=Import-Module "$PSScriptRoot/../../../docs/proposals/creator-provisioning/CreatorProvisioning.psm1" -Force -PassThru
$script:checks=0
function Check($label,$value){if(-not $value){throw ('FAILED '+$label)};$script:checks++;Write-Output ('PASS '+$label)}
function Secret($s){return ConvertTo-SecureString $s -AsPlainText -Force}
$u='4b4d628a-d0cc-438e-bf04-661d1a5ea546';$r='3393dbd5-209f-4e3b-934d-57006fcdc4fa'
function Run-Case($failure='', $mode='Both'){
 $script:calls=New-Object Collections.Generic.List[string]
 $script:prompts=New-Object Collections.Generic.List[string]
 $script:failure=$failure
 Invoke-CreatorProvisioning -Mode $mode -Prompt {
  param($label) $script:prompts.Add($label)
  if($script:failure -eq 'prompt-cancel' -and $label -eq 'readback password'){throw 'SYNTHETIC_PRIVATE'}
  if($label -eq 'Administrative secret key'){return (Secret 'sb_secret_SYNTHETIC')}
  if($script:failure -eq 'mismatch' -and $label -like '*again'){return (Secret ('B'*32))}
  return (Secret ('A'*32))
 } -Transport {
  param($method,$id,$key,$password)
  $script:calls.Add($method+':'+$id)
  $user=@{id=$id;email='doom404official@gmail.com'}
  if($id -eq $r){$user.email='vijayananthrajkumar@gmail.com'}
  if($script:failure -eq 'wrong-id' -and $method -eq 'GET'){$user.id='other'}
  if($script:failure -eq 'wrong-email' -and $id -eq $r -and $method -eq 'GET'){$user.email='other@example.invalid'}
  if($script:failure -eq 'authentication'){throw 'PRIVATE_BEARER_RESPONSE'}
  if($method -eq 'PUT' -and $script:failure -eq 'upload-uncertain' -and $id -eq $u){throw 'PRIVATE_TIMEOUT'}
  if($method -eq 'PUT' -and $script:failure -eq 'reader-uncertain' -and $id -eq $r){throw 'PRIVATE_TIMEOUT'}
  return @{Status=200;User=$user}
 }
}
$x=Run-Case
Check 'two GETs precede exactly two PUTs' (($script:calls -join ',') -eq "GET:$u,GET:$r,PUT:$u,PUT:$r")
Check 'both acknowledged without signin' ($x.status -eq 'ACKNOWLEDGED_NO_SIGNIN_PERFORMED')
foreach($f in @('wrong-id','wrong-email','authentication')){
 $x=Run-Case $f
 Check ($f+' zero updates') (@($script:calls|Where-Object {$_ -like 'PUT:*'}).Count -eq 0)
 Check ($f+' no password prompt') ($script:prompts.Count -eq 1)
 Check ($f+' redacted') (($x|ConvertTo-Json) -notmatch 'PRIVATE|SYNTHETIC|AAAA')
}
$x=Run-Case 'mismatch';Check 'mismatched confirmation no PUT' (@($script:calls|Where-Object {$_ -like 'PUT:*'}).Count -eq 0)
$x=Run-Case 'upload-uncertain';Check 'uncertain upload stops reader' ($x.upload -eq 'UPDATE_OUTCOME_UNKNOWN' -and $x.readback -eq 'NOT_STARTED' -and $script:calls.Count -eq 3)
$x=Run-Case 'reader-uncertain';Check 'partial acknowledgement retained' ($x.upload -eq 'UPDATE_ACKNOWLEDGED' -and $x.readback -eq 'UPDATE_OUTCOME_UNKNOWN' -and $script:calls.Count -eq 4)
$x=Run-Case 'prompt-cancel';Check 'reader prompt cancellation preserves upload' ($x.upload -eq 'UPDATE_ACKNOWLEDGED' -and $x.readback -eq 'NOT_DISPATCHED')
$x=Run-Case '' 'ReadbackOnly';Check 'explicit resume never updates uploader' (($script:calls -join ',') -eq "GET:$u,GET:$r,PUT:$r")
# Test actual HTTP wrapper through a private module seam, no live sockets.
Add-Type -TypeDefinition @'
using System;using System.IO;using System.Net;using System.Net.Http;using System.Threading;using System.Threading.Tasks;
public class CreatorReadStream:Stream {
 int offset; bool stall; public CreatorReadStream(bool s){stall=s;} public override bool CanRead{get{return true;}} public override bool CanSeek{get{return false;}} public override bool CanWrite{get{return false;}} public override long Length{get{throw new NotSupportedException();}} public override long Position{get{return offset;}set{throw new NotSupportedException();}}
 public override Task<int> ReadAsync(byte[] b,int o,int c,CancellationToken t){if(stall)return new TaskCompletionSource<int>().Task;int n=Math.Min(c,65537-offset);for(int i=0;i<n;i++)b[o+i]=120;offset+=n;return Task.FromResult(n);}
 public override int Read(byte[] b,int o,int c){throw new NotSupportedException();}public override void Flush(){}public override long Seek(long x,SeekOrigin y){throw new NotSupportedException();}public override void SetLength(long x){throw new NotSupportedException();}public override void Write(byte[] b,int o,int c){throw new NotSupportedException();}
}
public class CreatorFakeHandler:HttpMessageHandler {
 public bool AllowAutoRedirect{get;set;} public bool UseCookies{get;set;} public bool UseDefaultCredentials{get;set;} public int MaxResponseHeadersLength{get;set;}
 public static string Mode="ok";public static int Calls;public static bool HeadersValid;
 protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage q,CancellationToken c){
  Calls++;HeadersValid=q.RequestUri.ToString()=="https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1/admin/users/4b4d628a-d0cc-438e-bf04-661d1a5ea546" && q.Headers.Contains("apikey") && q.Headers.Authorization==null && !AllowAutoRedirect && !UseCookies && !UseDefaultCredentials && MaxResponseHeadersLength==16;
  if(Mode=="cancel")return Task.FromCanceled<HttpResponseMessage>(new CancellationToken(true));
  if(Mode=="timeout")return new TaskCompletionSource<HttpResponseMessage>().Task;
  var r=new HttpResponseMessage(Mode=="redirect"?HttpStatusCode.Redirect:Mode=="auth"?HttpStatusCode.Unauthorized:HttpStatusCode.OK);
  if(Mode=="chunked-limit"||Mode=="body-timeout"){r.Content=new StreamContent(new CreatorReadStream(Mode=="body-timeout"));r.Content.Headers.ContentType=new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");return Task.FromResult(r);}
  r.Content=new StringContent(Mode=="oversized"?new string('x',65537):Mode=="malformed"?"PRIVATE_NOT_JSON":"{\"id\":\"4b4d628a-d0cc-438e-bf04-661d1a5ea546\",\"email\":\"doom404official@gmail.com\"}",System.Text.Encoding.UTF8,"application/json");return Task.FromResult(r);
 }
}
'@
& $module {function script:New-CreatorHandler {return (New-Object CreatorFakeHandler)}}
foreach($mode in @('ok','redirect','auth','oversized','malformed','cancel','timeout','chunked-limit','body-timeout')){
 [CreatorFakeHandler]::Mode=$mode;[CreatorFakeHandler]::Calls=0
 $key=Secret 'sb_secret_SYNTHETIC';$pw=Secret ('A'*32);$errorText='';$clock=[Diagnostics.Stopwatch]::StartNew()
 try{$null=Invoke-CreatorAdminRequest 'PUT' $u $key $pw}catch{$errorText=$_.Exception.Message}finally{$key.Dispose();$pw.Dispose()}
 Check ($mode+' one dispatch') ([CreatorFakeHandler]::Calls -eq 1)
 Check ($mode+' pinned headers and no redirects') ([CreatorFakeHandler]::HeadersValid)
 Check ($mode+' result redacted') (($mode -eq 'ok' -and $errorText -eq '') -or ($mode -ne 'ok' -and $errorText -eq 'CREATOR_ADMIN_REQUEST_FAILED'))
 Check ($mode+' bounded') ($clock.Elapsed.TotalSeconds -lt 18)
}
$key=Secret 'legacy-not-supported';try{$null=Invoke-CreatorAdminRequest 'GET' $u $key $null}catch{}finally{$key.Dispose()}
Check 'wrong credential mode no fallback' ([CreatorFakeHandler]::Calls -eq 1)
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile("$PSScriptRoot/../../../docs/proposals/creator-provisioning/Set-CreatorMachinePasswords.ps1",[ref]$tokens,[ref]$errors)
Check 'entry parser accepts source' ($errors.Count -eq 0)
$out=& "$PSScriptRoot/../../../docs/proposals/creator-provisioning/Set-CreatorMachinePasswords.ps1"
Check 'entry default disabled' ($out -eq 'DISABLED: no credentials read or requests sent.')
Write-Output ('CREATOR_PROVISIONING_CHECKS='+$script:checks)
