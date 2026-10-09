param([string]$NodePath=(Get-Command node).Source)
$ErrorActionPreference='Stop'
$pwsh=(Get-Process -Id $PID).Path
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixture=Join-Path $taskRepo ('.voice-test-work/server-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $fixture -Force
$state=Join-Path $fixture 'previous-certificate'
Copy-Item -LiteralPath (Join-Path $taskRepo 'tools/voice-engine/local-preview/Start_Local.ps1') -Destination $fixture
# Внешний процесс исполняет тестовый server.cjs и завершается. Порты не открываются.
[IO.File]::WriteAllText((Join-Path $fixture 'server.cjs'),"console.log('TEST server started');")
& $pwsh -NoProfile -File (Join-Path $fixture 'Start_Local.ps1') -StateDirectory $state -LanAddress '127.0.0.2' -PrepareOnly
if($LASTEXITCODE -ne 0){throw 'Подготовка сертификата не прошла'}
$certificateFiles=@('certificate-info.json','kitsune-local-ca.cer','server-chain.pem','server-key.pem')
$hashes=@{}
foreach($name in $certificateFiles){$hashes[$name]=(Get-FileHash -LiteralPath (Join-Path $state $name) -Algorithm SHA256).Hash}
$locked=[IO.File]::Open((Join-Path $state 'server-output.log'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try{
  foreach($run in 1..2){
    & $pwsh -NoProfile -File (Join-Path $fixture 'Start_Local.ps1') -StateDirectory $state -LanAddress '127.0.0.2'
    if($LASTEXITCODE -ne 0){throw 'Занятый старый журнал помешал запуску'}
  }
  # Также проверяется обработка отказа Node: причина и код выхода должны сохраниться.
  [IO.File]::WriteAllText((Join-Path $fixture 'server.cjs'),"console.error('TEST EADDRINUSE: close previous server');process.exitCode=1;")
  & $pwsh -NoProfile -File (Join-Path $fixture 'Start_Local.ps1') -StateDirectory $state -LanAddress '127.0.0.2'
  if($LASTEXITCODE -ne 1){throw 'Потерян код ошибки Node'}
}finally{$locked.Dispose()}
$logs=@(Get-ChildItem -LiteralPath (Join-Path $fixture '.local-logs') -File)
if($logs.Count -ne 3){throw 'Каждый запуск должен иметь отдельный журнал'}
if(@($logs | Where-Object {[IO.File]::ReadAllText($_.FullName).Contains('TEST server started')}).Count -ne 2){throw 'Журналы двух запусков повреждены'}
if(@($logs | Where-Object {[IO.File]::ReadAllText($_.FullName).Contains('TEST EADDRINUSE')}).Count -ne 1){throw 'Причина отказа не сохранена'}
foreach($name in $certificateFiles){if((Get-FileHash -LiteralPath (Join-Path $state $name) -Algorithm SHA256).Hash -ne $hashes[$name]){throw ('Сертификат изменён: '+$name)}}
# Фикстура хранится в игнорируемом каталоге; никаких пользовательских ключей здесь нет.
Write-Host 'PASS: занятый прежний журнал, отдельные журналы, код отказа и сохранение сертификата; сетевые порты не открывались.'
