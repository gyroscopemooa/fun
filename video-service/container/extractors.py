"""Single public Chzzk clip adapter using the playback API used by Streamlink.

Reference: https://github.com/streamlink/streamlink/blob/master/src/streamlink/plugins/chzzk.py
All requests run inside the downloader's public-address network guard.
"""
from yt_dlp.extractor.common import InfoExtractor
from yt_dlp.utils import ExtractorError


class ManyToolChzzkClipIE(InfoExtractor):
    IE_NAME = 'manytool:chzzk-clip'
    _VALID_URL = r'https://chzzk\.naver\.com/clips/(?P<id>[A-Za-z0-9_-]+)'

    def _real_extract(self, url):
        clip_id = self._match_id(url)
        response = self._download_json(
            f'https://api.chzzk.naver.com/service/v1/play-info/clip/{clip_id}', clip_id)
        content = response.get('content') or {}
        if response.get('code') != 200 or not content:
            raise ExtractorError('Clip is unavailable', expected=True)
        if content.get('adult') or content.get('private') or content.get('blind'):
            raise ExtractorError('Restricted clip is not supported', expected=True)
        video_id, key = content.get('videoId'), content.get('inKey')
        if not video_id or not key:
            raise ExtractorError('Public clip playback is unavailable', expected=True)
        formats, subtitles = self._extract_mpd_formats_and_subtitles(
            f'https://apis.naver.com/neonplayer/vodplay/v2/playback/{video_id}',
            clip_id, query={'key': key}, headers={'Accept': 'application/dash+xml'})
        return {'id': clip_id, 'title': content.get('contentTitle') or clip_id,
                'formats': formats, 'subtitles': subtitles, 'age_limit': 0,
                'availability': 'public'}
