from pathlib import Path
from docx import Document
from pypdf import PdfReader
import pypdfium2 as pdfium
import json

work=Path(__file__).parent
downloads=Path(r'C:\Users\USERJSSV\Downloads')
guide=Document(downloads/'MANUAL DE CODIGO FUENTE.docx')
guide_text='\n'.join(p.text for p in guide.paragraphs)
pdfpath=downloads/'MANUAL DE APLICACION CODIGO FUENTE.pdf'
pdf=PdfReader(pdfpath)
report=Document(downloads/'Informe_LEADS_LaPreDigital_David_Takeshy_Business_Intelligence_v32.docx')
report_text='\n'.join(p.text for p in report.paragraphs)
tables=['\n'.join(' | '.join(c.text for c in r.cells) for r in t.rows) for t in report.tables]
data={'requerimiento':guide_text,'ejemplo_paginas':len(pdf.pages),'ejemplo_texto':[p.extract_text() for p in pdf.pages],'informe':report_text,'tablas':tables}
(work/'referencias.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
render=pdfium.PdfDocument(str(pdfpath))
for n in [0,1,2]:
    if n<len(render):render[n].render(scale=1.3).to_pil().save(work/f'ejemplo-codigo-{n+1}.png')
source=Document(work.parent/'Manual_de_usuario_LaPreDigital.docx')
print(guide_text)
print('Páginas del ejemplo:',len(pdf.pages))
print('Estilos de títulos:',[(p.text,p.style.name,p.style.style_id) for p in source.paragraphs if p.style.name.lower().startswith('heading')][:4])
print('Tablas del informe con dimensiones:')
for t in tables:
    if 'Dimensión' in t or 'M10' in t:print(t[:3800])
