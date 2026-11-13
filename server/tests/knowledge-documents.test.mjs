import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { get as httpGet } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { app } from '../app.mjs';
import { loginAdmin } from '../test-support/login.mjs';
import { close, query, rollbackTest } from '../db.mjs';
import { extractDocument, MAX_FILE_SIZE } from '../knowledge/extract.mjs';
import { splitContent, searchDocuments } from '../knowledge/search.mjs';
import {
  createDocument,
  updateDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  knowledgeFragments,
  previewSearch,
  downloadOriginal,
} from '../knowledge/service.mjs';
import { answerFromKnowledge } from '../agent/knowledge.mjs';
import { analyzeMessage } from '../agent/ollama.mjs';
import { actOnAnalysis } from '../agent/service.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';

const draft = () => ({
  title: 'Documento de prueba',
  content: 'El zafiro lunar está en la biblioteca.',
  keywords: 'zafiro, lunar',
  source: 'Prueba con rollback',
  active: false,
});
const baseAnalysis = () => ({
  level: 2,
  retraction: false,
  action: 'ask',
  tariffId: null,
  fields: [],
  understood: true,
  needsGuardian: false,
  guardian: null,
});

test('documentos: fragmentos acotados sin perder texto y búsqueda con acentos y fuentes', () => {
  const content = 'Información académica y texto de consulta.\n'.repeat(240);
  const parts = splitContent(content);
  assert.ok(parts.length > 1 && parts.every((part) => part.length <= 1600));
  assert.equal(parts.join('').replace(/\s/g, ''), content.replace(/\s/g, ''));
  const fragments = [
    {
      documentId: 9,
      title: 'Atención académica',
      keywords: 'atención',
      source: 'Guía',
      version: 2,
      position: 1,
      content: 'Estamos los lunes.',
    },
  ];
  const [found] = searchDocuments('¿Cómo es la atencion académica?', fragments);
  assert.equal(found.chunk.id, 'documento:9:1:v2');
  assert.match(found.chunk.source, /Guía.*versión 2/);
  assert.equal(searchDocuments('hola gracias', fragments).length, 0);
  assert.equal(searchDocuments('matrícula semestral', fragments).length, 0);
});

test('documentos: las respuestas usan solo el documento, sin respaldo del catálogo ni de archivos', () => {
  const tariffs = [{ plan: 'Ruta UNT', modalidad: 'Mensual', precio: 39.9 }];
  const fragments = [
    {
      documentId: 9,
      title: 'Precio cuesta Ruta',
      keywords: 'precio, cuesta, ruta',
      source: 'Prueba',
      version: 1,
      position: 1,
      content: 'Ruta cuesta S/ 1.00.',
    },
  ];
  const answer = answerFromKnowledge('¿Qué precio cuesta Ruta?', tariffs, fragments);
  assert.match(answer.text, /1\.00/);
  assert.doesNotMatch(answer.text, /39\.90/);
  assert.match(answer.sources[0].id, /^documento:9:/);
  assert.equal(answerFromKnowledge('¿Qué precio cuesta Ruta?', tariffs, []), null);
  assert.equal(answerFromKnowledge('¿Qué medios de pago aceptan?', tariffs, []), null);
});

test('documentos: extracción real de TXT, Markdown, Word y PDF', async () => {
  for (const name of ['guia.txt', 'guia.md']) {
    const data = await extractDocument(
      name,
      Buffer.from('Atención académica\r\nLunes').toString('base64'),
    );
    assert.equal(data.content, 'Atención académica\nLunes');
  }
  const word = readFileSync(new URL('./fixtures/knowledge.docx', import.meta.url));
  assert.match(
    (await extractDocument('guia.docx', word.toString('base64'))).content,
    /Guía de soporte académico/,
  );
  const pdf = new PDFDocument();
  const chunks = [];
  pdf.on('data', (chunk) => chunks.push(chunk));
  const end = once(pdf, 'end');
  pdf.text('El soporte abre los lunes.');
  pdf.end();
  await end;
  const result = await extractDocument('guia.pdf', Buffer.concat(chunks).toString('base64'));
  assert.match(result.content, /El soporte abre los lunes/);
  assert.doesNotMatch(result.content, /-- 1 of 1 --/);
});

test('documentos: rechaza formatos falsos, base64 inválido, texto vacío y límites', async () => {
  const encoded = (value) => Buffer.from(value).toString('base64');
  for (const [name, body, message] of [
    ['script.exe', encoded('algo'), /TXT, MD, DOCX o PDF/],
    ['guia.txt', 'abc', /codificación/],
    ['guia.pdf', encoded('no es PDF'), /tipo de archivo/],
    ['guia.docx', encoded('PK falso'), /extraer el texto/],
    ['guia.txt', encoded('  \n '), /No se encontró texto/],
    ['guia.txt', encoded('a'.repeat(200001)), /200 000/],
    ['guia.txt', Buffer.alloc(MAX_FILE_SIZE + 1).toString('base64'), /2 MB/],
    ['guia.txt', Buffer.from([0xff, 0xfe]).toString('base64'), /UTF-8/],
  ])
    await assert.rejects(() => extractDocument(name, body), message);
});

test('documentos SQL: borrador, activación, edición, conflicto, original y eliminación coherentes', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = draft();
      const bytes = Buffer.from(data.content);
      let doc = await createDocument(data, { name: 'zafiro.txt', format: 'txt', bytes });
      const id = doc.id;
      assert.equal(doc.active, false);
      assert.equal((await getDocument(id)).content, data.content);
      assert.ok((await listDocuments()).some((item) => item.id === id));
      assert.equal((await previewSearch('zafiro lunar')).length, 0);
      const original = await downloadOriginal(id);
      assert.equal(original.name, 'zafiro.txt');
      assert.deepEqual(original.bytes, bytes);
      doc = await updateDocument(id, { ...data, active: true, version: doc.version });
      assert.equal(doc.version, 2);
      assert.ok(
        (await previewSearch('zafiro lunar')).some((item) =>
          item.id.startsWith(`documento:${id}:`),
        ),
      );
      await assert.rejects(
        () => updateDocument(id, { ...data, version: 1 }),
        (error) => error.status === 409,
      );
      await assert.rejects(
        () => deleteDocument(id, 1),
        (error) => error.status === 409,
      );
      await assert.rejects(
        () => updateDocument(id, { ...data, content: ' ', version: 2 }),
        /debe tener texto/,
      );
      doc = await updateDocument(id, {
        ...data,
        content: 'El ámbar celeste está en otro estante.',
        keywords: 'ámbar, celeste',
        active: true,
        version: 2,
      });
      assert.equal((await previewSearch('zafiro lunar')).length, 0);
      assert.ok(
        (await previewSearch('ambar celeste')).some((item) =>
          item.id.startsWith(`documento:${id}:`),
        ),
      );
      assert.deepEqual((await downloadOriginal(id)).bytes, bytes);
      await deleteDocument(id, doc.version);
      await assert.rejects(
        () => getDocument(id),
        (error) => error.status === 404,
      );
      assert.equal((await previewSearch('ambar celeste')).length, 0);
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) total FROM dbo.App_KnowledgeFragment WHERE idDocumento=@id',
            { id },
          )
        ).recordset[0].total,
        0,
      );
    });
  } finally {
    await close();
  }
});

test('agente: consulta la versión SQL, conserva su fuente y responde sin iniciar preguntas de perfil', async () => {
  const enabled = process.env.OLLAMA_ENABLED;
  process.env.OLLAMA_ENABLED = 'true';
  try {
    await rollbackTest(async (db) => {
      const doc = await createDocument({ ...draft(), active: true });
      const question = '¿Dónde está el zafiro lunar?';
      let prompt;
      const analysis = await analyzeMessage(question, [], {
        provider: 'ollama',
        fetcher: async (_url, options) => {
          prompt = JSON.parse(options.body).messages[0].content;
          return {
            ok: true,
            json: async () => ({ message: { content: JSON.stringify(baseAnalysis()) } }),
          };
        },
      });
      assert.match(prompt, /El zafiro lunar está en la biblioteca/);
      assert.equal(analysis.action, 'catalog');
      assert.ok(analysis.sources.some((item) => item.id.startsWith(`documento:${doc.id}:`)));
      const lead = await createLead({
        name: 'Prueba documental',
        email: `${randomUUID()}@example.test`,
        phone: '+51912345678',
        role: 1,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      });
      const message = await recordIncoming(lead.id, { text: question, channel: 2, level: 2 });
      await actOnAnalysis(lead.id, message.id, question, baseAnalysis());
      const reply = (
        await query(
          db,
          'SELECT TOP 1 textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 ORDER BY idMensaje DESC',
          { id: lead.id },
        )
      ).recordset[0];
      assert.match(reply.text, /El zafiro lunar está en la biblioteca/);
      assert.doesNotMatch(reply.text, /carrera|cuánto tiempo/i);
      assert.ok((await knowledgeFragments()).some((item) => item.documentId === doc.id));
    });
  } finally {
    if (enabled === undefined) delete process.env.OLLAMA_ENABLED;
    else process.env.OLLAMA_ENABLED = enabled;
    await close();
  }
});

test('documentos HTTP: lectura local, validaciones y bloqueo público', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/knowledge`;
  try {
    const fetch = await loginAdmin(url);
    const response = await fetch(`${url}/documents`);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(await response.json()));
    assert.equal((await fetch(`${url}/policy`)).status, 200);
    assert.equal(
      (
        await fetch(`${url}/policy`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      400,
    );
    for (const [path, method, data] of [
      ['/documents', 'POST', { ...draft(), title: 'x' }],
      ['/documents/1', 'PATCH', { ...draft(), version: 0 }],
      ['/documents/1', 'DELETE', {}],
      ['/search', 'POST', { text: '  ' }],
      ['/import', 'POST', { name: 'test.pdf', base64: 'aGVsbG8=' }],
    ])
      assert.equal(
        (
          await fetch(url + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        ).status,
        400,
      );
    assert.equal(
      (await fetch(`${url}/documents`, { headers: { Origin: 'https://otro.example' } })).status,
      403,
    );
    assert.equal(
      await new Promise((resolve, reject) => {
        httpGet(`${url}/documents`, { headers: { Host: 'public.example' } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        }).on('error', reject);
      }),
      403,
    );
    assert.equal(
      (await fetch(`${url}/documents`, { method: 'POST', body: 'no-json' })).status,
      415,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await close();
  }
});
