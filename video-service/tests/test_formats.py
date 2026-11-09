import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'container'))
from runner import FORMAT_SELECTOR, failure_code
from yt_dlp import YoutubeDL


class FormatTests(unittest.TestCase):
    def test_portrait_720_uses_known_video_before_unknown_fallback(self):
        def fmt(name,width=None,height=None):
            return {'format_id':name,'url':'https://example.com/'+name+'.mp4','ext':'mp4',
                    'vcodec':'h264','acodec':'aac','width':width,'height':height}
        with YoutubeDL({'quiet':True}) as ydl:
            choose=ydl.build_format_selector(FORMAT_SELECTOR)
            selected=list(choose({'formats':[fmt('unknown'),fmt('portrait720',720,1342),fmt('portrait1080',1080,1920)],'has_merged_format':True,'incomplete_formats':False}))
        self.assertEqual(selected[0]['format_id'],'portrait720')

    def test_diagnostics_do_not_expose_urls_or_tokens(self):
        self.assertEqual(failure_code(Exception('HTTP Error 403: https://example.com/?secret=private')),'upstream_access')
        self.assertEqual(failure_code(Exception('Requested format is not available')),'format_unavailable')
