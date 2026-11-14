from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
from functools import lru_cache
import json
import math
import textwrap
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
W, H = 1920, 1080
BG = '#0d1416'
PANEL = '#172124'
INK = '#f4f6f1'
MUTED = '#aab6b5'
LIME = '#d4f477'
FONT = ASSETS / 'PlusJakartaSans.ttf'


@lru_cache(maxsize=90)
def font(size, weight=500):
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([weight])
    return f


def txt(draw, xy, text, size=32, fill=INK, weight=500):
    draw.text(xy, text, font=font(size, weight), fill=fill, stroke_width=0)


def lines(draw, xy, text, size=32, width=650, fill=INK, weight=500, leading=1.34):
    x, y = xy
    for paragraph in text.split('\n'):
        row = ''
        for word in paragraph.split():
            trial = (row + ' ' + word).strip()
            if row and draw.textlength(trial, font=font(size,weight)) > width:
                txt(draw, (x,y), row,size,fill,weight)
                y += size * leading
                row = word
            else:
                row = trial
        if row:
            txt(draw,(x,y),row,size,fill,weight)
            y += size * leading
    return y


def pill(draw, xy, text, active=False, size=22):
    x,y=xy
    width=draw.textlength(text,font=font(size,650))+36
    draw.rounded_rectangle((x,y,x+width,y+46),radius=22,fill=LIME if active else '#1d2a2d',outline=None if active else '#3c4b45',width=1)
    txt(draw,(x+18,y+9),text,size,'#172124' if active else LIME,650)
    return width


def base():
    yy,xx=np.mgrid[0:H,0:W]
    glow=np.exp(-((xx-1480)**2/(700**2)+(yy-230)**2/(650**2)))
    glow2=np.exp(-((xx-400)**2/(1200**2)+(yy-900)**2/(500**2)))
    pixels=np.zeros((H,W,3),dtype=np.float64)+np.array([13,20,22])
    pixels+=glow[:,:,None]*np.array([10,20,12])+glow2[:,:,None]*np.array([3,7,8])
    return Image.fromarray(np.uint8(np.clip(pixels,0,255)),'RGB')


def brand(draw, xy=(90,55), size=30):
    x,y=xy
    for dy in (4,15,26):
        draw.ellipse((x,y+dy,x+34,y+dy+11),outline=LIME,width=2)
        if dy<26:
            draw.line((x,y+dy+5,x,y+dy+17),fill=LIME,width=2)
            draw.line((x+34,y+dy+5,x+34,y+dy+17),fill=LIME,width=2)
    txt(draw,(x+52,y-1),'LaPreDigital',size,INK,800)


def chrome(image, chapter, label, demo=False):
    d=ImageDraw.Draw(image)
    brand(d)
    value=f'{chapter:02}  /  {label.upper()}'
    tw=d.textlength(value,font=font(20,650))
    txt(d,(W-90-tw,66),value,20,MUTED,650)
    d.line((90,125,1830,125),fill='#354238',width=1)
    if demo:
        pill(d,(1460,151),'Datos de demostración',False,18)
    txt(d,(92,1036),'AGENTE NEGOCIADOR INTELIGENTE',16,'#90a49a',600)
    txt(d,(1593,1036),'PITCH EJECUTIVO',16,'#90a49a',600)
    return d


def screenshot(image, path, box, highlight=None):
    x,y,w,h=box
    raw=Image.open(path).convert('RGB')
    scaled=ImageOps.contain(raw,(w-8,h-8),Image.Resampling.LANCZOS)
    px=x+(w-scaled.width)//2;py=y+(h-scaled.height)//2
    shadow=Image.new('RGBA',image.size)
    sd=ImageDraw.Draw(shadow)
    sd.rounded_rectangle((px-14,py-14,px+scaled.width+14,py+scaled.height+14),radius=24,fill=(0,0,0,140))
    shadow=shadow.filter(ImageFilter.GaussianBlur(17))
    image.paste(shadow,(0,0),shadow)
    d=ImageDraw.Draw(image)
    d.rounded_rectangle((px-4,py-4,px+scaled.width+4,py+scaled.height+4),radius=12,fill='#29362f',outline='#52664c',width=2)
    image.paste(scaled,(px,py))
    if highlight:
        ax,ay,bx,by=highlight
        d.rounded_rectangle((px+ax*scaled.width,py+ay*scaled.height,px+bx*scaled.width,py+by*scaled.height),radius=12,outline=LIME,width=4)
    return px,py,scaled.width,scaled.height


def feature(draw,y,title,body):
    draw.ellipse((96,y+7,109,y+20),fill=LIME)
    txt(draw,(126,y-4),title,28,INK,750)
    lines(draw,(126,y+39),body,23,540,MUTED)


def extract():
    source=ROOT.parents[1]/'tmp/manuales_numeracion/usuario_corregido.docx'
    records=json.loads((ROOT/'capturas_fuente.json').read_text(encoding='utf8'))
    shots={}
    with ZipFile(source) as z:
        for i,r in enumerate(records):
            image=Image.open(BytesIO(z.read('word/'+r['target']))).convert('RGB')
            w,h=image.size;c=r['crop']
            bounds=(round(w*int(c.get('l',0))/100000),round(h*int(c.get('t',0))/100000),round(w*(1-int(c.get('r',0))/100000)),round(h*(1-int(c.get('b',0))/100000)))
            cropped=image.crop(bounds)
            target=ASSETS/f'captura_{i:02}.png'
            cropped.save(target)
            shots[r['description']]=target
    (ROOT/'capturas_video.json').write_text(json.dumps({k:str(v) for k,v in shots.items()},ensure_ascii=False,indent=2),encoding='utf8')
    board=Image.new('RGB',(1600,math.ceil(len(shots)/4)*260),'#ddd')
    d=ImageDraw.Draw(board)
    for i,(title,path) in enumerate(shots.items()):
        x=(i%4)*400;y=(i//4)*260
        img=ImageOps.contain(Image.open(path),(384,211))
        board.paste(img,(x+(400-img.width)//2,y+42))
        d.text((x+8,y+3),title[:47],fill='black',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',13))
    board.save(ROOT/'capturas_contacto.jpg')
    return shots


def build():
    shots=extract()
    scenes=[]

    def save(image,name,duration,chapter):
        path=ASSETS/f'escena_{len(scenes)+1:02}_{name}.png'
        image.save(path)
        scenes.append({'image':str(path),'duration':duration,'chapter':chapter,'name':name})

    # 0:00–0:15 · oportunidad
    for index,duration in enumerate((7.5,7.5)):
        image=ImageOps.fit(Image.open(ASSETS/'estudiante_noche.png').convert('RGB'),(W,H),method=Image.Resampling.LANCZOS)
        overlay=Image.new('RGBA',(W,H))
        od=ImageDraw.Draw(overlay)
        od.rectangle((0,0,W,145),fill=(13,20,22,175))
        od.rectangle((0,960,W,H),fill=(13,20,22,180))
        image=Image.alpha_composite(image.convert('RGBA'),overlay).convert('RGB')
        d=chrome(image,1,'La oportunidad')
        pill(d,(92,196),'ESCENA ILUSTRATIVA',False,18)
        if index==0:
            txt(d,(90,292),'23:00',126,LIME,800)
            lines(d,(96,467),'Una consulta.\nNinguna respuesta.',66,800,INK,800,1.2)
            txt(d,(98,695),'El interés no espera hasta mañana.',28,MUTED,500)
        else:
            lines(d,(92,248),'Una oportunidad\npuede perderse.',66,770,INK,800,1.2)
            d.rounded_rectangle((96,491,808,683),radius=25,fill='#172124',outline='#46563f',width=2)
            txt(d,(123,514),'ESTUDIANTE',18,LIME,750)
            lines(d,(123,556),'Hola, ¿cuánto cuesta prepararme para la UNT?',30,650)
            txt(d,(126,645),'Esperando respuesta…',20,MUTED)
        save(image,'consulta' if index==0 else 'espera',duration,1)

    # 0:15–0:45 · problema
    image=ImageOps.fit(Image.open(ASSETS/'asesor.png').convert('RGB'),(W,H),method=Image.Resampling.LANCZOS)
    d=chrome(image,2,'El problema')
    pill(d,(92,190),'ESCENA ILUSTRATIVA',False,18)
    lines(d,(92,290),'Más mensajes.\nMenos contexto.',76,810,INK,800,1.17)
    lines(d,(98,538),'La atención se dispersa entre canales, archivos y conversaciones.',31,670,MUTED)
    save(image,'asesor',10,2)

    image=base();d=chrome(image,2,'El problema')
    lines(d,(92,202),'La información se fragmenta.',66,1550,INK,800)
    cards=[(94,386,'01','Chats separados','La conversación queda repartida.'),(694,430,'02','Datos repetidos','Se pierde lo que ya se preguntó.'),(1294,386,'03','Seguimiento incierto','Cuesta decidir a quién atender.')]
    for x,y,num,title,body in cards:
        d.rounded_rectangle((x,y,x+530,y+320),radius=26,fill=PANEL,outline='#3b4941',width=2)
        txt(d,(x+30,y+25),num,58,LIME,800)
        txt(d,(x+30,y+118),title,30,INK,750)
        lines(d,(x+30,y+178),body,25,470,MUTED)
    save(image,'fragmentacion',10,2)

    image=base();d=chrome(image,2,'El problema',True)
    lines(d,(92,204),'¿A quién atender primero?',64,1450,INK,800)
    screenshot(image,shots['Solicitudes por revisar y negociaciones registradas'],(95,362,1720,490))
    save(image,'priorizar',10,2)

    # 0:45–1:15 · solución
    image=base();d=chrome(image,3,'La solución')
    pill(d,(92,198),'CONVERSACIÓN + GESTIÓN + ANÁLISIS',True,22)
    lines(d,(90,313),'Agente Negociador\nInteligente',100,1600,INK,800,1.14)
    txt(d,(98,620),'para la gestión y análisis de leads en LaPreDigital',33,MUTED,500)
    for x,t in [(98,'WhatsApp'),(380,'Telegram'),(660,'Consola comercial')]:pill(d,(x,743),t,False,24)
    save(image,'producto',10,3)

    image=base();d=chrome(image,3,'La solución',True)
    lines(d,(92,224),'Dos canales.\nUn mismo contexto.',72,770,INK,800,1.2)
    feature(d,506,'WhatsApp y Telegram','El contacto conversa desde su canal.')
    feature(d,651,'Una negociación registrada','Perfil, mensajes, oferta y seguimiento.')
    screenshot(image,shots['Comprobante de recepción y continuación por canales'],(1120,225,650,625))
    save(image,'canales',10,3)

    image=base();d=chrome(image,3,'La solución',True)
    lines(d,(92,205),'Respuestas con una fuente definida.',61,1640,INK,800)
    screenshot(image,shots['Biblioteca de documentos del agente'],(750,331,1040,548))
    feature(d,376,'Inteligencia artificial','Interpreta el mensaje del usuario.')
    feature(d,550,'Conocimiento aprobado','Consulta los documentos disponibles.')
    feature(d,724,'Reglas del sistema','Valida las acciones permitidas.')
    save(image,'conocimiento',10,3)

    # 1:15–1:55 · demostración
    image=base();d=chrome(image,4,'El recorrido')
    lines(d,(92,225),'Primero,\nconocer al estudiante.',64,850,INK,800,1.2)
    feature(d,478,'Carrera y disponibilidad','Una pregunta a la vez.')
    feature(d,614,'Presupuesto mensual','Recomendaciones dentro de su límite.')
    feature(d,748,'Cursos difíciles','Permite seleccionar varios.')
    d.rounded_rectangle((1033,193,1704,882),radius=44,fill='#101a1c',outline='#53614d',width=3)
    d.rounded_rectangle((1284,211,1447,229),radius=10,fill='#344336')
    txt(d,(1068,261),'LaPreDigital · Asistente',26,INK,750)
    d.line((1063,315,1674,315),fill='#344336',width=2)
    d.rounded_rectangle((1065,347,1640,462),radius=20,fill='#233331')
    lines(d,(1090,368),'¿Qué carrera te gustaría estudiar?',28,520)
    for y,label,selected in [(494,'Medicina Humana',True),(570,'Ingeniería de Sistemas',False),(646,'Derecho',False)]:
        d.rounded_rectangle((1076,y,1658,y+59),radius=14,fill=LIME if selected else PANEL,outline='#4b5b44',width=1)
        if selected:
            d.line([(1101,y+29),(1109,y+37),(1123,y+21)],fill='#142018',width=3)
        txt(d,(1137 if selected else 1100,y+14),label,24,'#142018' if selected else INK,650)
    txt(d,(1078,817),'CONVERSACIÓN ILUSTRATIVA',17,MUTED,600)
    save(image,'perfil',10,4)

    image=base();d=chrome(image,4,'El recorrido',True)
    lines(d,(92,207),'Un plan que cabe en el presupuesto.',59,1710,INK,800)
    screenshot(image,shots['Catálogo interno con tarifas mensuales y selección del contacto'],(760,365,1045,492))
    pill(d,(98,372),'EJEMPLO: HASTA S/ 80 AL MES',False,20)
    txt(d,(98,479),'Meta UNT',68,LIME,800)
    txt(d,(100,571),'S/ 79.90 / mes',44,INK,750)
    lines(d,(102,668),'Precio vigente y beneficios resumidos. El detalle queda disponible.',28,590,MUTED)
    save(image,'recomendacion',10,4)

    image=base();d=chrome(image,4,'El recorrido',True)
    lines(d,(92,239),'Una oferta\npersonal.',76,750,INK,800,1.2)
    feature(d,499,'Plan y tarifa vigente','Condiciones claras para decidir.')
    feature(d,654,'Enlace de aceptación','Aceptar todavía no significa pagar.')
    screenshot(image,shots['Oferta personal y aceptación expresa de condiciones'],(1080,210,700,680))
    save(image,'oferta',8,4)

    image=base();d=chrome(image,4,'El recorrido',True)
    lines(d,(92,250),'Del interés\nal siguiente paso.',73,850,INK,800,1.2)
    pill(d,(99,510),'PAGO EN MODO DE PRUEBA',True,23)
    lines(d,(102,612),'La oferta permite abrir el pago de demostración.',31,660,MUTED)
    screenshot(image,shots['Opciones de pago después de aceptar las condiciones'],(1060,225,745,650))
    save(image,'pago',6,4)

    image=base();d=chrome(image,4,'El recorrido',True)
    lines(d,(92,224),'La familia\ntambién participa.',73,840,INK,800,1.2)
    feature(d,490,'Responsable económico','Invitación personal para el familiar.')
    feature(d,649,'Su propia autorización','Acepta el vínculo y el contacto.')
    screenshot(image,shots['Aceptación pública de una invitación personal'],(1085,215,700,660))
    save(image,'familia',6,4)

    # 1:55–2:20 · control
    image=base();d=chrome(image,5,'Las reglas',True)
    lines(d,(92,210),'La IA propone. El sistema valida.',62,1710,INK,800)
    screenshot(image,shots['Gestiones de atención del operador'],(788,340,990,520))
    feature(d,381,'Tarifas del catálogo','La propuesta conserva su precio autorizado.')
    feature(d,561,'Pago con evidencia','No se confirma por un mensaje o una captura.')
    feature(d,741,'Operador con contexto','Las excepciones quedan pendientes de atención.')
    save(image,'reglas',8,5)

    image=base();d=chrome(image,5,'Las reglas',True)
    lines(d,(92,227),'Cuando hace falta,\ninterviene una persona.',67,930,INK,800,1.2)
    for y,label in [(500,'Reclamos'),(594,'Reembolsos'),(688,'Solicitud de atención humana')]:pill(d,(99,y),label,False,28)
    screenshot(image,shots['Conversaciones derivadas al personal comercial'],(1040,400,760,310))
    save(image,'derivacion',9,5)

    image=base();d=chrome(image,5,'Las reglas',True)
    lines(d,(92,235),'La autorización\nse respeta por canal.',70,900,INK,800,1.2)
    feature(d,521,'Permiso individual','No se transfiere al familiar invitado.')
    feature(d,673,'Revocación del seguimiento','La decisión del contacto queda registrada.')
    screenshot(image,shots['Permisos independientes por canal de contacto'],(1118,310,650,495))
    save(image,'autorizacion',8,5)

    # 2:20–2:45 · indicadores
    image=base();d=chrome(image,6,'Decisiones con datos',True)
    lines(d,(92,224),'Seis indicadores.\nUna visión comercial.',69,860,INK,800,1.2)
    feature(d,510,'Desde el primer contacto','Contacto inicial y respuesta.')
    feature(d,650,'Hasta la conversión pagada','Perfil, vinculación y propuestas.')
    pill(d,(99,803),'ORIGEN: DATA MART',True,21)
    screenshot(image,shots['Resumen de los seis indicadores de la fase LEADS'],(1125,224,650,665))
    save(image,'indicadores',9,6)

    image=base();d=chrome(image,6,'Decisiones con datos',True)
    lines(d,(92,209),'Filtrar con claridad.',70,1650,INK,800)
    screenshot(image,shots['Indicadores que admiten el filtro de canal'],(655,345,1150,543))
    feature(d,389,'Periodo y dimensiones','Cada indicador admite sus propios filtros.')
    feature(d,586,'El efecto queda visible','Resaltan los indicadores afectados.')
    save(image,'filtros',8,6)

    image=base();d=chrome(image,6,'Decisiones con datos',True)
    lines(d,(92,227),'Entender el resultado,\nno solo el porcentaje.',67,950,INK,800,1.2)
    feature(d,510,'Numerador y denominador','Cantidades detrás de cada indicador.')
    feature(d,670,'Causas y desgloses','Información para revisar la gestión.')
    screenshot(image,shots['Detalle causas y desglose por canal'],(1150,270,600,610))
    save(image,'desglose',8,6)

    # 2:45–3:00 · cierre
    image=base();d=chrome(image,7,'El valor')
    lines(d,(92,220),'Cada negociación,\nbajo control.',88,1660,INK,800,1.16)
    for x,num,title,body in [(98,'01','Responder','Atención oportuna.'),(692,'02','Registrar','Contexto y trazabilidad.'),(1286,'03','Analizar','Decisiones con datos.')]:
        d.rounded_rectangle((x,585,x+536,851),radius=22,fill=PANEL,outline='#394d3b',width=2)
        txt(d,(x+28,611),num,30,LIME,750)
        txt(d,(x+28,670),title,44,INK,750)
        txt(d,(x+28,750),body,24,MUTED,500)
    save(image,'valor',8,7)

    image=base();d=chrome(image,7,'LaPreDigital')
    pill(d,(94,204),'AGENTE NEGOCIADOR INTELIGENTE',True,23)
    lines(d,(90,335),'Cada interesado,\nmejor atendido.',104,1710,INK,800,1.13)
    txt(d,(100,650),'Gestión y análisis de leads en LaPreDigital',35,MUTED,500)
    txt(d,(102,774),'WhatsApp  ·  Telegram  ·  Consola comercial',28,LIME,600)
    save(image,'cierre',7,7)

    cursor=0
    for s in scenes:
        s['start']=cursor
        cursor+=s['duration']
        s['end']=cursor
    assert cursor==180
    (ROOT/'escenas.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2),encoding='utf8')
    board=Image.new('RGB',(1440,math.ceil(len(scenes)/3)*290),'#111819')
    bd=ImageDraw.Draw(board)
    for i,s in enumerate(scenes):
        img=Image.open(s['image']);img.thumbnail((468,264))
        x=i%3*480;y=i//3*290
        board.paste(img,(x+6,y+20));bd.text((x+10,y+3),f'{i+1:02} | {s["start"]:g} - {s["end"]:g}s | {s["name"]}',fill='white',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',13))
    board.save(ROOT/'storyboard.jpg',quality=90)
    print('Escenas:',len(scenes),'Duración:',cursor,flush=True)


if __name__=='__main__':
    build()
