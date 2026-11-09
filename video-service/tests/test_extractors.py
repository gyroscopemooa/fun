import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'container'))
from extractors import ManyToolChzzkClipIE
from yt_dlp.utils import ExtractorError


class ClipTests(unittest.TestCase):
    def test_public_clip_and_dash_accept_header(self):
        extractor=ManyToolChzzkClipIE()
        payload={'code':200,'content':{'videoId':'video123','inKey':'test-key','contentTitle':'Clip','adult':False}}
        with patch.object(extractor,'_download_json',return_value=payload), patch.object(extractor,'_extract_mpd_formats_and_subtitles',return_value=([{'url':'https://example.com/video.mp4'}],{})) as manifest:
            result=extractor._real_extract('https://chzzk.naver.com/clips/ABC123')
            self.assertEqual(result['title'],'Clip')
            self.assertEqual(manifest.call_args.kwargs['headers']['Accept'],'application/dash+xml')

    def test_unavailable_and_restricted_clips(self):
        for content in ({},{'adult':True},{'private':True},{'blind':True},{'videoId':'id'}):
            extractor=ManyToolChzzkClipIE()
            with patch.object(extractor,'_download_json',return_value={'code':200,'content':content}), patch.object(extractor,'_extract_mpd_formats_and_subtitles') as manifest:
                with self.assertRaises(ExtractorError): extractor._real_extract('https://chzzk.naver.com/clips/ABC123')
                manifest.assert_not_called()
