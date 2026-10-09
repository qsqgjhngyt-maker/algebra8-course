param(
  [string]$LanAddress = '192.168.3.10',
  [string]$StateDirectory = (Join-Path $PSScriptRoot '.local-state'),
  [string]$LogDirectory = (Join-Path $PSScriptRoot '.local-logs'),
  [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Для запуска нужен PowerShell 7 (pwsh) и Node.js 22 или новее.' }
$null = New-Item -ItemType Directory -Path $StateDirectory -Force
$StateDirectory = [IO.Path]::GetFullPath($StateDirectory)
$configPath = Join-Path $StateDirectory 'certificate-info.json'
$reuse = $false
if (Test-Path -LiteralPath $configPath) {
  # ConvertFrom-Json в новых PowerShell автоматически превращает ISO-даты
  # в DateTime. Повторный Parse такого объекта зависит от языка Windows.
  # Читаем исходную строку JSON без преобразования её типа.
  $certificateDocument = [System.Text.Json.JsonDocument]::Parse([IO.File]::ReadAllText($configPath))
  try {
    $savedAddress = $certificateDocument.RootElement.GetProperty('address').GetString()
    $savedExpiryText = $certificateDocument.RootElement.GetProperty('expires').GetString()
  } finally { $certificateDocument.Dispose() }
  $savedExpiry = [DateTimeOffset]::MinValue
  $expiryValid = [DateTimeOffset]::TryParse($savedExpiryText,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$savedExpiry)
  $filesPresent = @('kitsune-local-ca.cer','server-chain.pem','server-key.pem').Where({ -not (Test-Path -LiteralPath (Join-Path $StateDirectory $_)) }).Count -eq 0
  $reuse = $savedAddress -eq $LanAddress -and $expiryValid -and $savedExpiry -gt [DateTimeOffset]::Now.AddHours(1) -and $filesPresent
}
if (-not $reuse) {
  $notBefore = [DateTimeOffset]::UtcNow.AddMinutes(-10)
  $expires = [DateTimeOffset]::UtcNow.AddDays(7)
  $rootKey = [Security.Cryptography.RSA]::Create(3072)
  $rootRequest = [Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=Kitsune Local Test CA', $rootKey, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $rootRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$true,0,$true))
  $rootRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign,$true))
  $rootRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($rootRequest.PublicKey,$false))
  $rootCert = $rootRequest.CreateSelfSigned($notBefore,$expires)
  $serverKey = [Security.Cryptography.RSA]::Create(2048)
  $serverRequest = [Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=$LanAddress",$serverKey,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $serverRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true))
  $serverRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,$true))
  $eku = [Security.Cryptography.OidCollection]::new()
  $null = $eku.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
  $serverRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku,$false))
  $san = [Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
  $san.AddDnsName('localhost')
  $san.AddIpAddress([Net.IPAddress]::Parse('127.0.0.1'))
  $san.AddIpAddress([Net.IPAddress]::Parse($LanAddress))
  $serverRequest.CertificateExtensions.Add($san.Build())
  $serverCert = $serverRequest.Create($rootCert,$notBefore,$expires,[Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
  [IO.File]::WriteAllBytes((Join-Path $StateDirectory 'kitsune-local-ca.cer'),$rootCert.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert))
  [IO.File]::WriteAllText((Join-Path $StateDirectory 'server-chain.pem'),$serverCert.ExportCertificatePem()+"`n"+$rootCert.ExportCertificatePem())
  [IO.File]::WriteAllText((Join-Path $StateDirectory 'server-key.pem'),$serverKey.ExportPkcs8PrivateKeyPem())
  # Ключ центра сертификации не сохраняется; доверие в систему не добавляется.
  [ordered]@{address=$LanAddress;expires=$expires.ToString('o');sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($rootCert.RawData))} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8
  $rootKey.Dispose();$serverKey.Dispose();$rootCert.Dispose();$serverCert.Dispose()
}
$caPath = Join-Path $StateDirectory 'kitsune-local-ca.cer'
$publicCa = [Security.Cryptography.X509Certificates.X509Certificate2]::new([IO.File]::ReadAllBytes($caPath))
try {
  $trustedHere = (Test-Path -LiteralPath ('Cert:\CurrentUser\Root\'+$publicCa.Thumbprint)) -or (Test-Path -LiteralPath ('Cert:\LocalMachine\Root\'+$publicCa.Thumbprint))
  Write-Host ('Сертификат: '+$publicCa.Subject+'; действует до '+$publicCa.NotAfter.ToString('yyyy-MM-dd HH:mm'))
  Write-Host ('SHA-256: '+[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($publicCa.RawData)))
  if (-not $trustedHere) { Write-Host 'На этом ПК сертификат пока не доверенный. Инструкция для ПК и телефонов: HTTPS_RU.txt' }
} finally { $publicCa.Dispose() }
if ($PrepareOnly) {
  Write-Host $(if ($reuse) { 'Существующий сертификат сохранён. Проверка подготовки пройдена.' } else { 'Новый сертификат подготовлен.' })
  return
}
Write-Host "ПК: http://127.0.0.1:8080/algebra8-course/"
Write-Host "Телефоны: https://${LanAddress}:8443/algebra8-course/"
Write-Host "Сертификат: http://${LanAddress}:8080/__kitsune/certificate.cer"
Write-Host 'Сертификат требуется установить вручную только на устройства проверки. Система доверия автоматически не меняется.'
$null = New-Item -ItemType Directory -Path $LogDirectory -Force
$LogDirectory = [IO.Path]::GetFullPath($LogDirectory)
$logPath = Join-Path $LogDirectory ('server-'+[DateTime]::Now.ToString('yyyyMMdd-HHmmss-fff')+'-'+[Guid]::NewGuid().ToString('N')+'.log')
Write-Host "Журнал запуска: $logPath"
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $nodePath = $nodeCommand.Source
} else {
  $installedNode = Join-Path $env:ProgramFiles 'nodejs\node.exe'
  $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  if (Test-Path -LiteralPath $installedNode) { $nodePath = $installedNode }
  elseif (Test-Path -LiteralPath $bundledNode) { $nodePath = $bundledNode }
  else { throw 'Node.js не найден. Для сервера нужен Node.js 22 или новее.' }
}
& $nodePath (Join-Path $PSScriptRoot 'server.cjs') --root (Join-Path $PSScriptRoot 'public') --tls-dir $StateDirectory --lan $LanAddress 2>&1 | Tee-Object -FilePath $logPath
$serverExitCode = $LASTEXITCODE
if ($serverExitCode -ne 0) { Write-Host "Сервер завершился с ошибкой. Подробности сохранены: $logPath" }
exit $serverExitCode
