from copy import deepcopy
from pathlib import Path
from zipfile import ZipFile
import json
from lxml import etree as ET

ROOT = Path(__file__).resolve().parent
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
Q = lambda name: '{' + NS['w'] + '}' + name


def text(paragraph):
    return ''.join(paragraph.xpath('.//w:t/text()', namespaces=NS))


for name in ('usuario', 'codigo'):
    source = ROOT / f'{name}_original.docx'
    target = ROOT / f'{name}_corregido.docx'
    with ZipFile(source) as original:
        xml = original.read('word/document.xml')
        document = ET.fromstring(xml)
        styles = ET.fromstring(original.read('word/styles.xml'))
        style_names = {
            s.get(Q('styleId')): s.find('w:name', NS).get(Q('val'))
            for s in styles.findall('w:style', NS)
            if s.find('w:name', NS) is not None
        }
        paragraphs = document.findall('.//w:p', NS)
        before = [ET.tostring(p, method='c14n') for p in paragraphs]
        before_text = [text(p) for p in paragraphs]
        headings = []
        for index, paragraph in enumerate(paragraphs):
            style = paragraph.find('w:pPr/w:pStyle', NS)
            name_style = style_names.get(style.get(Q('val'))) if style is not None else None
            if name_style in ('heading 1', 'heading 2'):
                headings.append((index, paragraph, int(name_style[-1])))
        assert len(headings) == 58
        # Una única lista multinivel mantiene los contadores de todos los títulos.
        number_id = headings[0][1].find('w:pPr/w:numPr/w:numId', NS).get(Q('val'))
        chapter = sub = 0
        outline = []
        touched = set()
        for index, paragraph, level in headings:
            number = paragraph.find('w:pPr/w:numPr/w:numId', NS)
            assert number is not None
            assert paragraph.find('w:pPr/w:numPr/w:ilvl', NS).get(Q('val')) == str(level - 1)
            number.set(Q('val'), number_id)
            if level == 1:
                chapter += 1
                sub = 0
            else:
                sub += 1
            prefix = str(chapter) if level == 1 else f'{chapter}.{sub}'
            outline.append(prefix + ' ' + text(paragraph))
            touched.add(index)
        assert chapter == 14
        figures = []
        for index, paragraph in enumerate(paragraphs):
            if not text(paragraph).startswith('Figura '):
                continue
            instructions = paragraph.findall('.//w:instrText', NS)
            assert len(instructions) == 1 and instructions[0].text.strip().lower().startswith('seq figura')
            cached = text(paragraph)[7:].strip()
            assert int(cached) == len(figures) + 1
            figures.append(cached)
            # Google Docs representa SEQ como un símbolo. Se conserva su resultado numérico
            # y el estilo de cada run; no se toca ningún otro campo ni la leyenda.
            for node in paragraph.xpath('.//w:instrText | .//w:fldChar', namespaces=NS):
                node.getparent().remove(node)
            for run in list(paragraph.findall('w:r', NS)):
                if not any(child.tag != Q('rPr') for child in run):
                    paragraph.remove(run)
            touched.add(index)
        assert len(figures) == (45 if name == 'usuario' else 99)
        assert [text(p) for p in paragraphs] == before_text
        for index, paragraph in enumerate(paragraphs):
            if index not in touched:
                assert ET.tostring(paragraph, method='c14n') == before[index]
        edited_xml = ET.tostring(document, encoding='UTF-8', xml_declaration=True, standalone=True)
        with ZipFile(target, 'w') as output:
            for entry in original.infolist():
                output.writestr(entry, edited_xml if entry.filename == 'word/document.xml' else original.read(entry.filename))
    with ZipFile(source) as a, ZipFile(target) as b:
        assert a.namelist() == b.namelist()
        changed = [key for key in a.namelist() if a.read(key) != b.read(key)]
        assert changed == ['word/document.xml']
    report = {'source': str(source), 'output': str(target), 'changed_parts': changed,
              'chapters': chapter, 'headings': len(headings), 'figures': len(figures),
              'all_text_preserved': True, 'unrelated_paragraphs_unchanged': True,
              'outline': outline, 'figure_numbers': figures}
    (ROOT / f'{name}_verificacion.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ('outline', 'figure_numbers')}, ensure_ascii=True))
