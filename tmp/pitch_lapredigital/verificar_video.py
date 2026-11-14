from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess
import json
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[1] / 'output/video_lapredigital'
VIDEO = OUT / 'Pitch_LaPreDigital_3_minutos.mp4'
QA = ROOT / 'revision_final'
QA.mkdir(exist_ok=True)

probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_entries',
    'format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels,duration',
    '-of', 'json', str(VIDEO)
], text=True))
assert float(probe['format']['duration']) == 180
v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
a = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
assert (v['width'], v['height'], v['r_frame_rate'], v['nb_frames']) == (1920, 1080, '30/1', '5400')
assert (a['sample_rate'], a['channels']) == ('48000', 2)

def seconds(value):
    h, m, s = re.split('[:,]', value)[:3]
    ms = value.split(',')[-1]
    return int(h)*3600 + int(m)*60 + int(s) + int(ms)/1000

previous_end = 0
cues = re.findall(r'(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})', (OUT/'Subtitulos_LaPreDigital.srt').read_text(encoding='utf8'))
for start, end in cues:
    start, end = seconds(start), seconds(end)
    assert previous_end <= start < end <= 180
    previous_end = end

times = [5, 11, 20, 30, 39, 50, 60, 69, 81, 91, 100, 106, 112, 120, 128, 136, 145, 153, 161, 170, 176]

def frame(item):
    i, second = item
    target = QA / f'{i+1:02}_{second:03}.jpg'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(second), '-i', str(VIDEO), '-frames:v', '1', '-q:v', '2', str(target)], check=True, capture_output=True)
    return target

with ThreadPoolExecutor(max_workers=3) as pool:
    frames = list(pool.map(frame, enumerate(times)))

sheet = Image.new('RGB', (1600, 7*250), '#101412')
font = ImageFont.truetype(str(ROOT/'assets/PlusJakartaSans.ttf'), 18)
draw = ImageDraw.Draw(sheet)
for i, (path, second) in enumerate(zip(frames, times)):
    x, y = (i%3)*533, (i//3)*250
    thumb = Image.open(path).resize((520, 292))
    thumb.thumbnail((520, 219))
    sheet.paste(thumb, (x+6, y+25))
    draw.text((x+8, y+2), f'{i+1:02}  {second//60:02}:{second%60:02}', font=font, fill='#c9ee72')
sheet.save(QA/'hoja_revision.jpg', quality=93)
report = {**probe, 'subtitle_cues': len(cues), 'screenshots_checked': len(frames)}
(QA/'verificacion.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
