$ErrorActionPreference = 'SilentlyContinue'

foreach ($port in 5500, 8787, 9000) {
    $owners = Get-NetTCPConnection -State Listen -LocalPort $port |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($owner in $owners) {
        try {
            Stop-Process -Id $owner -Force
            Write-Host "[renderhub] stopped PID $owner on port $port"
        } catch {
            Write-Host "[renderhub] could not stop PID $owner on port $port"
        }
    }
}
