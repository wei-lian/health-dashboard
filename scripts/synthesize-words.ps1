param([Parameter(Mandatory=$true)][string]$InputPath, [Parameter(Mandatory=$true)][string]$OutputFolder, [Parameter(Mandatory=$true)][string]$ResultPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en-*' } | Select-Object -First 1
  if (-not $voice) { throw 'No local English voice is installed.' }
  $synth.SelectVoice($voice.VoiceInfo.Name)
  $items = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $results = @()
  foreach ($item in $items) {
    foreach ($variant in @('normal','slow','example')) {
      $fileName = $item.files.$variant
      if ($fileName -notmatch '^[a-f0-9]{24}\.wav$') { throw 'Invalid generated audio file name.' }
      $targetPath = Join-Path $OutputFolder $fileName
      if (-not (Test-Path -LiteralPath $targetPath) -or (Get-Item -LiteralPath $targetPath).Length -lt 44) {
        $temporaryPath = $targetPath + '.tmp'
        $synth.Rate = if ($variant -eq 'slow') { -3 } else { -1 }
        try {
          $synth.SetOutputToWaveFile($temporaryPath)
          try { $synth.Speak($(if ($variant -eq 'example') { $item.example } else { $item.word })) }
          finally { $synth.SetOutputToNull() }
          if ((Get-Item -LiteralPath $temporaryPath).Length -le 44) { throw 'Generated audio is empty.' }
          Move-Item -LiteralPath $temporaryPath -Destination $targetPath -Force
        } finally {
          if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
        }
      }
    }
    $results += [pscustomobject]@{ word = $item.word; voice = $voice.VoiceInfo.Name; files = $item.files }
  }
  $json = ConvertTo-Json -InputObject @($results) -Depth 5
  [System.IO.File]::WriteAllText($ResultPath, $json, (New-Object System.Text.UTF8Encoding $false))
} finally { $synth.Dispose() }
