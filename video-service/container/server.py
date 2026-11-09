import json
import os
import re
import secrets
import signal
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from safety import MAX_BYTES, PLATFORMS, validate_url

ROOT=Path(os.environ.get('VIDEO_TEMP_DIR',str(Path(tempfile.gettempdir())/'manytool-video'))).resolve()
ROOT.mkdir(parents=True,exist_ok=True)
LOCK=threading.RLock()
JOBS={}
LIMIT=2
TIMEOUT=180
TTL=600


def clean():
    with LOCK:
        for token,job in list(JOBS.items()):
            if job['state'] in ('ready','failed') and job['expires']<time.time() and not job.get('readers',0):
                shutil.rmtree(job['directory'],ignore_errors=True)
                del JOBS[token]


def terminate(process):
    if process.poll() is not None:return
    if os.name=='posix':os.killpg(process.pid,signal.SIGKILL)
    else:subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


def perform(token,payload):
    job=JOBS[token]
    process=None
    try:
        env={k:v for k,v in os.environ.items() if k.upper() in ('PATH','SYSTEMROOT','WINDIR','TEMP','TMP','LANG','SSL_CERT_FILE','REQUESTS_CA_BUNDLE')}
        env['PYTHONIOENCODING']='utf-8'
        process=subprocess.Popen([sys.executable,str(Path(__file__).with_name('runner.py')),str(job['directory'])],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=env,start_new_session=os.name=='posix')
        with LOCK: job['process']=process
        output,_=process.communicate(json.dumps(payload).encode(),timeout=TIMEOUT)
        if len(output)>65536: raise ValueError('Invalid result')
        result=json.loads(output.decode().strip().splitlines()[-1])
        with LOCK:
            if result.get('status')=='ready' and process.returncode==0:
                filename=result.get('filename','')
                target=(job['directory']/filename).resolve()
                if target.parent!=job['directory'] or not target.is_file() or not 0<target.stat().st_size<=MAX_BYTES: raise ValueError('Invalid output')
                job.update(state='ready',file=target,title=result.get('title','영상'),size=target.stat().st_size,extension=target.suffix[1:],duration=result.get('duration'))
            else: job.update(state='failed',message=result.get('message','영상 처리에 실패했습니다.'),diagnostic=result.get('diagnostic'))
    except subprocess.TimeoutExpired:
        terminate(process);process.communicate()
        with LOCK:job.update(state='failed',message='처리 제한 시간(3분)을 초과했습니다. 더 짧은 영상을 사용해주세요.')
    except Exception as error:
        print(json.dumps({'event':'download_job_error','type':type(error).__name__,'detail':str(error)}),flush=True)
        with LOCK:job.update(state='failed',message='영상 처리에 실패했습니다. 잠시 후 다시 시도해주세요.')
    finally:
        with LOCK:
            if job['state']=='processing': job.update(state='failed',message='작업이 취소되었습니다.')
            job['expires']=time.time()+TTL
            job.pop('process',None)
            if job['state']=='failed': shutil.rmtree(job['directory'],ignore_errors=True)


def maintenance():
    while True:
        time.sleep(15)
        clean()
        with LOCK:
            for job in JOBS.values():
                if job['state']=='processing':
                    size=sum(p.stat().st_size for p in job['directory'].glob('*') if p.is_file())
                    if size>MAX_BYTES*2 and job.get('process'):terminate(job['process'])


class Handler(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,*args):pass
    def reply(self,status,data):
        data['serviceVersion']='tiktok-20261109-3'
        body=json.dumps(data,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers();self.wfile.write(body)
    def do_POST(self):
        if self.path!='/jobs':return self.reply(404,{'error':'Not found'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size<1 or size>4096:return self.reply(413,{'error':'요청이 너무 큽니다.'})
            if self.headers.get_content_type()!='application/json':return self.reply(415,{'error':'JSON 요청만 지원합니다.'})
            data=json.loads(self.rfile.read(size))
            if not isinstance(data,dict):raise ValueError('올바른 요청을 보내주세요.')
            url=validate_url(data.get('url'),data.get('platform'))
        except (ValueError,TypeError):return self.reply(400,{'error':'지원되는 서비스의 HTTPS 영상 단건 링크를 입력해주세요.'})
        clean()
        with LOCK:
            if sum(j['state']=='processing' for j in JOBS.values())>=LIMIT:
                return self.reply(429,{'error':'현재 처리 중인 영상이 많습니다. 잠시 후 다시 시도해주세요.'})
            storage=sum(p.stat().st_size for p in ROOT.glob('*/*') if p.is_file())
            if storage>MAX_BYTES*2 or len(JOBS)>=30:
                return self.reply(429,{'error':'임시 저장 공간이 사용 중입니다. 잠시 후 다시 시도해주세요.'})
            token=secrets.token_urlsafe(32)
            directory=ROOT/token;directory.mkdir()
            JOBS[token]={'state':'processing','directory':directory,'expires':time.time()+TIMEOUT+TTL}
            threading.Thread(target=perform,args=(token,{'url':url,'platform':data['platform']}),daemon=True).start()
        self.reply(202,{'id':token,'state':'processing','pollAfter':3})
    def do_GET(self):
        path=urlsplit(self.path).path
        if path=='/health':return self.reply(200,{'ready':True,'platforms':sorted(PLATFORMS),'maxBytes':MAX_BYTES,'maxDuration':1800})
        match=re.fullmatch(r'/jobs/([A-Za-z0-9_-]{43})(/file)?',path)
        if not match:return self.reply(404,{'error':'Not found'})
        clean()
        with LOCK:
            job=JOBS.get(match[1])
            if not job:return self.reply(404,{'error':'작업이 만료되었거나 서버가 다시 시작되었습니다. 링크를 다시 입력해주세요.'})
            if not match[2]:
                data={k:job[k] for k in ('state','title','size','extension','duration','message','diagnostic') if k in job}
                data['expiresAt']=int(job['expires']*1000)
                return self.reply(200,data)
            if job['state']!='ready':return self.reply(409,{'error':'아직 다운로드할 수 없습니다.'})
            if job.get('readers',0)>=2:return self.reply(429,{'error':'이미 다운로드 중입니다.'})
            job['readers']=job.get('readers',0)+1
        try:
            self.send_response(200)
            self.send_header('Content-Type','application/octet-stream')
            self.send_header('Content-Length',str(job['size']))
            self.send_header('Content-Disposition',f'attachment; filename="manytool-video.{job["extension"]}"')
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.end_headers()
            with job['file'].open('rb') as source:shutil.copyfileobj(source,self.wfile,length=64*1024)
        except (BrokenPipeError,ConnectionResetError):pass
        finally:
            with LOCK:job['readers']-=1


if __name__=='__main__':
    # No completed files survive a restart; links explicitly expire rather than pointing to stale data.
    for child in ROOT.iterdir():
        if child.is_dir() and re.fullmatch(r'[A-Za-z0-9_-]{43}',child.name):shutil.rmtree(child,ignore_errors=True)
    threading.Thread(target=maintenance,daemon=True).start()
    ThreadingHTTPServer((os.environ.get('HOST','127.0.0.1'),int(os.environ.get('PORT','8080'))),Handler).serve_forever()
