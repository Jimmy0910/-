# verify_gate.ps1
# Project-specific AI Agent Quality and Security Verification Gate

param (
    [switch]$AllowTodo = $false
)

$ErrorCount = 0

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 Local AI Agent Harness: Verification Gate Active" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Define target extensions and excluded directories
$ExcludeDirs = @(".git", ".agents", "node_modules", "dist")
$TargetExtensions = @(".ipynb", ".py", ".js", ".ts", ".json", ".md", ".txt")

# Get Current Directory (the project directory being verified)
$WorkspaceRoot = Get-Location
Write-Host "🔍 Scanning Directory: $WorkspaceRoot"

# Find all target files in the active workspace
$Files = Get-ChildItem -Path $WorkspaceRoot -Recurse -File | Where-Object {
    $filePath = $_.FullName
    $inExcluded = $false
    foreach ($dir in $ExcludeDirs) {
        if ($filePath -like "*\$dir\*") {
            $inExcluded = $true
            break
        }
    }
    $ext = $_.Extension.ToLower()
    !$inExcluded -and ($TargetExtensions -contains $ext)
}

Write-Host "📂 Found $($Files.Count) files to verify..."

# 2. Scan each file
foreach ($File in $Files) {
    $FilePath = $File.FullName
    $RelativePath = $FilePath.Replace($WorkspaceRoot, "")
    $Content = (Get-Content -LiteralPath $FilePath) -join "`n"

    if ([string]::IsNullOrEmpty($Content)) { continue }

    # A. Secret Scanning
    $SecretPattern = '(?i)(api_key|password|secret|token|credential)\s*=\s*["'']([^"'']+)["'']'
    $Matches = [regex]::Matches($Content, $SecretPattern)
    foreach ($Match in $Matches) {
        $Key = $Match.Groups[1].Value
        $Value = $Match.Groups[2].Value
        
        # Ignore placeholders
        $Placeholders = @("your_key", "your_token", "your_password", "placeholder", "your_api_key", "my_secret", "sk-...", "dummy", "test_key", "xxxx", "enter_your_api_key_here")
        $isPlaceholder = $false
        foreach ($p in $Placeholders) {
            if ($Value -like "*$p*") { $isPlaceholder = $true; break }
        }
        
        if (-not $isPlaceholder -and $Value.Length -gt 3) {
            # Bypass local development defaults / testing placeholders
            if ($Value -eq "local-dev-jwt-secret-key-12345" -or $Value -eq "11111111-2222-3333-4444-555555555555") {
                continue
            }
            Write-Host "❌ [SECURITY ALERT] File $RelativePath suspected of hardcoded credentials: $Key = '$Value'" -ForegroundColor Red
            $ErrorCount++
        }
    }

    # B. PII / Email Scanning
    $EmailPattern = '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
    $EmailMatches = [regex]::Matches($Content, $EmailPattern)
    foreach ($EMatch in $EmailMatches) {
        $EmailVal = $EMatch.Value
        if ($EmailVal -notlike "*example.com" -and $EmailVal -notlike "*email.com") {
            Write-Host "❌ [PRIVACY ALERT] File $RelativePath contains hardcoded email '$EmailVal'. Please use placeholders like [[USER_EMAIL]]." -ForegroundColor Red
            $ErrorCount++
        }
    }

    # C. TODO / FIXME Checking
    if (-not $AllowTodo) {
        $TodoPattern = '(?i)(//|#|<!--)\s*(TODO|FIXME)\b'
        if ($Content -match $TodoPattern) {
            Write-Host "⚠️  [QUALITY WARNING] File $RelativePath contains unresolved TODO/FIXME" -ForegroundColor Yellow
            $ErrorCount++
        }
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
if ($ErrorCount -eq 0) {
    Write-Host "🟢 Verification SUCCESS! All checks passed." -ForegroundColor Green
    Exit 0
} else {
    Write-Host "🔴 Verification FAILED! Found $ErrorCount quality/security issues." -ForegroundColor Red
    Exit 1
}
