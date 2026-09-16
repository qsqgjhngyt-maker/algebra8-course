#!/usr/bin/env python3
import http.server, socketserver, socket, argparse, os, json, hashlib, re, time
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

parser=argparse.ArgumentParser(description="Kitsune Math local LAN server")
parser.add_argument("--port",type=int,default=8080)
args=parser.parse_args()

ROOT=Path(__file__).resolve().parent
os.chdir(ROOT)
STATUS_FILE=ROOT/"curriculum-status.json"
CHECK_TTL_SECONDS=24*60*60

SOURCES=[
    {"id":"frp-5-9","url":"https://edsoo.ru/rabochie-programmy/","kind":"school"},
    {"id":"frp-10-11","url":"https://edsoo.ru/rabochie-programmy/","kind":"school"},
    {"id":"edsoo-method","url":"https://edsoo.ru/mr-matematika/","kind":"school"},
    {"id":"oge-2027","url":"https://fipi.ru/oge/demoversii-specifikacii-kodifikatory","kind":"exam"},
    {"id":"ege-2027","url":"https://fipi.ru/ege/demoversii-specifikacii-kodifikatory","kind":"exam"},
]

def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")

def read_status():
    try:
        return json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"schema":1,"checkedAt":None,"sources":{}}

def save_status(data):
    tmp=STATUS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    tmp.replace(STATUS_FILE)

def is_fresh(status):
    checked=status.get("checkedAt")
    if not checked:return False
    try:
        dt=datetime.fromisoformat(checked)
        if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
        return (datetime.now(dt.tzinfo)-dt).total_seconds()<CHECK_TTL_SECONDS
    except Exception:
        return False

def html_text(raw):
    txt=raw.decode("utf-8","ignore")
    txt=re.sub(r"(?is)<script.*?</script>"," ",txt)
    txt=re.sub(r"(?is)<style.*?</style>"," ",txt)
    txt=re.sub(r"(?s)<[^>]+>"," ",txt)
    return re.sub(r"\s+"," ",txt).strip()

def check_url(url):
    req=Request(url,headers={
        "User-Agent":"Mozilla/5.0 KitsuneCurriculumChecker/3.1",
        "Accept":"text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
        "Accept-Language":"ru-RU,ru;q=0.9,en;q=0.6",
        "Cache-Control":"no-cache",
    })
    started=time.time()
    with urlopen(req,timeout=6) as response:
        raw=response.read(2_500_000)
        ctype=response.headers.get("Content-Type","")
        text=html_text(raw) if "html" in ctype.lower() else ""
        etag=response.headers.get("ETag")
        modified=response.headers.get("Last-Modified")
        body_hash=hashlib.sha256(raw).hexdigest()
        fingerprint=(etag or modified or body_hash).strip()
        lower=text.lower()
        return {
            "ok":True,
            "httpStatus":getattr(response,"status",200),
            "finalUrl":response.geturl(),
            "contentType":ctype,
            "etag":etag,
            "lastModified":modified,
            "fingerprint":fingerprint,
            "fingerprintType":"etag" if etag else ("last-modified" if modified else "sha256"),
            "marker":{
                "mentions2027":"2027" in lower,
                "mentionsProject":("проект" in lower) or ("project" in lower),
            },
            "elapsedMs":round((time.time()-started)*1000),
        }

def refresh_status(force=False):
    previous=read_status()
    if not force and is_fresh(previous):
        cached=dict(previous)
        cached["fromCache"]=True
        return cached

    prev_sources=previous.get("sources") or {}
    url_cache={}
    results={}
    success=0
    changed=0

    for source in SOURCES:
        sid,url=source["id"],source["url"]
        if url not in url_cache:
            try:
                url_cache[url]=check_url(url)
            except HTTPError as e:
                url_cache[url]={"ok":False,"error":f"HTTP {e.code}","httpStatus":e.code}
            except URLError as e:
                url_cache[url]={"ok":False,"error":f"Сеть: {e.reason}"}
            except Exception as e:
                url_cache[url]={"ok":False,"error":str(e)}

        item=dict(url_cache[url])
        item.update({"id":sid,"url":url,"kind":source["kind"]})
        prev=(prev_sources.get(sid) or {})
        prev_fp,new_fp=prev.get("fingerprint"),item.get("fingerprint")
        item["changedSincePreviousSuccessfulCheck"]=bool(
            item.get("ok") and prev_fp and new_fp and prev_fp!=new_fp
        )
        if item["changedSincePreviousSuccessfulCheck"]:changed+=1
        if item.get("ok"):success+=1
        results[sid]=item

    data={
        "schema":1,
        "appVersion":"3.1.0-alpha.6-WORK",
        "checkedAt":now_iso(),
        "mode":"online-check",
        "successCount":success,
        "totalCount":len(SOURCES),
        "changedCount":changed,
        "allReachable":success==len(SOURCES),
        "fromCache":False,
        "sources":results,
    }
    # Keep the last check even if some sources are temporarily unavailable.
    save_status(data)
    return data

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control","no-store, max-age=0")
        super().end_headers()

    def send_json(self,obj,status=200):
        payload=json.dumps(obj,ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(payload)))
        self.send_header("Cache-Control","no-store, max-age=0")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed=urlparse(self.path)
        if parsed.path=="/api/curriculum-status":
            force=parse_qs(parsed.query).get("force",["0"])[0] in ("1","true","yes")
            try:
                self.send_json(refresh_status(force=force))
            except Exception as e:
                fallback=read_status()
                fallback["apiError"]=str(e)
                self.send_json(fallback,200)
            return
        super().do_GET()

def local_ips():
    found=[]
    try:
        host=socket.gethostname()
        for item in socket.getaddrinfo(host,None,socket.AF_INET):
            ip=item[4][0]
            if not ip.startswith("127.") and ip not in found:found.append(ip)
    except Exception:pass
    if not found:
        try:
            s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
            s.connect(("8.8.8.8",80))
            found.append(s.getsockname()[0])
            s.close()
        except Exception:pass
    return found

socketserver.TCPServer.allow_reuse_address=True
with socketserver.ThreadingTCPServer(("0.0.0.0",args.port),Handler) as httpd:
    print("\nKitsune Math LOCAL запущен")
    print(f"На этом ПК: http://127.0.0.1:{args.port}/")
    for ip in local_ips():print(f"В локальной сети: http://{ip}:{args.port}/")
    print("\nНормативная база: /api/curriculum-status")
    print("Автопроверка: не чаще 1 раза в 24 часа.")
    print("Ручная кнопка выполняет принудительную проверку.")
    print("\nВажно: для микрофона/PWA на iPhone браузер может потребовать HTTPS.")
    print("Для проверки интерфейса HTTP подходит.")
    print("Остановить сервер: Ctrl+C\n")
    httpd.serve_forever()
