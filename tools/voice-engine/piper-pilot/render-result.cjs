/* Собирает отдельный результат для прослушивания; ничего не подключает к PWA. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [rootArg,outputArg]=process.argv.slice(2);assert(rootArg&&outputArg);
const root=path.resolve(rootArg),output=path.resolve(outputArg),latest=JSON.parse(fs.readFileSync(path.join(root,'latest-result.json'),'utf8'));
assert(/^results[\\/][A-Za-z0-9-]+$/.test(latest.result));assert(!fs.existsSync(output),'Предыдущая проба сохраняется');
const run=path.join(root,latest.result),audition=path.join(run,'audition');
const native=JSON.parse(fs.readFileSync(path.join(audition,'audition.json'),'utf8'));
const wasm=JSON.parse(fs.readFileSync(path.join(audition,'wasm/benchmark.json'),'utf8'));
const parity=JSON.parse(fs.readFileSync(path.join(audition,'export-validation.json'),'utf8'));
const status=JSON.parse(fs.readFileSync(path.join(run,'status.json'),'utf8'));
assert.equal(status.status,'candidate_ready_for_listening');assert.equal(parity.status,'pytorch_onnx_parity_passed');
assert.equal(native.model_sha256,wasm.model_sha256);assert.equal(native.model_sha256,parity.model_sha256);
fs.mkdirSync(output,{recursive:true});for(const dir of ['audio','audio-wasm','model','reports','reference'])fs.mkdirSync(path.join(output,dir));
const copied=[];
function copy(source,target,expected){
  const bytes=fs.readFileSync(source),sha=crypto.createHash('sha256').update(bytes).digest('hex');if(expected)assert.equal(sha,expected);
  fs.writeFileSync(path.join(output,target),bytes);copied.push({file:target,bytes:bytes.length,sha256:sha});
}
for(const r of native.records){assert(/^[A-Za-z0-9_-]+\.wav$/.test(r.file));copy(path.join(audition,r.file),'audio/'+r.file,r.sha256);}
for(const r of wasm.records){assert(/^[A-Za-z0-9_-]+\.wav$/.test(r.file));copy(path.join(audition,'wasm',r.file),'audio-wasm/'+r.file,r.sha256);}
copy(path.join(audition,'kitsune.onnx'),'model/kitsune.onnx',native.model_sha256);
copy(path.join(audition,'kitsune.onnx.json'),'model/kitsune.onnx.json');
copy(path.join(audition,'audition.json'),'reports/native.json');copy(path.join(audition,'wasm/benchmark.json'),'reports/wasm.json');
copy(path.join(audition,'export-validation.json'),'reports/export-validation.json');copy(path.join(run,'status.json'),'reports/training.json');
copy(path.join(root,'local-work/runtime-validation.json'),'reports/runtime-validation.json');
copy(path.join(root,'local-work/verified-versions.json'),'reports/versions.json');
copy(path.join(root,'local-work/downloads/MODEL_CARD'),'reports/BASE_MODEL_CARD.txt');
copy(path.join(root,'local-work/piper-source/COPYING'),'reports/PIPER_COPYING.txt');
const source=JSON.parse(fs.readFileSync(path.join(root,'input/dataset.json'),'utf8'));
const heldout=source.records.find(r=>r.id===native.records.find(r=>r.reference_id).reference_id);
const approved=source.records.find(r=>r.id.startsWith('pilot_v04_fractions_002'));
for(const [label,r] of [['heldout',heldout],['approved',approved]])copy(path.join(root,'input/wav',r.id+'.wav'),'reference/'+label+'.wav',r.sha256);
const titles=['Приветствие','Первый шаг','Правильный ответ','Исправление ошибки','Разговор','Математические ударения','Проверочная тема'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=native.records.map((r,i)=>`<article><h2>${titles[i]}</h2><p>${escape(r.text)}</p><audio controls preload="none" src="audio/${r.file}"></audio><details><summary>Проба через WASM</summary><audio controls preload="none" src="audio-wasm/${r.file}"></audio></details></article>`).join('');
fs.writeFileSync(path.join(output,'Послушать.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Новый голос Китсуне — Piper</title><style>body{font:17px system-ui;max-width:880px;margin:auto;padding:24px;background:#fff8f0;color:#41291e}h1{font-size:28px}h2{font-size:20px;margin-top:0}article,.reference{padding:20px;margin:18px 0;background:#fff;border:1px solid #f5bf97;border-radius:18px}audio{width:100%;max-width:500px}summary{cursor:pointer;margin:10px 0;color:#925120}p{line-height:1.5}.note{color:#6d5547;font-size:15px}</style><h1>Новый голос Китсуне: проба Piper</h1><p>Обучение завершено. Послушайте новые фразы и сравните голос с сохранённой записью Китсуне.</p><div class="reference"><h2>Наш сохранённый голос</h2><p>${escape(approved.spoken_text)}</p><audio controls preload="none" src="reference/approved.wav"></audio><details><summary>Исходная запись проверочной темы</summary><p>${escape(heldout.spoken_text)}</p><audio controls preload="none" src="reference/heldout.wav"></audio></details></div>${rows}<p class="note">Здесь воспроизводятся готовые пробы. Приветствие сгенерировано за 0,15 с на CPU и за 0,93 с через WASM в Node V8 на этом ПК. Подготовка фонем и загрузка модели не входят в WASM-замер. Браузеры и телефоны ещё не проверены. Действующее приложение сохраняет прежнюю озвучку.</p><script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script></html>`,'utf8');
const report={status:'trained_candidate_listening_pending',run:latest.result,model_bytes:native.model_bytes,
  epochs:status.epochs_completed,optimizer_updates:status.global_step,training_seconds:status.training_seconds,
  native_greeting_seconds:native.records[0].generation_seconds,wasm_greeting_seconds:wasm.records[0].generation_seconds,
  Android:'not_tested',iOS:'not_tested',PC_browser:'not_tested',production_modified:false,
  reference_sha256:status.settings.reference_sha256,files:copied};
fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(output,'README_RU.txt'),`KITSUNE — ПЕРВАЯ ОБУЧЕННАЯ ПРОБА PIPER\n\nОткройте Послушать.html. Вверху — утверждённая запись выбранного голоса,\nдалее — семь новых фраз после обучения. Сходство и качество ожидают прослушивания.\nМодель обучалась только на отдельной копии короткого корпуса.\n\nОбучение: ${status.epochs_completed} эпох, ${status.global_step} обновлений двух оптимизаторов,\n${status.training_seconds.toFixed(1)} секунды на RTX 5050. ONNX: ${native.model_bytes.toLocaleString('ru-RU')} байт.\nПриветствие: 0,147 с на CPU, 0,925 с через ONNX Runtime Web 1.22 WASM в Node V8.\nWASM работал в один поток, без сети; фонемы уже подготовлены.\nЭто не результат реального браузера или телефона.\n\nmodel — ONNX и его собственный конфиг. Прежняя таблица ID сохранена.\nreports — фактические отчёты, контроль экспорта, версии и исходные лицензии.\nreference — неизменные WAV; heldout относится к пакету курса с прослушиванием pending.\naudio/audio-wasm — новые WAV, созданные собственным обученным кандидатом.\n\nЭкспорт проверен по сигналу против PyTorch на короткой, обычной и длинной\nфразе (11, 23, 257 ID): длины совпадают, максимальная ошибка около 0,00001.\nЭта техническая проверка не оценивает красоту или сходство голоса.\n\nМодель пока предназначена для локального эксперимента: в карточке исходного\ncheckpoint Dataset License указан Unknown; публичное распространение ещё\nне подготовлено. Никакого переключения PWA, публикации или изменения\nстарых WAV, словаря, настроек и офлайн-кэша не выполнено.\n`,'utf8');
console.log(JSON.stringify({output,status:report.status,files:copied.length,model_bytes:native.model_bytes}));
