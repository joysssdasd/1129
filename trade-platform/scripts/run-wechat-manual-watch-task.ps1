param(
  [ValidateSet("preview", "publish")]
  [string]$Mode = "publish",
  [int]$SinceHours = 6,
  [string]$WatchDir = "",
  [string]$Site = "https://www.niuniubase.top",
  [int]$Limit = 24,
  [int]$Batch = 4,
  [int]$PollSeconds = 3,
  [int]$StableSeconds = 8
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$arguments = @(
  "run",
  "wechat:manual-watch",
  "--",
  "--mode=$Mode",
  "--since-hours=$SinceHours",
  "--limit=$Limit",
  "--batch=$Batch",
  "--poll-ms=$($PollSeconds * 1000)",
  "--stable-ms=$($StableSeconds * 1000)"
)

if ($WatchDir) {
  $arguments += "--watch-dir=$WatchDir"
}

if ($Site) {
  $arguments += "--site=$Site"
}

& pnpm.cmd @arguments
exit $LASTEXITCODE
