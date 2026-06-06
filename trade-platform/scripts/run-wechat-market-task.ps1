param(
  [ValidateSet("preview", "publish")]
  [string]$Mode = "publish",
  [int]$SinceHours = 6,
  [string]$SourceDir = "",
  [string]$Site = "",
  [int]$Limit = 24,
  [int]$Batch = 4
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$arguments = @(
  "run",
  "wechat:auto-publish",
  "--",
  "--mode=$Mode",
  "--since-hours=$SinceHours",
  "--limit=$Limit",
  "--batch=$Batch"
)

if ($SourceDir) {
  $arguments += "--source-dir=$SourceDir"
}

if ($Site) {
  $arguments += "--site=$Site"
}

if ($Mode -eq "preview") {
  $arguments[1] = "wechat:auto"
}

& pnpm.cmd @arguments
exit $LASTEXITCODE
