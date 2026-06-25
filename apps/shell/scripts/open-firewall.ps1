# Run once as Administrator so colleagues on the same Wi-Fi can open the demo.
# Right-click PowerShell -> Run as administrator, then:
#   cd c:\workspace\property_study\apps\shell\scripts
#   .\open-firewall.ps1

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
  Write-Host ""
  Write-Host "ERROR: Run PowerShell as Administrator, then run this script again." -ForegroundColor Red
  Write-Host ""
  Write-Host "  1. Press Win, type PowerShell"
  Write-Host "  2. Right-click -> Run as administrator"
  Write-Host "  3. cd c:\workspace\property_study\apps\shell\scripts"
  Write-Host "  4. .\open-firewall.ps1"
  Write-Host ""
  exit 1
}

$rules = @(
  @{ Name = "Ejada Next.js Dev 3000"; Port = 3000; Description = "Allow LAN access to Ejada shell (npm run dev)" }
  @{ Name = "Ejada API Dev 5160"; Port = 5160; Description = "Allow LAN access to Ejada API gateway (npm run dev:api)" }
)

foreach ($rule in $rules) {
  $existing = netsh advfirewall firewall show rule name="$($rule.Name)" 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Firewall rule already exists: $($rule.Name)"
    continue
  }

  netsh advfirewall firewall add rule `
    name="$($rule.Name)" `
    dir=in `
    action=allow `
    protocol=TCP `
    localport=$($rule.Port) `
    profile=any `
    description="$($rule.Description)"

  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to add firewall rule: $($rule.Name)" -ForegroundColor Red
    exit 1
  }

  Write-Host "Added firewall rule: $($rule.Name) (TCP $($rule.Port), all profiles)"
}

Write-Host ""
Write-Host "Done. Ports 3000 (UI) and 5160 (API) are open for LAN access."
Write-Host ""
Write-Host "Share the URL from npm run dev, for example:"
Write-Host "  http://192.168.1.15:3000/login"
Write-Host ""
Write-Host "Requirements for teammates:"
Write-Host "  - Same Wi-Fi network"
Write-Host "  - Backend running on this PC: npm run dev:api (port 5160)"
Write-Host "  - Do NOT use http://0.0.0.0:3000 - use your LAN IP above"
Write-Host ""
