"""One bounded download process. No shell, browser cookies, playlists or remote FFmpeg."""
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit
import urllib.request
from safety import MAX_BYTES, MAX_DURATION, install_network_guard, validate_url


def emit(value):
    print(json.dumps(value,ensure_ascii=True),flush=True)


def download_direct(url, directory):
    request=urllib.request.Request(url,headers={'User-Agent':'ManyTool/1.0'})
    with urllib.request.urlopen(request,timeout=20) as response:
        if urlsplit(response.url).scheme!='https': raise ValueError('보안 연결이 아닌 주소로 이동하는 링크입니다.')
        content_type=response.headers.get_content_type()
        if not (content_type.startswith('video/') or content_type=='application/octet-stream'):
            raise ValueError('영상 파일 주소가 아닙니다. MP4·WebM·MOV 파일 직접 링크를 입력해주세요.')
        size=int(response.headers.get('Content-Length','0'))
        if size>MAX_BYTES: raise ValueError('300MB 이하의 영상만 지원합니다.')
        extension=Path(urlsplit(url).path).suffix.lower()
        output=directory/('video'+extension)
        count=0
        with output.open('wb') as target:
            while True:
                block=response.read(64*1024)
                if not block: break
                count+=len(block)
                if count>MAX_BYTES: raise ValueError('300MB 이하의 영상만 지원합니다.')
                target.write(block)
        if not count: raise ValueError('빈 영상 파일입니다.')
    return {'title':Path(urlsplit(url).path).name[:150],'filename':output.name,'size':count,'duration':None}


def download_platform(url, directory):
    import yt_dlp
    from yt_dlp.downloader.external import FFmpegFD
    from yt_dlp.utils import DownloadError
    def no_remote_ffmpeg(*args,**kwargs):
        raise DownloadError('This stream requires an unsupported external downloader')
    FFmpegFD.real_download=no_remote_ffmpeg
    def policy(info, *, incomplete=False):
        if info.get('is_live') or info.get('live_status') in ('is_live','is_upcoming','post_live'):
            return 'Live streams are not supported'
        if info.get('has_drm'): return 'Protected video is not supported'
        if (info.get('duration') or 0)>MAX_DURATION: return 'Video exceeds 30 minute limit'
        if (info.get('age_limit') or 0)>0: return 'Age restricted video is not supported'
        if info.get('availability') not in (None,'public','unlisted'): return 'Restricted video is not supported'
        if (info.get('filesize') or 0)>MAX_BYTES: return 'Video exceeds 300 MB limit'
    def progress(data):
        if sum(f.stat().st_size for f in directory.iterdir() if f.is_file())>MAX_BYTES*2:
            raise DownloadError('Video exceeds storage limit')
        if data.get('downloaded_bytes',0)>MAX_BYTES: raise DownloadError('Video exceeds 300 MB limit')
    class QuietLogger:
        def debug(self,*args): pass
        def warning(self,*args): pass
        def error(self,*args): pass
    options={
        'outtmpl':str(directory/'video.%(ext)s'),'noplaylist':True,'playlistend':1,
        'format':'bv[height<=720][ext=mp4][protocol=https]+ba[ext=m4a][protocol=https]/b[height<=720][ext=mp4]/b[height<=720]/b[height<=?720]',
        'merge_output_format':'mp4','max_filesize':MAX_BYTES,'match_filter':policy,
        'socket_timeout':20,'retries':1,'fragment_retries':1,'extractor_retries':1,
        'concurrent_fragment_downloads':1,'hls_prefer_native':True,'fixup':'never',
        'writethumbnail':False,'writesubtitles':False,'writeinfojson':False,'cachedir':False,
        'logger':QuietLogger(),'progress_hooks':[progress],'js_runtimes':{'node':{}},
        'remote_components':set(),'proxy':'','noprogress':True,
    }
    with yt_dlp.YoutubeDL(options) as downloader:
        info=downloader.extract_info(url,download=False)
        if not info or info.get('_type') in ('playlist','multi_video') or 'entries' in info:
            raise ValueError('여러 영상 묶음은 지원하지 않습니다. 영상 하나의 링크를 입력해주세요.')
        reason=policy(info)
        if reason:
            if '30 minute' in reason: raise ValueError('30분 이하의 영상만 지원합니다.')
            if '300 MB' in reason: raise ValueError('300MB 이하의 영상만 지원합니다.')
            raise ValueError('로그인·연령·유료·DRM 제한 또는 생방송 영상은 지원하지 않습니다.')
        info['formats']=[f for f in info.get('formats',[]) if f.get('protocol') in ('https','http','m3u8_native','http_dash_segments') and not f.get('has_drm')]
        downloader.process_ie_result(info,download=True)
    files=[p for p in directory.iterdir() if p.suffix.lower() in ('.mp4','.webm','.mkv','.mov','.m4v') and '.f' not in p.stem]
    if len(files)!=1 or not 0<files[0].stat().st_size<=MAX_BYTES:
        raise ValueError('이 영상은 지원되는 크기·형식으로 저장할 수 없습니다.')
    return {'title':str(info.get('title') or '영상')[:150],'filename':files[0].name,'size':files[0].stat().st_size,'duration':info.get('duration')}


if __name__=='__main__':
    try:
        payload=json.loads(sys.stdin.read(4096))
        url=validate_url(payload.get('url'),payload.get('platform'))
        directory=Path(sys.argv[1]).resolve()
        install_network_guard()
        result=download_direct(url,directory) if payload['platform']=='direct' else download_platform(url,directory)
        emit({'status':'ready',**result})
    except ValueError as error:
        emit({'status':'failed','message':str(error)})
        sys.exit(1)
    except Exception:
        emit({'status':'failed','message':'영상을 가져오지 못했습니다. 공개 여부와 링크를 확인해주세요. 원본 사이트의 로그인·지역·자동접근 제한이 있는 영상은 지원되지 않습니다.'})
        sys.exit(1)
