# Offline-reviewed proposal. No import-time network or environment/credential reads.
Set-StrictMode -Version 2.0
function Invoke-CreatorProvisioning {
 param([scriptblock]$Prompt, [scriptblock]$Transport, [ValidateSet('Both','ReadbackOnly')][string]$Mode='Both')
 $targets=@(
  @{Name='upload';Id='4b4d628a-d0cc-438e-bf04-661d1a5ea546';Email='doom404official@gmail.com'},
  @{Name='readback';Id='3393dbd5-209f-4e3b-934d-57006fcdc4fa';Email='vijayananthrajkumar@gmail.com'}
 )
 $result=[ordered]@{upload='NOT_STARTED';readback='NOT_STARTED';status='STOPPED'}
 if($Mode -eq 'ReadbackOnly'){$result.upload='SKIPPED_PREVIOUS_ACKNOWLEDGEMENT'}
 $admin=$null;$password=$null;$confirm=$null
 try {
  $admin=& $Prompt 'Administrative secret key'
  if($admin -isnot [Security.SecureString]){throw 'INPUT'}
  # Both fixed identities are checked before ANY password prompt or update.
  foreach($t in $targets){
   $r=& $Transport 'GET' $t.Id $admin $null
   if($r.Status -ne 200 -or $r.User.id -cne $t.Id -or
    $r.User.email.Trim().ToLowerInvariant() -cne $t.Email){throw 'IDENTITY'}
  }
  foreach($t in $targets){
   if($Mode -eq 'ReadbackOnly' -and $t.Name -eq 'upload'){continue}
   $result[$t.Name]='NOT_DISPATCHED'
   $password=& $Prompt ($t.Name+' password')
   $confirm=& $Prompt ($t.Name+' password again')
   if($password -isnot [Security.SecureString] -or $confirm -isnot [Security.SecureString]){throw 'INPUT'}
   $a=[IntPtr]::Zero;$b=[IntPtr]::Zero;$plain=$null;$again=$null
   try {
    $a=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirm)
    $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($a)
    $again=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
    if($plain.Length -lt 32 -or $plain.Length -gt 128 -or $plain -cmatch '[^\x21-\x7e]' -or $plain -cne $again){throw 'INPUT'}
   } finally {
    $plain=$null;$again=$null
    if($a -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a)}
    if($b -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}
   }
   # Conservative mark BEFORE handing control to transport. It is never reset.
   $result[$t.Name]='UPDATE_OUTCOME_UNKNOWN'
   $r=& $Transport 'PUT' $t.Id $admin $password
   if($r.Status -ne 200 -or $r.User.id -cne $t.Id -or
    $r.User.email.Trim().ToLowerInvariant() -cne $t.Email){throw 'UPDATE'}
   $result[$t.Name]='UPDATE_ACKNOWLEDGED'
   $password.Dispose();$password=$null;$confirm.Dispose();$confirm=$null
  }
  $result.status='ACKNOWLEDGED_NO_SIGNIN_PERFORMED'
 } catch {
  # Never return exception, HTTP body, credentials, stack or invocation details.
  $result.status='STOP_RECONCILE_DO_NOT_RERUN'
 } finally {
  foreach($secret in @($admin,$password,$confirm)){if($null -ne $secret){$secret.Dispose()}}
 }
 return [pscustomobject]$result
}
function New-CreatorHandler { return (New-Object System.Net.Http.HttpClientHandler) }
function Invoke-CreatorAdminRequest {
 param([ValidateSet('GET','PUT')][string]$Method,[string]$Id,[Security.SecureString]$Key,[Security.SecureString]$Password)
 if($Id -notin @('4b4d628a-d0cc-438e-bf04-661d1a5ea546','3393dbd5-209f-4e3b-934d-57006fcdc4fa')){throw 'REJECTED'}
 Add-Type -AssemblyName System.Net.Http
 $handler=$null;$client=$null;$request=$null;$response=$null;$stream=$null;$cts=$null
 $keyPtr=[IntPtr]::Zero;$pwPtr=[IntPtr]::Zero;$keyText=$null;$pwText=$null;$body=$null
 try {
  $keyPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Key)
  $keyText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPtr)
  # One supported mode only: modern secret key in apikey. Never Bearer or fallback.
  if($keyText -cnotmatch '^sb_secret_[A-Za-z0-9_-]{1,256}$'){throw 'KEY_MODE'}
  $handler=New-CreatorHandler
  $handler.AllowAutoRedirect=$false
  $handler.UseCookies=$false
  $handler.MaxResponseHeadersLength=16
  $handler.UseDefaultCredentials=$false
  $client=New-Object System.Net.Http.HttpClient($handler)
  $client.Timeout=[TimeSpan]::FromSeconds(15)
  $cts=New-Object Threading.CancellationTokenSource
  $cts.CancelAfter(15000)
  $request=New-Object System.Net.Http.HttpRequestMessage
  $request.Method=New-Object System.Net.Http.HttpMethod($Method)
  $request.RequestUri=[Uri]('https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1/admin/users/'+$Id)
  $request.Headers.Add('apikey',$keyText)
  if($Method -eq 'PUT'){
   $pwPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
   $pwText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pwPtr)
   $body=@{password=$pwText}|ConvertTo-Json -Compress
   $request.Content=New-Object System.Net.Http.StringContent($body,[Text.Encoding]::UTF8,'application/json')
  }
  $clock=[Diagnostics.Stopwatch]::StartNew()
  $task=$client.SendAsync($request,[Net.Http.HttpCompletionOption]::ResponseHeadersRead,$cts.Token)
  while(-not $task.IsCompleted){if($clock.ElapsedMilliseconds -ge 15000){throw 'DEADLINE'};Start-Sleep -Milliseconds 25}
  $response=$task.GetAwaiter().GetResult()
  if([int]$response.StatusCode -ne 200){throw 'HTTP_REJECTED'}
  if($response.Content.Headers.ContentType.MediaType -ne 'application/json'){throw 'CONTENT'}
  if($response.Content.Headers.ContentLength -gt 65536){throw 'LIMIT'}
  $pending=$response.Content.ReadAsStreamAsync()
  while(-not $pending.IsCompleted){if($clock.ElapsedMilliseconds -ge 15000){throw 'DEADLINE'};Start-Sleep -Milliseconds 25}
  $stream=$pending.GetAwaiter().GetResult();$buffer=New-Object byte[] 4096
  $memory=New-Object IO.MemoryStream
  try {
   do {
    $read=$stream.ReadAsync($buffer,0,$buffer.Length,$cts.Token)
    while(-not $read.IsCompleted){if($clock.ElapsedMilliseconds -ge 15000){throw 'DEADLINE'};Start-Sleep -Milliseconds 25}
    $count=$read.GetAwaiter().GetResult()
    if($memory.Length+$count -gt 65536){throw 'LIMIT'}
    $memory.Write($buffer,0,$count)
   } while($count -gt 0)
   if($clock.ElapsedMilliseconds -ge 15000){throw 'DEADLINE'}
   $text=[Text.Encoding]::UTF8.GetString($memory.ToArray())
   $user=$text|ConvertFrom-Json
   return @{Status=200;User=@{id=$user.id;email=$user.email}}
  } finally {$memory.Dispose();[Array]::Clear($buffer,0,$buffer.Length);$text=$null;$user=$null}
 } catch {throw 'CREATOR_ADMIN_REQUEST_FAILED'}
 finally {
  if($null -ne $cts){$cts.Cancel();$cts.Dispose()}
  foreach($item in @($stream,$response,$request,$client,$handler)){if($null -ne $item){$item.Dispose()}}
  $keyText=$null;$pwText=$null;$body=$null
  if($keyPtr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPtr)}
  if($pwPtr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pwPtr)}
 }
}
Export-ModuleMember -Function Invoke-CreatorProvisioning,Invoke-CreatorAdminRequest
