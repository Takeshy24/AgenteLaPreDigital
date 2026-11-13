import { transaction, pool } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import * as repository from './repository.mjs';
import { splitContent } from './search.mjs';
import { retrieve } from '../agent/knowledge.mjs';
export const NO_INFORMATION =
  'No encuentro esa información en los documentos disponibles. Puedo ayudarte con otra consulta o derivarte al equipo.';

export async function requireKnowledge(db) {
  if (!(await repository.ready(db)))
    throw new BusinessError(
      'Falta preparar la base de conocimiento. Ejecuta npm run migrate y npm run knowledge:init.',
      503,
    );
}
export async function listDocuments() {
  const db = await pool();
  await requireKnowledge(db);
  return repository.list(db);
}
export async function getDocument(id) {
  const db = await pool();
  await requireKnowledge(db);
  const doc = await repository.get(db, id);
  if (!doc) throw new BusinessError('El documento ya no existe.', 404);
  return doc;
}
export async function createDocument(data, file = null) {
  return transaction(async (db) => {
    await requireKnowledge(db);
    const content = data.content.trim();
    if (!content) throw new BusinessError('El documento debe tener texto.', 400);
    const id = await repository.add(db, {
      ...data,
      content,
      fileName: file?.name ?? null,
      format: file?.format ?? 'md',
      fileHex: file?.bytes.toString('hex') ?? null,
      sourceKey: null,
    });
    await repository.index(db, id, splitContent(content));
    return repository.get(db, id);
  });
}
export async function updateDocument(id, data) {
  return transaction(async (db) => {
    await requireKnowledge(db);
    const current = await repository.get(db, id, { lock: true });
    if (!current) throw new BusinessError('El documento ya no existe.', 404);
    if (current.version !== data.version)
      throw new BusinessError('El documento cambió en otra sesión. Recarga antes de editar.');
    const content = data.content.trim();
    if (!content) throw new BusinessError('El documento debe tener texto.', 400);
    await repository.update(db, id, { ...data, content });
    await repository.index(db, id, splitContent(content));
    return repository.get(db, id);
  });
}
export async function deleteDocument(id, version) {
  return transaction(async (db) => {
    await requireKnowledge(db);
    const current = await repository.get(db, id, { lock: true });
    if (!current) throw new BusinessError('El documento ya no existe.', 404);
    if (current.version !== version)
      throw new BusinessError('El documento cambió en otra sesión. Recarga antes de eliminar.');
    await repository.remove(db, id);
    return { deleted: true };
  });
}
export async function knowledgeFragments() {
  const db = await pool();
  await requireKnowledge(db);
  return repository.activeFragments(db);
}
export async function previewSearch(text) {
  return retrieve(text, [], 3, await knowledgeFragments()).map(({ chunk, score }) => ({
    id: chunk.id,
    title: chunk.title,
    source: chunk.source,
    content: chunk.render(),
    score,
  }));
}
export async function downloadOriginal(id) {
  await getDocument(id);
  const data = await repository.original(await pool(), id);
  if (!data)
    throw new BusinessError(
      'Este documento fue creado en el editor y no tiene archivo original.',
      404,
    );
  return { name: data.fileName, bytes: Buffer.from(data.fileHex, 'hex') };
}
