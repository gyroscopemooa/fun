import ipaddress
import re
import socket
from urllib.parse import urlsplit, parse_qs, urlunsplit

MAX_BYTES = 300 * 1024 * 1024
MAX_DURATION = 30 * 60
PLATFORMS = {'youtube', 'youtube-shorts', 'tiktok', 'instagram', 'instagram-reels', 'chzzk', 'chzzk-clips', 'soop', 'soop-clips', 'soop-catch', 'vimeo', 'twitch', 'twitch-clips', 'naver-tv', 'dailymotion', 'direct'}


def public_ip(value):
    try:
        ip = ipaddress.ip_address(value.split('%')[0])
        if getattr(ip, 'ipv4_mapped', None):
            ip = ip.ipv4_mapped
        return ip.is_global and not ip.is_multicast and not ip.is_reserved
    except ValueError:
        return False


def validate_url(value, platform):
    if not isinstance(platform, str) or platform not in PLATFORMS or not isinstance(value, str) or len(value) > 2048:
        raise ValueError('올바른 영상 링크와 서비스를 선택해주세요.')
    value = value.strip()
    try:
        url = urlsplit(value)
        host = (url.hostname or '').lower().rstrip('.')
        port = url.port
    except ValueError:
        raise ValueError('올바른 영상 링크를 입력해주세요.')
    if url.scheme != 'https' or not host or url.username or url.password or port not in (None, 443):
        raise ValueError('로그인 정보가 없는 HTTPS 영상 링크만 지원합니다.')
    if re.search(r'[\x00-\x20\\]', value) or host in ('localhost', 'metadata.google.internal') or host.endswith(('.localhost', '.local', '.internal')):
        raise ValueError('공개 영상 주소를 입력해주세요.')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        if '.' not in host: raise ValueError('공개 영상 주소를 입력해주세요.')
    else:
        if not public_ip(host): raise ValueError('내부 네트워크 주소는 사용할 수 없습니다.')
    path = url.path
    if platform in ('chzzk', 'chzzk-clips') and host == 'm.chzzk.naver.com':
        host = 'chzzk.naver.com'
        value = urlunsplit(('https', host, path, url.query, ''))
    valid = False
    if platform in ('youtube', 'youtube-shorts'):
        valid = (host in ('youtube.com','www.youtube.com','m.youtube.com') and
                 (bool(re.fullmatch(r'/shorts/[A-Za-z0-9_-]{11}/?',path)) or
                  (platform == 'youtube' and path == '/watch' and bool(re.fullmatch(r'[A-Za-z0-9_-]{11}',parse_qs(url.query).get('v',[''])[0])))))
        valid |= platform == 'youtube' and host == 'youtu.be' and bool(re.fullmatch(r'/[A-Za-z0-9_-]{11}/?',path))
    elif platform == 'tiktok':
        valid = host in ('www.tiktok.com','tiktok.com') and bool(re.fullmatch(r'/@[^/]+/video/\d+/?',path))
        if valid:
            value = urlunsplit(('https','www.tiktok.com',path.rstrip('/'),'',''))
        valid |= host in ('vm.tiktok.com','vt.tiktok.com') and bool(re.fullmatch(r'/[A-Za-z0-9]+/?',path))
    elif platform in ('instagram','instagram-reels'):
        kind = '(?:reel|reels)' if platform == 'instagram-reels' else '(?:p|reel|reels)'
        valid = host in ('www.instagram.com','instagram.com') and bool(re.fullmatch(r'/'+kind+r'/[A-Za-z0-9_-]+/?',path))
    elif platform == 'chzzk':
        valid = host == 'chzzk.naver.com' and bool(re.fullmatch(r'/video/\d+/?',path))
    elif platform == 'chzzk-clips':
        valid = host == 'chzzk.naver.com' and bool(re.fullmatch(r'/clips/[A-Za-z0-9_-]{5,100}/?',path))
    elif platform in ('soop', 'soop-clips', 'soop-catch'):
        match = re.fullmatch(r'/(?:player|PLAYER/STATION)/(\d+)(?:/catch)?/?',path)
        valid = host in ('vod.sooplive.com','vod.sooplive.co.kr','vod.afreecatv.com') and bool(match)
        if valid:
            # Catch and clips share the same single-VOD API; never resolve a catchstory playlist.
            value = urlunsplit(('https','vod.sooplive.com',f'/player/{match[1]}',url.query,''))
    elif platform == 'vimeo':
        valid = (host in ('vimeo.com','www.vimeo.com') and bool(re.fullmatch(r'/(?:\d+(?:/[A-Za-z0-9]+)?|channels/[A-Za-z0-9_-]+/\d+|groups/[A-Za-z0-9_-]+/videos/\d+)/?',path))) or (host == 'player.vimeo.com' and bool(re.fullmatch(r'/video/\d+/?',path)))
    elif platform == 'twitch':
        valid = host in ('twitch.tv','www.twitch.tv','m.twitch.tv','go.twitch.tv') and bool(re.fullmatch(r'/videos/\d+/?',path))
    elif platform == 'twitch-clips':
        valid = (host == 'clips.twitch.tv' and bool(re.fullmatch(r'/[A-Za-z0-9_-]+/?',path)) and path.rstrip('/') != '/embed') or (host in ('twitch.tv','www.twitch.tv','m.twitch.tv','go.twitch.tv') and bool(re.fullmatch(r'/(?:[A-Za-z0-9_]+/)?clip/[A-Za-z0-9_-]+/?',path)))
    elif platform == 'naver-tv':
        valid = host in ('tv.naver.com','m.tv.naver.com','tvcast.naver.com','m.tvcast.naver.com') and bool(re.fullmatch(r'/(?:v|embed)/\d+/?',path))
    elif platform == 'dailymotion':
        valid = (host in ('dailymotion.com','www.dailymotion.com') and bool(re.fullmatch(r'/(?:embed/)?video/[A-Za-z0-9]+(?:_[A-Za-z0-9_-]+)?/?',path))) or (host == 'dai.ly' and bool(re.fullmatch(r'/[A-Za-z0-9]+/?',path)))
    elif platform == 'direct':
        valid = bool(re.search(r'\.(mp4|webm|mov|m4v)$',path,re.I))
    if not valid:
        raise ValueError('이 페이지의 서비스에 맞는 영상 단건 링크를 입력해주세요. 생방송·채널·재생목록은 지원하지 않습니다.')
    return value


def install_network_guard():
    """Reject private destinations at DNS resolution AND connection, including redirects."""
    original_resolve = socket.getaddrinfo
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex
    def resolve(host, port, *args, **kwargs):
        if int(port) not in (80,443): raise OSError('Blocked destination port')
        answers = original_resolve(host, port, *args, **kwargs)
        if not answers or any(not public_ip(answer[4][0]) for answer in answers):
            raise OSError('Blocked private network destination')
        return answers
    def connect(sock, address):
        if sock.family in (socket.AF_INET,socket.AF_INET6):
            if not public_ip(address[0]) or int(address[1]) not in (80,443): raise OSError('Blocked network destination')
        return original_connect(sock,address)
    def connect_ex(sock,address):
        if sock.family in (socket.AF_INET,socket.AF_INET6):
            if not public_ip(address[0]) or int(address[1]) not in (80,443): raise OSError('Blocked network destination')
        return original_connect_ex(sock,address)
    socket.getaddrinfo=resolve
    socket.socket.connect=connect
    socket.socket.connect_ex=connect_ex
