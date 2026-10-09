[CmdletBinding()]
param([string]$PackageRoot)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if(-not $PackageRoot){
  $preview=Join-Path $PSScriptRoot 'public\assets\voice\kitsune_ondevice_v06'
  $source=Join-Path $PSScriptRoot '..\..\..\assets\voice\kitsune_ondevice_v06'
  $PackageRoot=if(Test-Path -LiteralPath $preview){$preview}else{$source}
}
$taskPackage=(Resolve-Path -LiteralPath $PackageRoot).Path
$manifestPath=Join-Path $taskPackage 'manifest.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -AsHashtable
if($manifest.schema_version -ne 2 -or $manifest.voice_identity -ne 'kitsune' -or $manifest.validation.native_cpu.status -ne 'passed'){
  throw 'Нужен проверенный экспорт Kitsune v0.6. Модель не заменяется этим установщиком.'
}
$runtimePath=Join-Path $taskPackage 'runtime'
$stagingPath=Join-Path $taskPackage '.runtime-staging'
$names=@('ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm')
$runtimeNames=$names+@('LICENSE_ONNXRUNTIME.txt')
$installed=$manifest.ContainsKey('runtime_version') -and $manifest.runtime_version -eq 'onnxruntime-web@1.22.0'
foreach($name in $runtimeNames){
  $record=@($manifest.files | Where-Object path -eq ('runtime/'+$name))
  $file=Join-Path $runtimePath $name
  if($record.Count -ne 1 -or -not(Test-Path -LiteralPath $file)){$installed=$false;continue}
  if((Get-Item -LiteralPath $file).Length -ne $record[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $record[0].sha256){$installed=$false}
}
if($installed){
  Write-Host 'Компонент браузерного генератора уже сохранён и проверен. Повторная загрузка не нужна. Запустите START.bat.'
  return
}
New-Item -ItemType Directory -Path $runtimePath,$stagingPath -Force | Out-Null
$archive=Join-Path $stagingPath 'onnxruntime-web-1.22.0.tgz'
if(-not(Test-Path -LiteralPath $archive)){
  Write-Host 'Однократно загружаем компонент браузерного генератора. Установка Python не нужна.'
  $raw=& npm.cmd pack 'onnxruntime-web@1.22.0' --ignore-scripts --json --pack-destination $stagingPath
  if($LASTEXITCODE -ne 0){throw 'Не удалось загрузить компонент. Проверьте интернет и повторите запуск.'}
  $pack=($raw -join "`n") | ConvertFrom-Json
  if($pack[0].name -ne 'onnxruntime-web' -or $pack[0].version -ne '1.22.0' -or $pack[0].filename -ne 'onnxruntime-web-1.22.0.tgz'){throw 'Получен неожиданный пакет.'}
  $actual='sha512-'+[Convert]::ToBase64String([Security.Cryptography.SHA512]::HashData([IO.File]::ReadAllBytes($archive)))
  if($actual -ne $pack[0].integrity){throw 'Не совпадает контрольная сумма загруженного компонента.'}
  $pack[0].integrity | Set-Content -LiteralPath (Join-Path $stagingPath 'integrity.txt') -Encoding utf8
}else{
  $integrity=Get-Content -LiteralPath (Join-Path $stagingPath 'integrity.txt') -Raw
  $actual='sha512-'+[Convert]::ToBase64String([Security.Cryptography.SHA512]::HashData([IO.File]::ReadAllBytes($archive)))
  if($actual -ne $integrity.Trim()){throw 'Сохранённый архив повреждён.'}
}
$extract=@('package/package.json')+@($names | ForEach-Object {'package/dist/'+$_})
$listing=& tar -tf $archive
if($LASTEXITCODE -ne 0){throw 'Не удалось прочитать архив.'}
foreach($entry in $extract){if($entry -notin $listing){throw "В архиве отсутствует $entry"}}
# npm onnxruntime-web@1.22.0 omits LICENSE. Ship Microsoft's MIT text with this installer.
$bundledLicense=Join-Path $PSScriptRoot 'LICENSE_ONNXRUNTIME.txt'
$licenseSource=$bundledLicense
if('package/LICENSE' -in $listing){
  $extract+=@('package/LICENSE')
  $licenseSource=Join-Path $stagingPath 'package\LICENSE'
}elseif(-not(Test-Path -LiteralPath $bundledLicense)){
  throw 'В комплекте установщика отсутствует LICENSE_ONNXRUNTIME.txt. Восстановите комплект и повторите запуск.'
}
# Extract only explicitly named files. No package scripts run.
& tar -xf $archive -C $stagingPath @extract
if($LASTEXITCODE -ne 0){throw 'Не удалось распаковать компонент.'}
$package=Get-Content -LiteralPath (Join-Path $stagingPath 'package\package.json') -Raw | ConvertFrom-Json
if($package.name -ne 'onnxruntime-web' -or $package.version -ne '1.22.0' -or $package.license -ne 'MIT'){throw 'Версия или лицензия компонента не совпадает.'}
foreach($name in $names){Copy-Item -LiteralPath (Join-Path $stagingPath ('package\dist\'+$name)) -Destination (Join-Path $runtimePath $name)}
Copy-Item -LiteralPath $licenseSource -Destination (Join-Path $runtimePath 'LICENSE_ONNXRUNTIME.txt')
$manifest.files=@($manifest.files | Where-Object {-not $_.path.StartsWith('runtime/')})
foreach($file in Get-ChildItem -LiteralPath $runtimePath -File){
  if($file.Name -notin ($names+@('LICENSE_ONNXRUNTIME.txt'))){continue}
  $manifest.files+=@{path='runtime/'+$file.Name;bytes=$file.Length;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower()}
}
$manifest.status='candidate_needs_device_validation'
$manifest.runtime_version='onnxruntime-web@1.22.0'
$manifest.missing=@('Прослушивание именно экспортированного голоса','Проверка браузера на ПК без сети','Проверки Android и iOS без сети')
$next=Join-Path $taskPackage 'manifest.next.json'
$manifest | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $next -Encoding utf8
Move-Item -LiteralPath $next -Destination $manifestPath -Force
Write-Host 'Компонент сохранён. Запустите START.bat, откройте обычные настройки Китсуне и нажмите «Сохранить генератор».'
Write-Host 'Это кандидат для проверки устройств. Подтверждение готовности Android/iOS автоматически не выставляется.'
