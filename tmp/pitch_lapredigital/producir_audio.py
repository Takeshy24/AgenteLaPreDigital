import asyncio
import json
import re
from pathlib import Path
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'deps'))
import numpy as np

OUT = ROOT.parents[1] / 'output' / 'video_lapredigital'
BLOCKS = [
    (0, 15, 'Son las once de la noche. Un estudiante quiere prepararse para la UNT, pregunta cuánto cuesta… y nadie le responde. Mañana podría haber elegido otra academia.'),
    (15, 45, 'Cada consulta es una oportunidad. Pero, entre WhatsApp, Telegram y hojas de cálculo, el contexto puede perderse. Se repiten preguntas y ofertas, mientras el asesor intenta descubrir a quién atender primero. Sin un registro común, también es difícil saber si las acciones comerciales funcionan.'),
    (45, 75, 'Por eso creamos el Agente Negociador Inteligente de LaPreDigital. Conversa por WhatsApp y Telegram, interpreta los mensajes con inteligencia artificial y registra cada paso de la negociación. Para responder sobre la oferta, consulta los documentos aprobados de conocimiento. Así, la conversación y el seguimiento comparten el mismo contexto.'),
    (75, 115, 'Primero pregunta la carrera, la disponibilidad y el presupuesto. También permite indicar varios cursos difíciles. Con ese perfil recomienda un plan dentro del presupuesto y presenta sus beneficios de forma breve. Luego prepara una oferta personal, con tarifa vigente, y permite abrir el pago de prueba. Si necesita apoyo de su familia, genera una invitación al responsable económico, quien debe aceptar la vinculación y autorizar su propio contacto.'),
    (115, 140, 'La inteligencia artificial propone, pero el sistema valida las reglas. Los precios salen del catálogo vigente y aceptar una propuesta no confirma un pago. Reclamos, reembolsos y solicitudes de atención humana pasan al equipo. Y si alguien revoca el seguimiento, su decisión se respeta por canal.'),
    (140, 165, 'Todo queda medido mediante seis indicadores de la fase leads: desde el contacto inicial hasta la conversión pagada. La consola consulta el Data Mart y permite analizar periodos y dimensiones. Al filtrar, resalta los indicadores que sí cambian. Las cifras que mostramos son datos de demostración.'),
    (165, 180, 'Respuestas oportunas, decisiones con datos y cada negociación bajo control. Agente Negociador Inteligente de LaPreDigital: cada interesado, mejor atendido.'),
]


async def generate():
    import edge_tts
    semaphore = asyncio.Semaphore(3)

    async def one(i, text):
        async with semaphore:
            target = ROOT / 'audio' / f'voz_{i}.mp3'
            meta = target.with_suffix('.jsonl')
            if not target.exists() or not meta.exists():
                voice = edge_tts.Communicate(text, 'es-PE-AlexNeural', rate='-17%', boundary='WordBoundary')
                await voice.save(str(target), str(meta))
            print(f'Voz {i + 1}/7 generada', flush=True)

    await asyncio.gather(*(one(i, b[2]) for i, b in enumerate(BLOCKS)))


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, encoding='utf8', errors='replace')
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return result.stdout


def stamp(seconds, ass=False):
    h = int(seconds // 3600)
    m = int(seconds % 3600 // 60)
    s = seconds % 60
    return f'{h}:{m:02}:{s:05.2f}' if ass else f'{h:02}:{m:02}:{int(s):02},{round((s-int(s))*1000):03}'


def process():
    rate = 48000
    narration = np.zeros(rate * 180, dtype=np.float32)
    subtitles = []
    report = []
    for i, (start, end, text) in enumerate(BLOCKS):
        source = ROOT / 'audio' / f'voz_{i}.mp3'
        duration = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(source)]).strip())
        target = (end - start) - (1.6 if i == 0 else 3.0)
        tempo = min(1.25, max(.84, duration / target))
        pcm = ROOT / 'audio' / f'voz_{i}_ajustada.wav'
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(source), '-af', f'atempo={tempo:.6f},highpass=f=85,lowpass=f=13000,loudnorm=I=-17:LRA=7:TP=-2', '-ac', '1', '-ar', str(rate), '-c:a', 'pcm_s16le', str(pcm)])
        with wave.open(str(pcm), 'rb') as wav:
            samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float32) / 32768
        offset = start + .65
        assert offset + len(samples)/rate < end - .1, (i, duration, tempo)
        index = int(offset * rate)
        narration[index:index+len(samples)] = samples
        metadata = [json.loads(line) for line in source.with_suffix('.jsonl').read_text(encoding='utf8').splitlines()]
        words = [x for x in metadata if x['type'] == 'WordBoundary']
        original_words = text.split()
        normalize = lambda value: re.sub(r'[^\w]', '', value).lower()
        if len(original_words)==len(words) and all(normalize(a)==normalize(b['text']) for a,b in zip(original_words,words)):
            words = [{**item, 'text': original} for original,item in zip(original_words,words)]
        group = []
        for j, item in enumerate(words):
            group.append(item)
            joined = ' '.join(x['text'] for x in group)
            elapsed = (item['offset'] + item['duration'] - group[0]['offset']) / 1e7 / tempo
            if len(joined) >= 60 or elapsed >= 4.5 or j == len(words)-1 or (item['text'].endswith(('.', '?', '…', ':')) and len(joined) > 20):
                a = offset + group[0]['offset']/1e7/tempo
                b = offset + (item['offset']+item['duration'])/1e7/tempo
                subtitles.append((a, b+.12, joined))
                group = []
        report.append({'section':i+1,'start':start,'end':end,'text':text,'source_duration':duration,'tempo':tempo,'voice_end':offset+len(samples)/rate})

    # Banda original discreta: acordes ambientales, sin material musical de terceros.
    music = np.zeros_like(narration)
    rng = np.random.default_rng(43)
    progression = [(57,60,64),(53,57,60),(48,52,55),(55,59,62)]
    for i, t0 in enumerate(np.arange(0,180,5.0)):
        count = min(int(rate*7), len(music)-int(t0*rate))
        t = np.arange(count, dtype=np.float32)/rate
        env = np.minimum(t/1.2,1)*np.maximum(0,1-t/7)**1.5
        sound = np.zeros(count,dtype=np.float32)
        for note in progression[i%4]:
            hz = 440 * 2**((note-69)/12)
            phase = rng.uniform(0,2*np.pi)
            sound += (np.sin(2*np.pi*hz*t+phase)+.2*np.sin(4*np.pi*hz*t+phase))*.003*env
        at = int(t0*rate)
        music[at:at+count] += sound
    fade = np.minimum(np.arange(len(music))/rate/2,1)*np.minimum((len(music)-np.arange(len(music)))/rate/4,1)
    music *= fade
    # Reduce la banda durante toda intervención del narrador.
    for info in report:
        a=int((info['start']+.4)*rate);b=int((info['voice_end']+.3)*rate)
        music[a:b] *= .42
    mixed=np.clip(narration+music,-.98,.98)
    stereo=np.column_stack([mixed,mixed])
    with wave.open(str(ROOT/'audio'/'mezcla.wav'),'wb') as wav:
        wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(rate)
        wav.writeframes((stereo*32767).astype('<i2').tobytes())

    srt=[]
    events=[]
    for i,(a,b,text) in enumerate(subtitles):
        if i+1<len(subtitles):b=min(b,subtitles[i+1][0]-.03)
        srt.append(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{text}\n')
        events.append(f'Dialogue: 0,{stamp(a,True)},{stamp(b,True)},Default,,0,0,0,,{text}')
    (OUT/'Subtitulos_LaPreDigital.srt').write_text('\n'.join(srt),encoding='utf8')
    header='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Plus Jakarta Sans,35,&H00F5F7F1,&H00F5F7F1,&H00101412,&H90101412,0,0,0,0,100,100,0,0,3,14,0,2,170,170,66,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
'''
    (ROOT/'subtitulos.ass').write_text(header+'\n'.join(events)+'\n',encoding='utf8')
    (ROOT/'audio'/'verificacion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    (OUT/'Guion_del_video.txt').write_text('\n\n'.join(f'{int(a)//60}:{int(a)%60:02}–{int(b)//60}:{int(b)%60:02}\n{t}' for a,b,t in BLOCKS),encoding='utf8')
    print('Mezcla: 180 segundos; subtítulos:',len(subtitles),'palabras:',sum(len(b[2].split()) for b in BLOCKS),flush=True)


if __name__=='__main__':
    if '--mix-only' not in sys.argv:
        asyncio.run(generate())
    process()
