import { fork } from 'node:child_process';
import { BusinessError } from '../shared/errors.mjs';
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const MAX_CONTENT_LENGTH = 200000;
export async function extractDocument(fileName, base64) {
  const name = String(fileName)
    .split(/[\\/]/)
    .at(-1)
    .replace(/[\x00-\x1f]/g, '');
  const format = name.split('.').at(-1).toLowerCase();
  if (!['txt', 'md', 'docx', 'pdf'].includes(format))
    throw new BusinessError('Usa un archivo TXT, MD, DOCX o PDF.', 400);
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
    throw new BusinessError('El archivo no tiene una codificación válida.', 400);
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.toString('base64') !== base64)
    throw new BusinessError('El archivo no tiene una codificación válida.', 400);
  if (!bytes.length || bytes.length > MAX_FILE_SIZE)
    throw new BusinessError('El archivo debe pesar entre 1 byte y 2 MB.', 400);
  if (
    (format === 'pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') ||
    (format === 'docx' && bytes.subarray(0, 2).toString() !== 'PK')
  )
    throw new BusinessError('El contenido no corresponde al tipo de archivo.', 400);
  const content = await new Promise((resolve, reject) => {
    let settled = false;
    // Un PDF dañado o un fallo nativo del lector no debe cerrar el proceso de la API.
    const worker = fork(new URL('./extract-worker.mjs', import.meta.url), [], {
      execArgv: ['--max-old-space-size=128'],
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      serialization: 'advanced',
    });
    const timer = setTimeout(() => {
      settled = true;
      worker.kill();
      reject(
        new BusinessError(
          'No se pudo leer el archivo a tiempo. Prueba con un documento más pequeño.',
          400,
        ),
      );
    }, 20000);
    const finish = () => {
      clearTimeout(timer);
      if (worker.connected) worker.disconnect();
    };
    worker.once('message', (result) => {
      settled = true;
      finish();
      if (result.error)
        reject(
          new BusinessError(
            'No se pudo extraer el texto. Revisa que el archivo no esté dañado ni protegido y que use UTF-8 si es TXT o MD.',
            400,
          ),
        );
      else resolve(result.content);
    });
    worker.once('error', () => {
      settled = true;
      finish();
      reject(
        new BusinessError(
          'No se pudo leer el archivo. Prueba con una versión más pequeña o con texto.',
          400,
        ),
      );
    });
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (!settled) reject(new BusinessError('La lectura del archivo se interrumpió.', 400));
    });
    worker.send({ bytes, format });
  });
  const clean = String(content)
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
  if (!clean)
    throw new BusinessError(
      'No se encontró texto. Los PDF escaneados necesitan OCR antes de subirlos.',
      400,
    );
  if (clean.length > MAX_CONTENT_LENGTH)
    throw new BusinessError(
      'Máximo 200 000 caracteres de texto por documento. Divide el archivo.',
      400,
    );
  return { name, format, bytes, content: clean };
}
