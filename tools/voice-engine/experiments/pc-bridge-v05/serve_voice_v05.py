"""Отдельный локальный TTS. Только loopback; доступ телефонов через тестовый сервер."""
import argparse,hashlib,json,os,re,threading,time
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from course_pronunciation_v05 import prepare_course_text,split_course_text
from generate_course_pack_v05 import REF_TEXT,MODEL_ID,SEEDS

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--reference',type=Path,required=True)
    parser.add_argument('--model-directory',type=Path,required=True)
    parser.add_argument('--cache-directory',type=Path,required=True)
    parser.add_argument('--port',type=int,default=8845)
    parser.add_argument('--approved-manifest',type=Path)
    parser.add_argument('--smoke-text')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[2]
    pilot=json.loads((args.approved_manifest or root/'assets/voice/pilot_v04/manifest.json').read_text(encoding='utf-8-sig'))
    reference_hash=hashlib.sha256(args.reference.read_bytes()).hexdigest()
    if reference_hash!=pilot['reference_sha256']:raise ValueError('Эталон отличается от v0.4')
    args.cache_directory.mkdir(parents=True,exist_ok=True)
    os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',NUMBA_CACHE_DIR=str(args.cache_directory/'numba'))
    status={'ready':False,'error':'','engine':'kitsune-qwen-v05'}
    cancelled=set();cancel_lock=threading.Lock();generation_lock=threading.Lock()
    model=prompt=None
    def initialize():
        nonlocal model,prompt
        try:
            import torch
            from qwen_tts import Qwen3TTSModel
            if not torch.cuda.is_available():raise RuntimeError('CUDA недоступна')
            model=Qwen3TTSModel.from_pretrained(str(args.model_directory),device_map='cuda:0',dtype=torch.bfloat16,attn_implementation='sdpa')
            prompt=model.create_voice_clone_prompt(ref_audio=str(args.reference),ref_text=REF_TEXT,x_vector_only_mode=False)
            status['ready']=True;print('Голос Kitsune готов для новых фраз.',flush=True)
        except Exception as error:
            status['error']=str(error);print('Ошибка подготовки голоса:',error,flush=True)
    def is_cancelled(job):
        with cancel_lock:return job in cancelled
    def generate(text,job):
        import numpy as np,torch,soundfile as sf
        records=[]
        for piece in split_course_text(text):
            if is_cancelled(job):raise InterruptedError('Чтение отменено')
            prepared=prepare_course_text(piece)
            signature=hashlib.sha256(json.dumps({'text':prepared,'reference':reference_hash,'model':MODEL_ID,'version':'dynamic-v05.1'},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
            file=args.cache_directory/(signature+'.wav')
            info_file=args.cache_directory/(signature+'.json')
            def inspect(candidate):
                audio,rate=sf.read(str(candidate),dtype='float32')
                duration=len(audio)/rate
                if rate<16000 or duration<max(.8,.16*len(prepared.split())) or not np.isfinite(audio).all() or float(np.sqrt(np.mean(audio**2)))<.0025 or float(np.max(np.abs(audio)))<.02:raise ValueError('Модель вернула пустой или слишком тихий звук')
                return {'audio':signature+'.wav','sha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'duration_seconds':duration,'text':piece,'pause_after_ms':300}
            record=None
            if file.exists() and info_file.exists():
                try:
                    check=inspect(file);stored=json.loads(info_file.read_text(encoding='utf-8'))
                    if check['sha256']==stored['sha256']:record=check
                except Exception:pass
            if not record:
                modes=[False,True] if len(prepared)<50 else [True,False]
                temporary=file.with_suffix('.partial.wav')
                for mode in modes:
                    for seed in SEEDS:
                        if is_cancelled(job):raise InterruptedError('Чтение отменено')
                        torch.manual_seed(seed);torch.cuda.manual_seed_all(seed)
                        with torch.inference_mode():
                            wavs,rate=model.generate_voice_clone(text=prepared,language='Russian',voice_clone_prompt=prompt,temperature=.65,top_p=.85,non_streaming_mode=mode)
                        sf.write(str(temporary),wavs[0],rate,subtype='PCM_16');del wavs
                        try:record=inspect(temporary)
                        except ValueError:continue
                        os.replace(temporary,file);info_file.write_text(json.dumps(record,ensure_ascii=False),encoding='utf-8');break
                    if record:break
                if temporary.exists():temporary.unlink()
                if not record:raise ValueError('Не удалось создать исправную запись Kitsune')
            records.append(record)
        if is_cancelled(job):raise InterruptedError('Чтение отменено')
        return {'engine':'kitsune-qwen-v05','segments':records}
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def json_response(self,code,value):
            data=json.dumps(value,ensure_ascii=False).encode('utf-8')
            try:
                self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
            except (BrokenPipeError,ConnectionResetError):pass
        def do_GET(self):
            if self.path=='/health':return self.json_response(200,status)
            if not re.fullmatch(r'/audio/[a-f0-9]{64}\.wav',self.path):return self.json_response(404,{'error':'Адрес не найден'})
            file=args.cache_directory/self.path.rsplit('/',1)[-1]
            try:data=file.read_bytes()
            except FileNotFoundError:return self.json_response(404,{'error':'Запись не найдена'})
            self.send_response(200);self.send_header('Content-Type','audio/wav');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        def do_POST(self):
            try:
                if self.headers.get('Origin'):return self.json_response(403,{'error':'Используйте локальное приложение Kitsune'})
                if not self.headers.get('Content-Type','').startswith('application/json'):return self.json_response(415,{'error':'Требуется JSON'})
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=24000:raise ValueError('Неверная длина запроса')
                body=json.loads(self.rfile.read(length))
                job=body.get('job','')
                if not re.fullmatch(r'[a-f0-9]{32}',job):raise ValueError('Неверный идентификатор чтения')
                if self.path=='/cancel':
                    with cancel_lock:
                        if len(cancelled)>200:cancelled.clear()
                        cancelled.add(job)
                    return self.json_response(200,{'ok':True})
                if self.path!='/speak':return self.json_response(404,{'error':'Адрес не найден'})
                text=body.get('text','')
                if not isinstance(text,str) or not text.strip() or len(text)>6000:raise ValueError('Текст должен содержать от 1 до 6000 символов')
                if not status['ready']:return self.json_response(503,{'error':status['error'] or 'Генератор голоса ещё загружается'})
                if not generation_lock.acquire(timeout=1):return self.json_response(503,{'error':'Генератор занят; дождитесь завершения текущей фразы','busy':True})
                try:result=generate(text,job)
                finally:generation_lock.release()
                return self.json_response(200,result)
            except InterruptedError:return self.json_response(409,{'error':'Чтение отменено'})
            except Exception as error:return self.json_response(400,{'error':str(error)})
    if args.smoke_text:
        initialize()
        if not status['ready']:raise RuntimeError(status['error'])
        result=generate(args.smoke_text,'0'*32)
        print(json.dumps(result,ensure_ascii=False),flush=True);return
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    threading.Thread(target=initialize,daemon=True).start()
    print(f'Локальный генератор Kitsune: 127.0.0.1:{args.port}. Модель загружается…',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':main()
