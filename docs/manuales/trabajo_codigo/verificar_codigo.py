from pathlib import Path
from hashlib import sha256
from datetime import datetime
from collections import Counter
import json
import re
import sys
from docx import Document
from docx.oxml.ns import qn
from pypdf import PdfReader

WORK = Path(__file__).parent
OUT = WORK.parent
REPO = OUT.parents[1]
source = OUT / 'Manual_de_usuario_LaPreDigital.docx'
target = OUT / 'Manual_de_codigo_LaPreDigital.docx'
pdf_path = target.with_suffix('.pdf')
expected_sha = '2d3d78aea4fe7e3988990e7041ff5b5aaafd99dd687c33e187e593f51a5da1de'
state = json.loads((WORK / 'estado.json').read_text(encoding='utf-8'))
doc = Document(target)
original = Document(source)
pdf = PdfReader(pdf_path)
pages = [p.extract_text() or '' for p in pdf.pages]
full = '\n'.join(pages)
norm = lambda value: re.sub(r'\s+', ' ', value).strip()
checks = {}

def check(name, value):
    checks[name] = bool(value)

def headings(document):
    return [(p.style.name, p.text) for p in document.paragraphs
            if p.style.name in ('Heading 1', 'Heading 2')]

check('manual_usuario_inmutable', sha256(source.read_bytes()).hexdigest() == expected_sha)
check('mismos_51_titulos_en_orden', headings(doc) == headings(original) and len(headings(doc)) == 51)
check('12_modulos_y_39_opciones', Counter(style for style, text in headings(doc)) ==
      {'Heading 1': 12, 'Heading 2': 39})
toc = [p for p in doc.paragraphs if p.style.name.lower() in ('toc 1', 'toc 2')]
check('indice_automatico', any('TOC ' in (el.text or '') for el in doc.element.xpath('//w:instrText')))
check('indice_51_entradas', len(toc) == 51)
toc_errors = []
for p, (_, title) in zip(toc, headings(doc)):
    label, number = p.text.rsplit('\t', 1)
    label = norm(label)
    page = int(number)
    if title not in label or label not in norm(pages[page - 1]):
        toc_errors.append({'titulo': title, 'pagina': page})
check('paginas_del_indice_correctas', not toc_errors)
check('enlaces_indice_word', len(doc.element.xpath('//w:hyperlink[@w:anchor]')) >= 51)
pdf_links = sum(1 for p in pdf.pages for ref in p.get('/Annots', [])
                if ref.get_object().get('/Subtype') == '/Link')
check('enlaces_pdf', pdf_links >= 51)
check('sin_paginas_vacias', all(len(norm(p)) >= 35 for p in pages))
check('sin_campos_pendientes', not any(t in full for t in [
    'Índice pendiente de actualización', 'Error! Reference source not found',
    '¡Error! Marcador no definido', 'Error! Bookmark not defined']))
figures = [int(s) for s in re.findall(r'Figura\s+(\d+)', full)]
check('86_figuras_consecutivas', figures == list(range(1, 87)))
check('86_campos_secuencia', len(doc.element.xpath('//w:instrText[contains(text(),"SEQ Figura")]')) == 86)

def shapes(document, code=False):
    result = []
    for shape in document.inline_shapes:
        desc = shape._inline.docPr.get('descr', '')
        is_code = desc.startswith('Captura real')
        if is_code != code:
            continue
        blip = shape._inline.xpath('.//a:blip')[0]
        part = document.part.related_parts[blip.get(qn('r:embed'))]
        crops = shape._inline.xpath('.//a:srcRect')
        result.append({
            'sha256': sha256(part.blob).hexdigest(),
            'ancho': shape.width,
            'alto': shape.height,
            'recorte': dict(crops[0].attrib) if crops else {},
        })
    return result

ui = shapes(doc)
code = shapes(doc, True)
check('39_marcos_pantallas_iguales', ui == shapes(original) and len(ui) == 39)
check('49_capturas_reales', len(code) == 49)
manifest = {s['id']: s for s in json.loads((WORK / 'capturas_codigo/manifest.json').read_text(encoding='utf-8'))}
capture_hashes = Counter(sha256((WORK / 'capturas_codigo' / (key + '.png')).read_bytes()).hexdigest()
                         for key in manifest)
check('imagenes_codigo_son_capturas_originales', Counter(s['sha256'] for s in code) == capture_hashes)
check('88_imagenes_en_cuerpo', len(doc.inline_shapes) == 88)
check('codigo_conservado_desde_compilacion', all(
    sha256((REPO / name).read_bytes()).hexdigest() == value
    for name, value in state['fuentes_codigo'].items()))
check('49_archivos_y_rutas_verificables', len(manifest) == 49 and
      all((REPO / s['file']).is_file() for s in manifest.values()))

render = WORK / sys.argv[1] if len(sys.argv) > 1 else WORK / 'render-final'
check('todas_las_paginas_renderizadas', len(list(render.glob('page-*.png'))) == len(pages))
report = {
    'fecha': datetime.now().isoformat(timespec='seconds'),
    'paginas': len(pages), 'figuras': len(figures), 'capturas_codigo': len(code),
    'figuras_pantallas': 37, 'marcos_pantallas': len(ui), 'enlaces_pdf': pdf_links,
    'errores_indice': toc_errors, 'comprobaciones': checks,
    'salidas': {str(p): {'bytes': p.stat().st_size, 'sha256': sha256(p.read_bytes()).hexdigest()}
                for p in (target, pdf_path)},
}
(WORK / 'qa_final.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
(WORK / 'texto-render.txt').write_text('\n\n'.join(f'PÁGINA {i}\n{p}' for i, p in enumerate(pages, 1)), encoding='utf-8')
print(json.dumps({'paginas': len(pages), 'figuras': len(figures),
                  'comprobaciones': checks, 'errores_indice': toc_errors}, ensure_ascii=False))
if not all(checks.values()):
    raise SystemExit(1)
