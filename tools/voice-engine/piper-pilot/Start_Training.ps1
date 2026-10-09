param(
    [string]$ExistingPython = (Join-Path $env:USERPROFILE 'Kitsune-Qwen-Voice\.venv\Scripts\python.exe'),
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONNOUSERSITE = '1'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
if (-not (Test-Path -LiteralPath $ExistingPython -PathType Leaf)) {
    throw 'Не найден Python из установленного Kitsune-Qwen-Voice. Укажите -ExistingPython путь к его .venv\Scripts\python.exe.'
}
$logDirectory = Join-Path $taskRoot 'logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$stamp = [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ', [Globalization.CultureInfo]::InvariantCulture)
$logPath = Join-Path $logDirectory ('run-' + $stamp + '-' + [Guid]::NewGuid().ToString('N').Substring(0,6) + '.log')
function Invoke-Logged {
    param([string]$Executable, [string[]]$Arguments)
    # pip/компилятор могут писать предупреждения в stderr: проверяем код завершения.
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments 2>&1 | Tee-Object -FilePath $logPath -Append
        $resultCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $savedPreference
    }
    if ($resultCode -ne 0) { throw ('Этап завершился с ошибкой ' + $resultCode + '. Журнал: ' + $logPath) }
}
Write-Host 'Пробное дообучение Piper под голос Китсуне. Результаты сохраняются отдельно.'
$dataset = Join-Path $taskRoot 'dataset'
if (-not (Test-Path -LiteralPath (Join-Path $dataset 'prepared.json'))) {
    Invoke-Logged -Executable $ExistingPython -Arguments @((Join-Path $taskRoot 'prepare.py'), '--input', (Join-Path $taskRoot 'input'), '--output', $dataset)
} else {
    Invoke-Logged -Executable $ExistingPython -Arguments @((Join-Path $taskRoot 'prepare.py'), '--input', (Join-Path $taskRoot 'input'), '--output', $dataset, '--verify')
}
$bootstrapArguments = @((Join-Path $taskRoot 'bootstrap.py'), '--root', $taskRoot, '--existing-python', $ExistingPython)
if ($CheckOnly) { $bootstrapArguments += '--offline-check' }
Invoke-Logged -Executable $ExistingPython -Arguments $bootstrapArguments
if ($CheckOnly) {
    Write-Host ('Проверка корпуса и видеокарты завершена. Журнал: ' + $logPath)
    return
}
$experimentPython = Join-Path $taskRoot 'local-work\.venv\Scripts\python.exe'
Write-Host 'Начинаем ограниченное обучение: до 60 эпох, 2400 обновлений оптимизаторов или 60 минут.'
Invoke-Logged -Executable $experimentPython -Arguments @((Join-Path $taskRoot 'train.py'), '--root', $taskRoot)
$latest = Get-Content -LiteralPath (Join-Path $taskRoot 'latest-result.json') -Raw | ConvertFrom-Json
$relative = [string]$latest.result
if ($relative -notmatch '^results[/\\][A-Za-z0-9-]+$') { throw 'Недопустимый путь результата' }
$reviewFile = Join-Path (Join-Path $taskRoot $relative) 'audition\Послушать.html'
Write-Host ('Готово. Откройте: ' + $reviewFile)
Write-Host ('Журнал: ' + $logPath)
