from pathlib import Path
from copy import deepcopy
from hashlib import sha256
from datetime import datetime
import json, re
from PIL import Image
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from contenido_codigo import ENTRIES,EXTRAS

WORK=Path(__file__).parent
OUT=WORK.parent
REPO=OUT.parents[1]
SOURCE=OUT/'Manual_de_usuario_LaPreDigital.docx'
SOURCE_SHA=sha256(SOURCE.read_bytes()).hexdigest()
doc=Document(SOURCE)
shots={x['id']:x for x in json.loads((WORK/'capturas_codigo/manifest.json').read_text(encoding='utf-8'))}
entries={e['id']:e for e in ENTRIES}
extras={e['id']:e for e in EXTRAS}
modules=[]; option=None
for p in doc.paragraphs:
    if p.style.name=='Heading 1':
        modules.append({'title':p.text,'heading':deepcopy(p._p),'options':[]});option=None
    elif p.style.name=='Heading 2':
        key=f'{len(modules)}.{len(modules[-1]["options"])+1}'
        option={'key':key,'title':p.text,'heading':deepcopy(p._p),'screen':[]}
        modules[-1]['options'].append(option)
    elif option and (p._p.xpath('.//w:drawing') or p._p.xpath('.//w:instrText[contains(text(),"SEQ Figura")]') or p.style.name.lower()=='caption'):
        option['screen'].append(deepcopy(p._p))
assert len(modules)==14
assert sum(len(m['options']) for m in modules)==44
assert set(entries)=={o['key'] for m in modules for o in m['options']}

body=doc.element.body
for child in list(body):
    if child.tag!=qn('w:sectPr'):body.remove(child)

for sty in doc.styles:
    if sty.type==1:
        sty.font.color.rgb=RGBColor(0,0,0)
        for border in sty.element.xpath('.//w:pBdr'):border.getparent().remove(border)
doc.styles['Normal'].paragraph_format.line_spacing=1.18
doc.styles['Normal'].paragraph_format.space_after=Pt(6)
doc.styles['Caption'].paragraph_format.keep_with_next=True
doc.styles['Caption'].paragraph_format.space_after=Pt(4)
doc.styles['Caption'].paragraph_format.line_spacing=1.08

def append(element):body.insert(len(body)-1,deepcopy(element))
def para(text='',label=None,new_page=False):
    p=doc.add_paragraph()
    p.paragraph_format.page_break_before=new_page
    p.paragraph_format.keep_together=True
    if label=='Recorrido técnico':p.paragraph_format.keep_with_next=True
    if label:p.add_run(label+' ').bold=True
    p.add_run(text)
    return p
def sub(text):
    p=para(text);p.runs[0].bold=True
    p.paragraph_format.keep_with_next=True
    p.paragraph_format.space_before=Pt(10)
    return p
def field(p,instruction,cached):
    r=p.add_run()
    for typ in ('begin',):
        el=OxmlElement('w:fldChar');el.set(qn('w:fldCharType'),typ);r._r.append(el)
    el=OxmlElement('w:instrText');el.set(qn('xml:space'),'preserve');el.text=' '+instruction+' ';r._r.append(el)
    el=OxmlElement('w:fldChar');el.set(qn('w:fldCharType'),'separate');r._r.append(el)
    el=OxmlElement('w:t');el.text=cached;r._r.append(el)
    el=OxmlElement('w:fldChar');el.set(qn('w:fldCharType'),'end');r._r.append(el)
    return r

figures=0;code_figures=0
def caption(text):
    global figures
    figures+=1
    p=doc.add_paragraph(style='Caption')
    r=p.add_run('Figura ');r.bold=True;r.italic=True
    r=field(p,'SEQ Figura \\# "00"',str(figures).zfill(2));r.bold=True;r.italic=True
    return doc.add_paragraph(text,style='Caption')

def screen(elements):
    global figures
    for el in elements:
        new=deepcopy(el)
        if new.xpath('.//w:instrText[contains(text(),"SEQ Figura")]'):figures+=1
        append(new)

def code_figure(key):
    global code_figures
    s=shots[key]
    nums=sorted(set(int(n) for n in s['numbers'] if str(n).isdigit()))
    first=nums[0] if nums[0]==1 else nums[0]+1
    last=nums[-1]-1 if nums[-1]>first else nums[-1]
    caption(f'{s["file"]} líneas {first} a {last}')
    imagepath=WORK/'capturas_codigo'/f'{key}.png'
    with Image.open(imagepath) as im:iw,ih=im.size
    longest=max(len(line.expandtabs(2)) for line in s['lines']) if s['lines'] else 90
    width_px=min(iw-12,max(760,round(110+longest*10.8)))
    top=92
    bottom=min(ih-32,118+len(nums)*24)
    h=bottom-top
    w=width_px
    p=para();p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.line_spacing=1
    p.paragraph_format.space_after=Pt(7)
    finalw=min(15.5,10.4*w/h)
    finalh=finalw*h/w
    shape=p.add_run().add_picture(str(imagepath),width=Cm(finalw),height=Cm(finalh))
    src=OxmlElement('a:srcRect')
    for k,v in [('l',0),('t',top/ih),('r',(iw-w)/iw),('b',(ih-bottom)/ih)]:src.set(k,str(round(v*100000)))
    shape._inline.graphic.graphicData.pic.blipFill.insert(1,src)
    shape._inline.docPr.set('descr',f'Captura real de {s["file"]} líneas {first} a {last}')
    code_figures+=1

def table(headers,rows,widths,size=11):
    t=doc.add_table(rows=1,cols=len(headers));t.autofit=False;t.alignment=WD_TABLE_ALIGNMENT.CENTER
    borders=OxmlElement('w:tblBorders')
    for side in ('top','left','bottom','right','insideH','insideV'):
        el=OxmlElement('w:'+side);el.set(qn('w:val'),'single');el.set(qn('w:sz'),'5');el.set(qn('w:color'),'D9D9D9');borders.append(el)
    t._tbl.tblPr.append(borders)
    margins=OxmlElement('w:tblCellMar')
    for side,value in [('top','90'),('bottom','90'),('left','110'),('right','110')]:
        el=OxmlElement('w:'+side);el.set(qn('w:w'),value);el.set(qn('w:type'),'dxa');margins.append(el)
    t._tbl.tblPr.append(margins)
    for c,text in zip(t.rows[0].cells,headers):c.text=text
    rep=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(rep)
    for row in rows:
        for c,text in zip(t.add_row().cells,row):c.text=str(text)
    for ri,row in enumerate(t.rows):
        cant=OxmlElement('w:cantSplit');row._tr.get_or_add_trPr().append(cant)
        for ci,c in enumerate(row.cells):
            c.width=Cm(widths[ci]);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if ri==0:
                el=OxmlElement('w:shd');el.set(qn('w:fill'),'EDEDED');c._tc.get_or_add_tcPr().append(el)
            for p in c.paragraphs:
                p.paragraph_format.line_spacing=1.1;p.paragraph_format.space_after=Pt(0)
                for r in p.runs:r.font.size=Pt(size);r.font.name='Arial Narrow';r.bold=ri==0
    for i,w in enumerate(widths):t.columns[i].width=Cm(w)
    para().paragraph_format.space_after=Pt(0)

title=doc.add_paragraph('MANUAL DE CÓDIGO FUENTE',style='Title');title.alignment=WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.space_before=Pt(35);title.paragraph_format.space_after=Pt(95)
p=doc.add_paragraph('Agente negociador inteligente para la gestión y análisis de leads en LaPreDigital',style='Subtitle');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after=Pt(55)
p=para('Versión 1.0\nNoviembre de 2026');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p=sub('ÍNDICE GENERAL');p.paragraph_format.page_break_before=True
field(para(),'TOC \\o "1-2" \\h \\z \\u','Índice pendiente de actualización')

for mi,m in enumerate(modules,1):
    append(m['heading'])
    if mi==1:
        para('Este manual explica la implementación de las mismas opciones del manual de usuario. Está dirigido a quien mantiene el sistema y necesita localizar sus componentes, validaciones, reglas y operaciones de datos. Cada opción conserva su pantalla y la relaciona con capturas reales del código y una explicación técnica breve.')
        para('Las pantallas se reutilizan del manual de usuario con sus datos de demostración. Las imágenes de código se obtuvieron de los archivos actuales abiertos en Visual Studio Code Server desde el navegador integrado, sin recrear un editor. Los nombres de funciones y las líneas corresponden a esa revisión; una modificación posterior puede desplazar su ubicación.')
        sub('Arquitectura y responsabilidades')
        para('La interfaz React y TypeScript se compila con Vite. El estado de trabajo y los contratos HTTP conectan los componentes con una API Express en Node.js. Las rutas validan entradas con Zod; los servicios coordinan reglas y transacciones; los repositorios ejecutan SQL parametrizado. El adaptador Node inicia un trabajador PowerShell y utiliza System.Data.SqlClient para SQL Server. La lógica analítica consulta una base dimensional distinta del OLTP.')
        table(['Capa','Archivos y responsabilidad'],[
            ('Interfaz','src/LiveApp.tsx, src/pages y src/features componen las pantallas y sus acciones.'),
            ('Estado y contrato','src/state/Workspace.tsx y src/api.ts mantienen la selección y las peticiones HTTP.'),
            ('API','server/app.mjs y routes.mjs de cada dominio validan y publican las operaciones.'),
            ('Negocio','service.mjs coordina reglas, autorizaciones, evidencias y transacciones.'),
            ('Persistencia','repository.mjs, server/db.mjs y server/sql-worker.ps1 ejecutan las consultas.'),
            ('Integraciones','server/integrations y server/agent separan recepción, análisis, despacho y confirmación.'),
            ('Análisis','server/datamart, server/kpis y sql separan ETL, hechos dimensionales y tasas.'),
        ],[3.0,12.5])
        sub('Requisitos y configuración')
        para('El README requiere Windows, Node.js 20 o superior, PowerShell con .NET, sqlcmd y SQL Server. package.json define npm install, npm run build y npm start para preparar y ejecutar la aplicación. npm run server y npm run dev separan API y Vite durante el desarrollo. npm run migrate aplica las migraciones del OLTP, incluido el acceso del administrador, las reglas del agente y los documentos de Conocimiento; npm run knowledge:init carga los documentos iniciales. npm run up inicia la API junto con el túnel público usado por los webhooks. El esquema OLTP reside en script/LaPreDigital_OLTP.sql; la creación y actualización del Data Mart se coordinan con las herramientas de tools/datamart.mjs.')
        para('La configuración de ejemplo está en .env.example. DB_SERVER y DB_DATABASE identifican el OLTP; DATAMART_DATABASE selecciona la base analítica. OPENAI_API_KEY y OPENAI_MODEL configuran el modelo principal; OLLAMA_ENABLED, OLLAMA_URL y OLLAMA_MODEL, el respaldo local. Los nombres de configuración de SMTP, Telegram, WhatsApp y Stripe se consultan en sus adaptadores. Este manual no incluye valores de claves, contraseñas ni tokens operativos. No se requiere exponer el editor o las bases mediante un túnel para consultar el código.')
        code_figure('arquitectura-transaccion');para(extras['arquitectura-transaccion']['text'])
        code_figure('arquitectura-api');para(extras['arquitectura-api']['text'])
    for o in m['options']:
        key=o['key'];e=entries[key]
        append(o['heading'])
        screen(o['screen'])
        code_figure(e['shot'])
        if key=='6.4':code_figure('prioridad-regla')
        if key=='7.5':code_figure('acceso-cuenta')
        para(e['flow'],'Recorrido técnico')
        text=e['text'].replace('CasoNegociacion','Caso').replace('reevaluá','reevalúa')
        para(text,'Implementación')
        if key=='7.5':para(extras['acceso-cuenta']['text'])
        if key=='10.1':
            sub('Dimensiones y claves del modelo vigente')
            table(['Dimensión','Identificador de origen y atributos','Clave de relación'],[
                ('DimTiempo','fechaHora única; fecha, anio, trimestre, mes y dia','KeyTiempo'),
                ('DimContacto','idContacto; nombreCompleto','KeyContacto'),
                ('DimCanal','idCanal; nombre','KeyCanal'),
                ('DimRolContacto','idRolContacto; nombre','KeyRolContacto'),
                ('DimPlan','idPlan; nombre','KeyPlan'),
                ('DimPrioridad','idPrioridad; nombre','KeyPrioridad'),
                ('DimCaso','idCaso; beneficiario, estado y motivoCierre','KeyCaso'),
            ],[3.3,8.7,3.5])
            para('Todas las claves de relación se definen como INT IDENTITY. Los identificadores de origen se conservan como atributos únicos y no sustituyen las claves en las relaciones de hechos. DimTiempo conserva instantes DATETIME2 de precisión de segundos: sus roles permiten comparar elegibilidad, entrega, respuesta, pago y validación. La jerarquía temporal es año, trimestre, mes y día.')
            for extra in ['dimensiones-tiempo-contacto','dimensiones-catalogos','dimension-caso']:
                code_figure(extra);para(extras[extra]['text'])
            sub('Hechos y unidad de almacenamiento')
            table(['Hecho','Clave primaria y medidas'],[
                ('HechoContactoInicial','KeyCaso y KeyContacto; M1, M2 y M3.'),
                ('HechoAmpliacionPerfil','KeyContacto, KeyTiempo, KeyCanal y KeyRolContacto; M4 y M5.'),
                ('HechoVinculacionEconomica','KeyCaso y KeyTiempo; M6 y M7.'),
                ('HechoPropuestaComercial','KeyCaso, KeyTiempo, KeyCanal y KeyPlan; M8 y M9.'),
                ('HechoConversionPagada','KeyCaso; M10 y M11.'),
            ],[5.6,9.9])
            para('Los hechos contienen claves y medidas. Las claves temporales adicionales son distintos roles de DimTiempo. Las restricciones impiden, por ejemplo, que M3 supere M2 o que M11 supere M10 y exigen fechas cuando existe un logro. La unidad almacenada y la unidad del KPI se relacionan mediante la deduplicación de datamart-rows.mjs y count; una fila no equivale necesariamente a una persona distinta.')
            code_figure('hechos-claves');para(extras['hechos-claves']['text'])
            p=sub('Origen transaccional de las medidas');p.paragraph_format.page_break_before=True
            para('sql/etl_hechos.sql deriva las medidas de eventos del OLTP. Los valores almacenados son indicadores de pertenencia o logro; datamart-rows.mjs y count agrupan las unidades antes de calcular las tasas, por lo que no se suman filas sin considerar su granularidad.')
            table(['Medidas','Tablas de origen en el OLTP','Condición implementada'],[
                ('Contacto inicial\nM1, M2 y M3','LeadCaso, Lead, IntentoContacto y Mensaje','M1 identifica la participación con fechaInicioElegibilidad. M2 exige primera entrega de la agenda dentro de las 168 horas desde la elegibilidad. M3 exige M2 y un mensaje entrante no automático, posterior a esa entrega y dentro de las siguientes 168 horas.'),
                ('Perfil\nM4 y M5','PreguntaPerfil, Mensaje, LeadCaso y CambioPerfil','M4 identifica una pregunta entregada, agrupada por contacto, instante, canal y rol. M5 exige un CambioPerfil de tipo 1 o 2, sin idOperadorCorrige, cuya fechaRespuesta esté dentro de las 168 horas desde la entrega de la pregunta.'),
                ('Vinculación\nM6 y M7','NecesidadVinculacion, InvitacionVinculacion, AutorizacionVinculacion, AutorizacionContacto, LeadCaso, Lead y Mensaje','M6 identifica la primera necesidad nueva del caso en el mes, sin duplicar una necesidad anterior pendiente. M7 exige vínculo y las dos autorizaciones coincidentes y no revocadas al lograrse, dentro de las 168 horas desde la necesidad. fechaLogro toma el último de los tres instantes requeridos.'),
                ('Propuesta\nM8 y M9','PropuestaComercial, Mensaje, PlanTarifa y EventoCaso','M8 identifica una propuesta entregada, agrupada por caso, instante, canal y plan. M9 exige aceptación expresa dentro de las 168 horas desde la entrega: mensaje entrante no automático o evento contractual de tipo 5 sin corrección.'),
                ('Conversión\nM10 y M11','EvaluacionPrioridad, LeadCaso, Lead, Contratacion y EventoCaso','Se parte de la primera Alta válida y no corregida del caso. M10 vale 1 si no hay beca completa en su ventana de 168 horas. M11 exige además importe confirmado positivo, pago y validación contractual dentro de esa ventana y ausencia de reembolso invalidante en ella.'),
            ],[2.6,4.8,8.1],size=10.5)
            para('Las marcas de tiempo se relacionan mediante los distintos roles de DimTiempo. Las correcciones y exclusiones se resuelven en las vistas auxiliares del ETL; el repositorio de KPI recupera las claves y las medidas ya cargadas en el Data Mart.')
        if key=='10.4':
            for extra in ['etl-dimensiones','etl-hechos']:
                code_figure(extra);para(extras[extra]['text'])
            para('La carga de hechos usa vistas auxiliares definidas en el propio script y un patrón DELETE seguido de INSERT. No utiliza OUTER APPLY. Los instantes requeridos por los hechos se cargan antes en DimTiempo; después las uniones resuelven sus claves. El cargador omite los lotes USE y ejecuta cada lote en la base analítica configurada. Este manual documenta el proceso sin ejecutarlo sobre los datos operativos.')
        if key=='14.2':
            table(['Indicador','Fórmula','Unidad de análisis'],[
                ('L 1.1','M2 / M1 × 100','Participación elegible'),
                ('L 1.2','M3 / M2 × 100','Participación contactada'),
                ('L 2.1','M5 / M4 × 100','Contacto único por mes'),
                ('L 3.1','M7 / M6 × 100','Caso que requiere vinculación'),
                ('L 4.1','M9 / M8 × 100','Caso con propuesta entregada por mes'),
                ('L 5.1','M11 / M10 × 100','Caso desde su primera Alta'),
            ],[2.0,3.4,10.1])
            para('El informe define D1 a D6 y la tabla 10 determina las dimensiones aplicables a M1 a M11. El código actual añade DimCaso como soporte de las relaciones y permite el nivel de intento de compra al abrir el pago. Estas ampliaciones se distinguen de las definiciones originales. La etapa comercial, la prioridad, el estado de participación y el resultado de pago son atributos de procesos diferentes y no se intercambian para calcular las tasas.')
            p=sub('Verificación técnica y reproducción');p.paragraph_format.page_break_before=True
            para('Para reproducir los recorridos se utilizan las dependencias y variables descritas en el capítulo 1. La base elegida determina los registros que se verán; las pantallas de este manual conservan el conjunto de demostración del manual de usuario. Las comprobaciones siguientes describen la evidencia que debe revisar el mantenedor y no representan pruebas operativas ejecutadas durante esta documentación.')
            table(['Comprobación','Punto de entrada y evidencia esperada'],[
                ('Preparación','npm install y npm run build preparan dependencias y compilan TypeScript y Vite. npm start inicia la API y sirve la compilación disponible.'),
                ('Consola y persistencia','GET /api/bootstrap carga los datos iniciales del OLTP. Al abrir una participación, GET /api/participations/:id debe devolver el expediente correspondiente, separado de los indicadores.'),
                ('Origen analítico','GET /api/kpis devuelve el origen dimensional y los resultados con los filtros elegidos. El resumen de Inicio procede de otra consulta. La ausencia de denominador debe mostrarse como No aplicable.'),
                ('Actualización dimensional','npm run datamart:init crea y carga el modelo; npm run datamart:refresh repite la carga. El botón Actualizar datos utiliza POST /api/kpis/refresh. Son operaciones de escritura sobre la base analítica configurada.'),
                ('Contratación y entrega','La evidencia distingue aceptación, pago confirmado, validación, habilitación y entrega de credenciales. Sus registros, identificadores y estados se comprueban en el expediente y en Pendientes.'),
                ('Pruebas del proyecto','npm test utiliza node:test. server/tests reúne escenarios comerciales, de captación, integraciones y Data Mart; sus archivos y configuración deben revisarse antes de ejecutarlos en el entorno de prueba.'),
            ],[3.5,12.0])

all_paragraphs=doc.paragraphs
for i,p in enumerate(all_paragraphs):
    props=p._p.xpath('.//wp:docPr')
    if props and props[0].get('descr','').startswith('Captura real'):
        nxt=all_paragraphs[i+1] if i+1<len(all_paragraphs) else None
        p.paragraph_format.keep_with_next=bool(nxt is not None and nxt.style.name.lower()!='caption')
for i,pr in enumerate(doc.element.xpath('//wp:docPr'),1):pr.set('id',str(i))
for p in doc.paragraphs:
    for b in p._p.xpath('.//w:pBdr'):b.getparent().remove(b)
doc.core_properties.title='Manual de código fuente de LaPreDigital'
doc.core_properties.subject='Agente negociador inteligente para la gestión y análisis de leads en LaPreDigital'
doc.core_properties.author='LaPreDigital'
doc.core_properties.comments='Capturas reales del código y las mismas pantallas del manual de usuario.'
doc.save(OUT/'Manual_de_codigo_LaPreDigital.docx')
assert sha256(SOURCE.read_bytes()).hexdigest()==SOURCE_SHA
inventory={'fase':'Word completo generado pendiente de render y revisión','modulos':14,'opciones':44,'titulos':58,'figuras':figures,'capturas_codigo':code_figures,'fuente_usuario_sha256':SOURCE_SHA,'fuentes_codigo':{e['file']:sha256((REPO/e['file']).read_bytes()).hexdigest() for e in ENTRIES+EXTRAS},'respaldos_periodicos':False}
(WORK/'estado.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in inventory.items() if k!='fuentes_codigo'},ensure_ascii=False))
