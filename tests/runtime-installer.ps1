$ErrorActionPreference='Stop'
$testRoot=Join-Path $PSScriptRoot ('..\.voice-test-work\runtime-'+[Guid]::NewGuid().ToString('N'))
$packageRoot=Join-Path $testRoot 'voice'
$staging=Join-Path $packageRoot '.runtime-staging'
$dist=Join-Path $staging 'package\dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
@{schema_version=2;voice_identity='kitsune';status='candidate_missing_runtime';files=@();validation=@{native_cpu=@{status='passed'}}} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Encoding utf8
@{name='onnxruntime-web';version='1.22.0';license='MIT'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $staging 'package\package.json') -Encoding utf8
# Match the actual npm 1.22.0 archive: it contains no package/LICENSE.
foreach($name in @('ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm')){[IO.File]::WriteAllBytes((Join-Path $dist $name),[Text.Encoding]::UTF8.GetBytes('test-'+$name))}
$archive=Join-Path $staging 'onnxruntime-web-1.22.0.tgz'
& tar -czf $archive -C $staging package
if($LASTEXITCODE){throw 'Cannot create fixture archive'}
$integrity='sha512-'+[Convert]::ToBase64String([Security.Cryptography.SHA512]::HashData([IO.File]::ReadAllBytes($archive)))
$integrity | Set-Content -LiteralPath (Join-Path $staging 'integrity.txt') -Encoding utf8
$installer=Join-Path $PSScriptRoot '..\tools\voice-engine\device\Install_Browser_Runtime.ps1'
& $installer -PackageRoot $packageRoot
$m=Get-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Raw | ConvertFrom-Json
if($m.status -ne 'candidate_needs_device_validation' -or $m.files.Count -ne 4 -or $m.validation.devices){throw 'Unexpected installer status'}
foreach($r in $m.files){$p=Join-Path $packageRoot $r.path;if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower() -ne $r.sha256){throw 'File hash differs'}}
if((Get-FileHash -LiteralPath (Join-Path $packageRoot 'runtime\LICENSE_ONNXRUNTIME.txt')).Hash -ne (Get-FileHash -LiteralPath (Join-Path (Split-Path $installer) 'LICENSE_ONNXRUNTIME.txt')).Hash){throw 'Bundled license differs'}
Write-Host 'PASS npm layout without LICENSE, bundled MIT, byte hashes and unapproved device status (fixture, no network/runtime execution)'
& $installer -PackageRoot $packageRoot
Write-Host 'PASS повторный запуск проверяет сохранённые файлы без npm'
[IO.File]::AppendAllText($archive,'damage')
[IO.File]::AppendAllText((Join-Path $packageRoot 'runtime\ort.wasm.min.js'),'damage')
$failed=$false
try{& $installer -PackageRoot $packageRoot}catch{$failed=$_.Exception.Message -match 'повреждён'}
if(-not $failed){throw 'Installer accepted damaged archive'}
Write-Host 'PASS damaged archive rejected'
