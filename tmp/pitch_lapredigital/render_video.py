from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'output/video_lapredigital'
SCENES=json.loads((ROOT/'escenas.json').read_text(encoding='utf8'))


def render_one(index,scene):
    target=ROOT/'clips'/f'{index:02}.mp4'
    if target.exists() and target.stat().st_mtime>Path(scene['image']).stat().st_mtime:
        return index
    frames=round(scene['duration']*30)
    # Movimiento lento sobre las composiciones; los cambios de plano siguen el guion.
    zoom=f'1+0.010*on/{frames}'
    vf=f"scale=2304:1296,zoompan=z='{zoom}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d={frames}:s=1920x1080:fps=30,fade=t=in:st=0:d=0.18,fade=t=out:st={scene['duration']-.18}:d=0.18,format=yuv420p"
    args=['ffmpeg','-y','-hide_banner','-loglevel','error','-i',scene['image'],'-vf',vf,'-frames:v',str(frames),'-an','-c:v','libx264','-preset','veryfast','-crf','19','-threads','3','-pix_fmt','yuv420p','-r','30','-video_track_timescale','30000',str(target)]
    result=subprocess.run(args,capture_output=True,text=True,encoding='utf8',errors='replace')
    if result.returncode:
        raise RuntimeError(f'Escena {index}: '+result.stderr[-2000:])
    return index


def main():
    with ThreadPoolExecutor(max_workers=3) as executor:
        pending={executor.submit(render_one,i,s):i for i,s in enumerate(SCENES)}
        for count,future in enumerate(as_completed(pending),1):
            index=future.result()
            print(f'Escena {index+1:02}/21 renderizada ({count}/21)',flush=True)
    listing=ROOT/'clips'/'lista.txt'
    listing.write_text('\n'.join("file '"+str((ROOT/'clips'/f'{i:02}.mp4').resolve()).replace('\\','/')+"'" for i in range(len(SCENES))),encoding='utf8')
    combined=ROOT/'montaje_sin_audio.mp4'
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(combined)],check=True)
    print('Montaje listo. Incorporando voz y subtítulos.',flush=True)
    ass=str(ROOT/'subtitulos.ass').replace('\\','/').replace(':','\\:')
    fonts=str(ROOT/'assets').replace('\\','/').replace(':','\\:')
    target=OUT/'Pitch_LaPreDigital_3_minutos.mp4'
    args=['ffmpeg','-y','-hide_banner','-loglevel','warning','-i',str(combined),'-i',str(ROOT/'audio'/'mezcla.wav'),'-vf',f"ass=filename='{ass}':fontsdir='{fonts}'",'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','20','-threads','5','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-af','alimiter=limit=0.97','-t','180','-movflags','+faststart','-metadata','title=Agente Negociador Inteligente para LaPreDigital','-metadata','comment=Pitch ejecutivo. Capturas reales con datos de demostración; apertura y conversación ilustrativas. Pago de prueba.',str(target)]
    with (ROOT/'exportacion.log').open('w',encoding='utf8') as log:
        result=subprocess.run(args,stdout=log,stderr=log)
    if result.returncode:
        raise RuntimeError((ROOT/'exportacion.log').read_text(encoding='utf8')[-3000:])
    print(f'FINAL: {target}',flush=True)


if __name__=='__main__':main()
