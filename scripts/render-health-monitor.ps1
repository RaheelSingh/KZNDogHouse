# Run this script from a separate PowerShell terminal while monitoring the EXPO demo.
# Stop with Ctrl+C. The monitor does not run inside Render or alter the web service.
param(
    [string]$HealthUrl = 'https://kzn-doghouse.onrender.com/api/health',
    [ValidateRange(1, 60)][int]$IntervalMinutes = 14
)

if (-not $HealthUrl.StartsWith('https://', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Only HTTPS health endpoints are permitted.'
}

Write-Host "Monitoring $HealthUrl every $IntervalMinutes minutes. Press Ctrl+C to stop."
while ($true) {
    $startedAt = Get-Date
    try {
        $result = Invoke-WebRequest -Uri $HealthUrl -Method Get -TimeoutSec 90 -UseBasicParsing -ErrorAction Stop
        $payload = $result.Content | ConvertFrom-Json -ErrorAction Stop
        if ($payload.success -ne $true) { throw 'Health endpoint did not report success.' }
        Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Healthy (HTTP $($result.StatusCode))"
    }
    catch {
        Write-Warning "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Health check failed: $($_.Exception.Message)"
    }
    # Start-to-start spacing, so a slow response does not add to the interval.
    $secondsElapsed = ((Get-Date) - $startedAt).TotalSeconds
    $sleepFor = [Math]::Max(1, [Math]::Ceiling(($IntervalMinutes * 60) - $secondsElapsed))
    Start-Sleep -Seconds $sleepFor
}
