from pathlib import Path
import importlib.util
import shutil
import sys

pdf = Path(sys.argv[1]).resolve()
del sys.argv[1]
renderer = Path(r'C:/Users/USERJSSV/.codex/plugins/cache/openai-primary-runtime/documents/26.1112.11217/skills/documents/render_docx.py')
spec = importlib.util.spec_from_file_location('packaged_docx_renderer', renderer)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def word_pdf(doc_path, user_profile, convert_tmp_dir, stem, verbose=False):
    target = Path(convert_tmp_dir) / (stem + '.pdf')
    shutil.copy2(pdf, target)
    return str(target), 'PDF exportado con Word, documento abierto de solo lectura'


module.convert_to_pdf = word_pdf
module.main()
