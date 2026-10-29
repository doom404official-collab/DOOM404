# Synthetic terminal test only: no imports, network, keys or account operations.
$secret=$null
try {
 $secret=Read-Host 'SYNTHETIC MASKED PROMPT' -AsSecureString
 Write-Output ('LENGTH_ONLY='+$secret.Length)
} finally {if($null -ne $secret){$secret.Dispose()}}
