import sys
import unittest
import socket
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'container'))
from safety import validate_url,public_ip,install_network_guard

class SafetyTests(unittest.TestCase):
    def test_invalid_payload_types(self):
        for platform in (None, [], {}, 1):
            with self.subTest(platform=platform), self.assertRaises(ValueError):
                validate_url('https://example.com/video.mp4', platform)
    def test_platform_urls(self):
        urls={
            'youtube':'https://www.youtube.com/watch?v=BaW_jenozKc',
            'youtube-shorts':'https://www.youtube.com/shorts/BaW_jenozKc',
            'tiktok':'https://www.tiktok.com/@example/video/123456',
            'instagram':'https://www.instagram.com/p/ABC_123/',
            'instagram-reels':'https://www.instagram.com/reel/ABC_123/',
            'chzzk':'https://chzzk.naver.com/video/12345',
            'soop':'https://vod.sooplive.com/player/12345',
            'direct':'https://example.com/video.mp4?token=test'}
        for platform,url in urls.items():
            with self.subTest(platform=platform):self.assertEqual(validate_url(url,platform),url)
    def test_rejects_other_service_and_fake_host(self):
        for url in ['https://youtube.com.evil.com/watch?v=BaW_jenozKc','https://www.tiktok.com/@x/video/123','https://user:pass@youtube.com/watch?v=BaW_jenozKc','https://www.youtube.com/playlist?list=123','https://www.youtube.com/live/abc']:
            with self.subTest(url=url),self.assertRaises(ValueError):validate_url(url,'youtube')
    def test_rejects_private_or_non_https(self):
        for url in ['https://127.0.0.1/a.mp4','https://[::1]/a.mp4','https://[::ffff:127.0.0.1]/a.mp4','https://169.254.169.254/a.mp4','https://localhost/a.mp4','file:///tmp/a.mp4','http://example.com/a.mp4','https://example.com:8080/a.mp4','https://example.com/a.m3u8']:
            with self.subTest(url=url),self.assertRaises(ValueError):validate_url(url,'direct')
    def test_public_addresses(self):
        for address in ['10.0.0.1','127.0.0.1','100.64.0.1','169.254.169.254','192.168.1.1','0.0.0.0','224.0.0.1','::1','fc00::1','::ffff:127.0.0.1']:
            self.assertFalse(public_ip(address),address)
        self.assertTrue(public_ip('1.1.1.1'))
    def test_dns_rebinding_guard(self):
        original_resolve=socket.getaddrinfo
        original_connect=socket.socket.connect
        original_connect_ex=socket.socket.connect_ex
        try:
            socket.getaddrinfo=lambda *a,**k:[(socket.AF_INET,socket.SOCK_STREAM,6,'',('127.0.0.1',443))]
            install_network_guard()
            with self.assertRaises(OSError):socket.getaddrinfo('public-looking.example',443)
            with socket.socket() as client:
                with self.assertRaises(OSError):client.connect(('169.254.169.254',80))
        finally:
            socket.getaddrinfo=original_resolve;socket.socket.connect=original_connect;socket.socket.connect_ex=original_connect_ex
    def test_old_soop_domain(self):
        self.assertEqual(validate_url('https://vod.afreecatv.com/player/123','soop'),'https://vod.sooplive.com/player/123')

if __name__=='__main__':unittest.main()
