param(
  [string]$TaskName = "NiuNiu WeChat Manual Export Watch",
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

$Runner = Join-Path $PSScriptRoot "run-wechat-manual-watch-task.ps1"
$ActionArgs = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-WindowStyle", "Hidden",
  "-File", "`"$Runner`"",
  "-Mode", $Mode,
  "-SinceHours", $SinceHours,
  "-Site", "`"$Site`"",
  "-Limit", $Limit,
  "-Batch", $Batch,
  "-PollSeconds", $PollSeconds,
  "-StableSeconds", $StableSeconds
)

if ($WatchDir) {
  $ActionArgs += @("-WatchDir", "`"$WatchDir`"")
}

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ($ActionArgs -join " ")
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Watch manual EchoTrace JSON exports and run NiuNiu market sync." -Force | Out-Null

Write-Host "Installed scheduled task: $TaskName"
Write-Host "Mode: $Mode"
Write-Host "Since hours: $SinceHours"
Write-Host "Watch dir: $(if ($WatchDir) { $WatchDir } else { 'E:\claude15\wechat\manual-export-inbox' })"
Write-Host "Runner: $Runner"
