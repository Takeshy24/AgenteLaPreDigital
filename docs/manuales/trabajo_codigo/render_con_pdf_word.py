import importlib.util
from pathlib import Path
import shutil
import sys

source_pdf=Path(sys.argv[1]).resolve()
del sys.argv[1]
skill=Path(r'C:\Users\USERJSSV\.codex\plugins\cache\openai-primary-runtime\documents\26.1111.10930\skills\documents\render_docx.py')
spec=importlib.util.spec_from_file_location('packaged_docx_renderer',skill)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def word_pdf(doc_path, user_profile, convert_tmp_dir, stem, verbose=False):
    if not source_pdf.is_file():
        raise FileNotFoundError(source_pdf)
    target=Path(convert_tmp_dir)/(stem+'.pdf')
    shutil.copy2(source_pdf,target)
    return str(target),'PDF exportado mediante Microsoft Word para Windows'

module.convert_to_pdf=word_pdf
module.main()
