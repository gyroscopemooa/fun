"""Burn a centered, semi-transparent 'manytool.net' mark into every downloaded video (free tier)."""
import os
import subprocess
from pathlib import Path
from safety import MAX_BYTES

FONT = os.environ.get('WATERMARK_FONT', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
TEXT = 'manytool.net'
ENCODE_TIMEOUT = 780


def filter_graph(font=FONT):
    font = font.replace(chr(92), '/').replace(':', chr(92) + ':')
    return (
        'scale=trunc(iw/2)*2:trunc(ih/2)*2,'
        f"drawtext=fontfile='{font}':text='{TEXT}':fontcolor=white@0.5:fontsize=w/9:"
        'borderw=2:bordercolor=black@0.35:x=(w-text_w)/2:y=(h-text_h)/2'
    )


def apply_watermark(directory, result, ffmpeg='ffmpeg'):
    source = directory / result['filename']
    output = directory / 'watermarked.mp4'
    command = [
        ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file',
        '-i', str(source), '-map', '0:v:0', '-map', '0:a:0?', '-vf', filter_graph(),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '27', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-threads', '2', str(output),
    ]
    try:
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=ENCODE_TIMEOUT)
    except subprocess.TimeoutExpired:
        output.unlink(missing_ok=True)
        raise ValueError('워터마크 처리 시간이 길어 영상을 만들지 못했습니다. 더 짧은 영상을 사용해주세요.')
    except subprocess.CalledProcessError:
        output.unlink(missing_ok=True)
        raise ValueError('이 영상은 워터마크를 넣어 저장할 수 없습니다.')
    size = output.stat().st_size
    if not 0 < size <= MAX_BYTES:
        output.unlink(missing_ok=True)
        raise ValueError('워터마크를 넣은 영상이 300MB를 넘어 저장할 수 없습니다.')
    source.unlink(missing_ok=True)
    return {**result, 'filename': output.name, 'size': size}
