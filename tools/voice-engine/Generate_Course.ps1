param([ValidateRange(0,10000)][int]$Limit = 3, [string]$EngineDirectory = (Join-Path $env:USERPROFILE 'Kitsune-Qwen-Voice'), [switch]$PlanOnly)
$ErrorActionPreference='Stop'
$projectDirectory=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pythonExecutable=Join-Path $EngineDirectory '.venv\Scripts\python.exe'
$referenceFile=Join-Path $EngineDirectory 'voices\kitsune_master_v1.wav'
$cacheDirectory=Join-Path $env:USERPROFILE '.cache\huggingface\hub\models--siriusfreak--qwen3-tts-12hz-1.7b-ru-stress-cf'
$modelRevision=(Get-Content -LiteralPath (Join-Path $cacheDirectory 'refs\main') -Raw).Trim()
if($modelRevision -notmatch '^[a-f0-9]{40}$'){throw 'Не найден корректный сохранённый снимок модели.'}
$modelDirectory=Join-Path $cacheDirectory ('snapshots\'+$modelRevision)
if(!(Test-Path -LiteralPath $pythonExecutable)){throw 'Окружение Kitsune-Qwen-Voice не найдено.'}
$nodeExecutable=(Get-Command node -ErrorAction SilentlyContinue).Source
if(!$nodeExecutable){$nodeExecutable=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
if(!(Test-Path -LiteralPath $nodeExecutable)){throw 'Node.js не найден.'}
$previousValues=@{}
$variables=@{PYTHONDONTWRITEBYTECODE='1';PYTHONIOENCODING='utf-8';HF_HUB_OFFLINE='1';TRANSFORMERS_OFFLINE='1';HF_HUB_DISABLE_TELEMETRY='1';NUMBA_CACHE_DIR=(Join-Path $projectDirectory '.generation-cache')}
foreach($name in $variables.Keys){$previousValues[$name]=[Environment]::GetEnvironmentVariable($name,'Process');[Environment]::SetEnvironmentVariable($name,$variables[$name],'Process')}
Push-Location -LiteralPath $projectDirectory
$generationMutex=[Threading.Mutex]::new($false,'Local\KitsuneCourseGeneratorV05')
$generationLock=$false
try{
 try{$generationLock=$generationMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$generationLock=$true}
 if(!$generationLock){throw 'Генератор уже работает. Дождитесь завершения текущего запуска.'}
 & $nodeExecutable tools/voice-engine/export-course-texts.cjs --write
 if($LASTEXITCODE -ne 0){throw 'Не удалось прочитать актуальные тексты курса.'}
 $arguments=@('-u','tools/voice-engine/generate_course_pack_v05.py','--reference',$referenceFile,'--model-directory',$modelDirectory,'--limit',[string]$Limit)
 if($PlanOnly){$arguments+='--plan-only'}
 & $pythonExecutable @arguments
 if($LASTEXITCODE -ne 0){throw 'Генерация остановлена. Готовые WAV сохранены; повторный запуск продолжит работу.'}
 if(!$PlanOnly){
  & $nodeExecutable tools/voice-engine/verify-course-pack.cjs --write
  if($LASTEXITCODE -ne 0){throw 'Индекс не обновлён: проверка пакета не пройдена.'}
  & $nodeExecutable tools/voice-engine/activate-course-pack.cjs
  if($LASTEXITCODE -ne 0){throw 'Не удалось подготовить новую оболочку. Проверьте сообщение выше.'}
 }
 Write-Host 'Готово. WAV v0.4, эталон и утверждённый словарь сохранены.'
}finally{
 if($generationLock){$generationMutex.ReleaseMutex()}
 $generationMutex.Dispose()
 Pop-Location
 foreach($name in $variables.Keys){[Environment]::SetEnvironmentVariable($name,$previousValues[$name],'Process')}
}
