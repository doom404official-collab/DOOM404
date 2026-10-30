#requires -Version 5.1
[CmdletBinding()]
param([switch]$ExecuteApprovedProvisioning)
# Inactive by default. Never pass a credential as an argument.
if(-not $ExecuteApprovedProvisioning){Write-Output 'DISABLED: no credentials read or requests sent.';return}
$ErrorActionPreference='Stop'
try {
 if($env:OS -ne 'Windows_NT' -or [Console]::IsInputRedirected){throw 'UNSUPPORTED_HOST'}
 # Refuse configured transcript policy; never disable or bypass it.
 foreach($hive in @('HKCU:','HKLM:')){
  $policy=Get-ItemProperty -Path ($hive+'\Software\Policies\Microsoft\Windows\PowerShell\Transcription') -ErrorAction SilentlyContinue
  if($null -ne $policy -and $policy.EnableTranscripting -eq 1){throw 'TRANSCRIPTION_POLICY'}
 }
 Write-Host 'Only use the reviewed personal-laptop procedure. No transcript, screen sharing or recording.'
 Write-Host 'If any earlier password update was uncertain: STOP. Do not rerun.'
 if((Read-Host 'Confirm this is a private unrecorded session: type PRIVATE SESSION') -cne 'PRIVATE SESSION'){throw 'NOT_PRIVATE'}
 $choice=Read-Host 'Type FIRST RUN or READBACK ONLY AFTER UPLOAD ACKNOWLEDGED'
 if($choice -ceq 'FIRST RUN'){$mode='Both'}
 elseif($choice -ceq 'READBACK ONLY AFTER UPLOAD ACKNOWLEDGED'){$mode='ReadbackOnly'}
 else{throw 'NOT_CONFIRMED'}
 Import-Module (Join-Path $PSScriptRoot 'CreatorProvisioning.psm1') -Force
 $result=Invoke-CreatorProvisioning -Mode $mode -Prompt {param($label) Read-Host $label -AsSecureString} -Transport {param($method,$id,$key,$password) Invoke-CreatorAdminRequest $method $id $key $password}
 # Only the fixed state receipt is printed. Never pipe raw HTTP responses/errors.
 Write-Output ('upload: '+$result.upload)
 Write-Output ('readback: '+$result.readback)
 Write-Output ('status: '+$result.status)
} catch {Write-Output 'STOP: interrupted or unavailable. Treat any started update as uncertain; do not rerun.'}
