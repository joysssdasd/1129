param(
  [string]$TaskName = "NiuNiu WeChat Market Auto Publish",
  [ValidateSet("preview", "publish")]
  [string]$Mode = "publish",
  [int]$EveryHours = 6,
  [int]$SinceHours = 6,
  [string]$SourceDir = "",
  [string]$Site = "",
  [int]$Limit = 24,
  [int]$Batch = 4
)

$ErrorActionPreference = "Stop"

if ($EveryHours -lt 1) {
  throw "EveryHours must be at least 1."
}

$Runner = Join-Path $PSScriptRoot "run-wechat-market-task.ps1"
$ActionArgs = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$Runner`"",
  "-Mode", $Mode,
  "-SinceHours", $SinceHours,
  "-Limit", $Limit,
  "-Batch", $Batch
)

if ($SourceDir) {
  $ActionArgs += @("-SourceDir", "`"$SourceDir`"")
}

if ($Site) {
  $ActionArgs += @("-Site", "`"$Site`"")
}

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ($ActionArgs -join " ")
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours $EveryHours)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Run NiuNiu WeChat market extraction and managed sync every $EveryHours hours." -Force | Out-Null

Write-Host "Installed scheduled task: $TaskName"
Write-Host "Mode: $Mode"
Write-Host "Every hours: $EveryHours"
Write-Host "Since hours: $SinceHours"
Write-Host "Runner: $Runner"
