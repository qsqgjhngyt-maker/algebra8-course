[CmdletBinding()]
param([string]$PackageRoot=(Join-Path $PSScriptRoot 'public\assets\voice\kitsune_piper_v07'),[switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if($PSVersionTable.PSVersion.Major -lt 7){throw 'Для установки нужен PowerShell 7.'}
$taskPackage=(Resolve-Path -LiteralPath $PackageRoot).Path
$manifestPath=Join-Path $taskPackage 'manifest.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -AsHashtable
$modelHash='e8a65629b7590195d03072495c5cbd4198ba526051f5e40d279f8d91529dc913'
if($manifest.schema_version -ne 3 -or $manifest.engine -ne 'kitsune-piper-v07' -or $manifest.validation.listening.status -ne 'approved_by_user'){throw 'Нужен отдельный комплект одобренного Piper.'}
if((Get-FileHash -LiteralPath (Join-Path $taskPackage 'model\kitsune.onnx') -Algorithm SHA256).Hash.ToLower() -ne $modelHash){throw 'Модель отличается от одобренной пробы.'}
foreach($record in $manifest.files){
  if($record.path -notmatch '^(model|runtime)/[a-zA-Z0-9_.-]+$'){throw 'Неверный путь в описании пакета.'}
  $file=Join-Path $taskPackage $record.path
  if(-not(Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -ne $record.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $record.sha256){throw ('Повреждён файл '+$record.path)}
}
$dictionary=$manifest.files | Where-Object {$_.path -eq 'runtime/ru_dict.bin'}
if(@($dictionary).Count -ne 1 -or $dictionary.bytes -ne 9053144 -or $dictionary.sha256 -ne 'ad087eb02abe6eb061d74e8cb438aab322443bd6dd3620e76497c5694310fe6c'){throw 'Обновите локальный комплект: нужен русский словарь из окружения обучения голоса.'}
if($CheckOnly){Write-Host 'Имеющиеся файлы Piper проверены. Компонент русского текста ещё может отсутствовать; сеть не использовалась.';return}
$runtimePath=Join-Path $taskPackage 'runtime'
$stagingPath=Join-Path $taskPackage '.runtime-staging'
New-Item -ItemType Directory -Path $runtimePath,$stagingPath -Force | Out-Null
$names=@('piper_phonemize.js','piper_phonemize.wasm','piper_phonemize.data')
$already=$manifest.validation.phonemizer_wasm.status -eq 'passed' -and $manifest.validation.full_tts_wasm.status -eq 'passed' -and $manifest.status -eq 'candidate_needs_device_validation'
if($already){Write-Host 'Piper уже сохранён и проверен. Запустите START.bat.';return}
$archive=Join-Path $stagingPath 'diffusionstudio-piper-wasm-1.0.0.tgz'
$integrityPath=Join-Path $stagingPath 'integrity.txt'
if(-not(Test-Path -LiteralPath $archive)){
  Write-Host 'Однократно загружаем компонент русского текста. Python и обучение не требуются.'
  $raw=& npm.cmd pack '@diffusionstudio/piper-wasm@1.0.0' --ignore-scripts --json --fetch-retries=1 --fetch-timeout=60000 --pack-destination $stagingPath
  if($LASTEXITCODE -ne 0){throw 'Загрузка не удалась. Проверьте интернет и повторите запуск.'}
  $pack=($raw -join "`n") | ConvertFrom-Json
  if($pack[0].name -ne '@diffusionstudio/piper-wasm' -or $pack[0].version -ne '1.0.0' -or $pack[0].filename -ne 'diffusionstudio-piper-wasm-1.0.0.tgz'){throw 'Получен другой компонент.'}
  $expected=$pack[0].integrity
}else{
  if(-not(Test-Path -LiteralPath $integrityPath)){throw 'Нет контрольной суммы сохранённого архива. Сохраните его отдельно, затем повторите установку без этого архива.'}
  $expected=(Get-Content -LiteralPath $integrityPath -Raw).Trim()
}
$actual='sha512-'+[Convert]::ToBase64String([Security.Cryptography.SHA512]::HashData([IO.File]::ReadAllBytes($archive)))
if($actual -ne $expected){throw 'Архив компонента повреждён.'}
$expected | Set-Content -LiteralPath $integrityPath -Encoding utf8
$listing=& tar -tf $archive
if($LASTEXITCODE -ne 0){throw 'Не удалось прочитать архив.'}
$extract=@('package/package.json')+@($names | ForEach-Object {'package/build/'+$_})
foreach($entry in $extract){if($entry -notin $listing){throw ('В архиве отсутствует '+$entry)}}
# Извлекаются только явно названные файлы. Скрипты пакета не запускаются.
& tar -xf $archive -C $stagingPath @extract
if($LASTEXITCODE -ne 0){throw 'Не удалось распаковать компонент.'}
$package=Get-Content -LiteralPath (Join-Path $stagingPath 'package\package.json') -Raw | ConvertFrom-Json
if($package.name -ne '@diffusionstudio/piper-wasm' -or $package.version -ne '1.0.0'){throw 'Неверная версия компонента.'}
foreach($name in $names){Copy-Item -LiteralPath (Join-Path $stagingPath ('package\build\'+$name)) -Destination (Join-Path $runtimePath $name)}
$manifest.files=@($manifest.files | Where-Object {$_.path -notin @($names | ForEach-Object {'runtime/'+$_})})
foreach($name in $names){$file=Get-Item -LiteralPath (Join-Path $runtimePath $name);$manifest.files+=@{path='runtime/'+$name;bytes=$file.Length;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower()}}
$manifest.status='candidate_missing_runtime'
$manifest.runtime_phonemizer='@diffusionstudio/piper-wasm@1.0.0'
$manifest | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM
Write-Host 'Проверяем русский текст, ударения и полную генерацию новых фраз без сети…'
& node (Join-Path $PSScriptRoot 'verify-runtime.cjs') $taskPackage
if($LASTEXITCODE -ne 0){throw 'Полная проверка не пройдена. Генератор не активирован; прежняя тестовая копия сохранена.'}
Write-Host 'Запустите START.bat. В обычных настройках Китсуне нажмите «Сохранить генератор», затем проверьте разговор, шаги и результаты.'
