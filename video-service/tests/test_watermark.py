import sys
import os, shutil, subprocess, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "container"))
from watermark import apply_watermark, filter_graph


@unittest.skipUnless(shutil.which('ffmpeg') and os.environ.get('WATERMARK_FONT'), 'ffmpeg and WATERMARK_FONT required')
class WatermarkTest(unittest.TestCase):
    def make(self, directory, size, name):
        path = directory / name
        subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'testsrc=s={size}:d=2:r=15','-f','lavfi','-i','sine=d=2','-shortest','-c:v','libvpx','-c:a','libvorbis',str(path)],check=True)
        return path
    def test_landscape_portrait_and_odd_size(self):
        for size in ('640x360','360x640','641x361'):
            with self.subTest(size=size), tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp); source = self.make(directory, size, 'video.webm')
                result = apply_watermark(directory, {'title': 't', 'filename': source.name, 'size': source.stat().st_size, 'duration': 2})
                self.assertEqual(result['filename'], 'watermarked.mp4'); self.assertFalse(source.exists()); self.assertGreater(result['size'], 0)
    def test_filter_has_center_and_half_opacity(self):
        graph = filter_graph(); self.assertIn('white@0.5', graph); self.assertIn('(w-text_w)/2', graph); self.assertIn('manytool.net', graph)
