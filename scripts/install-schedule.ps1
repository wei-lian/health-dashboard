param(
  [string]$At = '07:30',
  [switch]$Remove,
  [switch]$Preview
)
$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskName = 'DailyDash-DailyCrawler'

# Manage only this application's named task.
if ($Remove) {
  $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($existing -and $existing.Description -notlike 'DailyDash personal crawler*') { throw 'Task name is already used by another application.' }
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "Removed task: $taskName"
  exit 0
}
if ($At -notmatch '^([01]\d|2[0-3]):[0-5]\d$') { throw 'Use HH:mm, for example 07:30.' }
$nodePath = (Get-Command node -CommandType Application | Select-Object -First 1).Source
$entryPath = Join-Path $projectPath 'crawler\cron-run.js'
if (-not (Test-Path -LiteralPath $entryPath)) { throw 'Crawler entry not found.' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$parameters = '"' + $entryPath + '"'
if ($Preview) {
  [pscustomobject]@{ TaskName = $taskName; Time = $At; Program = $nodePath; Arguments = $parameters; WorkingDirectory = $projectPath; User = $identity; LogonType = 'Interactive'; StartWhenAvailable = $true }
  exit 0
}
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and $existing.Description -notlike 'DailyDash personal crawler*') { throw 'Task name is already used by another application.' }
$action = New-ScheduledTaskAction -Execute $nodePath -Argument $parameters -WorkingDirectory $projectPath
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'DailyDash personal crawler; once daily; logs in crawler/logs. Requires this user to be logged in.' -Force | Select-Object TaskName,State
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object NextRunTime,LastRunTime,LastTaskResult
Write-Output 'Installed. Runs in the Windows local timezone. The PC must be on and this user logged in; missed runs start after login when available.'
