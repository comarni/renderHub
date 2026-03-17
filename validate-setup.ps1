# Validation script for RenderHub Image-to-3D pipeline (Windows PowerShell)
# Tests all three components: Frontend, Backend, TripoSR
# Usage: powershell -ExecutionPolicy Bypass .\validate-setup.ps1

$ErrorActionPreference = "Continue"

# Colors
$GREEN = "`e[32m"
$RED = "`e[31m"
$YELLOW = "`e[33m"
$BLUE = "`e[34m"
$RESET = "`e[0m"

Write-Host "$BLUE╔════════════════════════════════════════════════╗$RESET"
Write-Host "$BLUE║     RenderHub Image-to-3D Validation Script    ║$RESET"
Write-Host "$BLUE╚════════════════════════════════════════════════╝$RESET"
Write-Host ""

# Counters
$Pass = 0
$Fail = 0
$Warn = 0

# Helper functions
function Check-Service {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Retries = 3,
        [int]$Delay = 2
    )
    
    Write-Host -NoNewline "Checking $Name... "
    
    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -SkipHttpErrorCheck
            if ($response.StatusCode -eq 200 -or $response.Content) {
                Write-Host "$GREEN✓ OK$RESET"
                $preview = $response.Content.Substring(0, [Math]::Min(50, $response.Content.Length))
                Write-Host "  Response: $preview..."
                $global:Pass++
                return $true
            }
        }
        catch {
            if ($i -lt $Retries) {
                Write-Host -NoNewline "retry $i/$($Retries-1)... "
                Start-Sleep -Seconds $Delay
            }
        }
    }
    
    Write-Host "$RED✗ FAILED$RESET"
    $global:Fail++
    return $false
}

function Check-Command {
    param(
        [string]$Cmd,
        [string]$Name
    )
    
    Write-Host -NoNewline "Checking $Name... "
    
    try {
        $result = & $Cmd --version 2>$null | Select-Object -First 1
        if ($result) {
            Write-Host "$GREEN✓$RESET ($result)"
            $global:Pass++
            return $true
        }
    }
    catch {}
    
    Write-Host "$RED✗ NOT FOUND$RESET"
    $global:Fail++
    return $false
}

function Check-File {
    param(
        [string]$Path,
        [string]$Name
    )
    
    Write-Host -NoNewline "Checking $Name... "
    
    if (Test-Path -Path $Path -Type Leaf) {
        $file = Get-Item $Path
        $size = if ($file.Length -gt 1MB) {
            "{0:N2} MB" -f ($file.Length / 1MB)
        }
        elseif ($file.Length -gt 1KB) {
            "{0:N2} KB" -f ($file.Length / 1KB)
        }
        else {
            "{0} bytes" -f $file.Length
        }
        
        Write-Host "$GREEN✓$RESET ($size)"
        $global:Pass++
        return $true
    }
    
    Write-Host "$RED✗ NOT FOUND$RESET"
    $global:Fail++
    return $false
}

# Tests
Write-Host "$YELLOW[1/5] System Dependencies$RESET"
Write-Host "─────────────────────────────────────"
Check-Command "node" "Node.js"
Check-Command "python" "Python 3"
Check-Command "npm" "npm"
Write-Host ""

Write-Host "$YELLOW[2/5] Project Files$RESET"
Write-Host "─────────────────────────────────────"
Check-File "./ai-server/server.js" "ai-server/server.js"
Check-File "./ai-server/tripo-sr-wrapper/app.py" "TripoSR wrapper (app.py)"
Check-File "./3d-editor/app.js" "3D Editor (app.js)"
Check-File "./ai-server/.env.example" ".env.example"
Write-Host ""

Write-Host "$YELLOW[3/5] Backend Health (Node.js)$RESET"
Write-Host "─────────────────────────────────────"
Check-Service "AI Server" "http://127.0.0.1:8787/api/ai/health" 3 2
Write-Host ""

Write-Host "$YELLOW[4/5] TripoSR Service (Python)$RESET"
Write-Host "─────────────────────────────────────"
Check-Service "TripoSR Health" "http://127.0.0.1:9000/api/v1/health" 3 2
Check-Service "TripoSR Demo Health" "http://127.0.0.1:9000/health" 2 1
Write-Host ""

Write-Host "$YELLOW[5/5] Network Connectivity$RESET"
Write-Host "─────────────────────────────────────"

# Test backend can reach TripoSR
if ($Fail -eq 0) {
    Write-Host -NoNewline "Testing Backend → TripoSR routing... "
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8787/api/ai/health" -SkipHttpErrorCheck
        if ($response.Content -match "upstream|mock") {
            Write-Host "$GREEN✓$RESET"
            Write-Host "  Backend mode detected"
            $global:Pass++
        }
        else {
            Write-Host "$YELLOW⚠$RESET Backend responding but no mode"
            $global:Warn++
        }
    }
    catch {
        Write-Host "$RED✗$RESET Backend not responding"
        $global:Fail++
    }
    Write-Host ""
}

# Summary
Write-Host "─────────────────────────────────────"
Write-Host "$BLUE`Summary:$RESET"
Write-Host "  $GREEN`Pass:$RESET $Pass"
Write-Host "  $RED`Fail:$RESET $Fail"
Write-Host "  $YELLOW`Warn:$RESET $Warn"
Write-Host ""

if ($Fail -eq 0) {
    Write-Host "$GREEN✓ All systems operational!$RESET"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Open http://localhost:5500 (frontend)"
    Write-Host "  2. Click 'Image→3D AI' or drag an image"
    Write-Host "  3. Wait 15-45 seconds for TripoSR to process"
    Write-Host "  4. View generated 3D model in editor"
    Write-Host ""
    exit 0
}
else {
    Write-Host "$RED✗ Some checks failed. See above.$RESET"
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "  - Terminal 1: cd ai-server && npm run dev"
    Write-Host "  - Terminal 2: cd ai-server/tripo-sr-wrapper && python app.py"
    Write-Host "  - Terminal 3: cd 3d-editor && npx http-server . -p 5500"
    Write-Host ""
    exit 1
}
