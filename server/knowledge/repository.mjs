import { query } from '../db.mjs';

const fields = `d.idDocumento id, d.titulo title, d.palabrasClave keywords, d.fuente source,
  d.activo active, d.version version, d.nombreArchivo fileName, d.tipoArchivo format,
  d.fechaCreacion createdAt, d.fechaActualizacion updatedAt,
  LEN(d.contenido) characters,
  (SELECT COUNT(*) FROM dbo.App_KnowledgeFragment f WHERE f.idDocumento=d.idDocumento) fragments`;

export async function ready(db) {
  const row = (
    await query(
      db,
      "SELECT OBJECT_ID(N'dbo.App_KnowledgeDocument', N'U') documentTable, OBJECT_ID(N'dbo.App_KnowledgeFragment', N'U') fragmentTable",
    )
  ).recordset[0];
  return !!(row.documentTable && row.fragmentTable);
}
export async function list(db) {
  return (
    await query(
      db,
      `SELECT ${fields} FROM dbo.App_KnowledgeDocument d ORDER BY d.fechaActualizacion DESC, d.idDocumento DESC`,
    )
  ).recordset;
}
export async function get(db, id, { lock = false } = {}) {
  return (
    await query(
      db,
      `SELECT ${fields}, d.contenido content FROM dbo.App_KnowledgeDocument d ${lock ? 'WITH (UPDLOCK)' : ''} WHERE d.idDocumento=@id`,
      { id },
    )
  ).recordset[0];
}
export async function findSource(db, key) {
  return (
    await query(
      db,
      'SELECT idDocumento id FROM dbo.App_KnowledgeDocument WITH (UPDLOCK,HOLDLOCK) WHERE claveOrigen=@key',
      { key },
    )
  ).recordset[0];
}
export async function add(db, data) {
  return (
    await query(
      db,
      `DECLARE @new TABLE (id INT);
INSERT dbo.App_KnowledgeDocument (titulo, contenido, palabrasClave, fuente, activo, nombreArchivo, tipoArchivo, archivoOriginal, claveOrigen)
OUTPUT INSERTED.idDocumento INTO @new
VALUES (@title, @content, @keywords, @source, @active, @fileName, @format, CONVERT(VARBINARY(MAX), @fileHex, 2), @sourceKey);
SELECT id FROM @new`,
      data,
    )
  ).recordset[0].id;
}
export async function update(db, id, data) {
  return query(
    db,
    `UPDATE dbo.App_KnowledgeDocument
SET titulo=@title, contenido=@content, palabrasClave=@keywords, fuente=@source, activo=@active,
    version=version+1, fechaActualizacion=DATEADD(HOUR,-5,SYSUTCDATETIME())
WHERE idDocumento=@id AND version=@version`,
    { id, ...data },
  );
}
export async function remove(db, id) {
  await query(
    db,
    'DELETE dbo.App_KnowledgeFragment WHERE idDocumento=@id; DELETE dbo.App_KnowledgeDocument WHERE idDocumento=@id',
    { id },
  );
}
export async function index(db, id, fragments) {
  await query(db, 'DELETE dbo.App_KnowledgeFragment WHERE idDocumento=@id', { id });
  await query(
    db,
    `INSERT dbo.App_KnowledgeFragment (idDocumento, numero, contenido)
SELECT @id, CAST([key] AS INT)+1, value FROM OPENJSON(@fragments)`,
    { id, fragments: JSON.stringify(fragments) },
  );
}
export async function activeFragments(db) {
  return (
    await query(
      db,
      `SELECT d.idDocumento documentId, d.titulo title, d.palabrasClave keywords,
d.fuente source, d.version version, f.numero position, f.contenido content
FROM dbo.App_KnowledgeDocument d INNER JOIN dbo.App_KnowledgeFragment f ON f.idDocumento=d.idDocumento
WHERE d.activo=1 ORDER BY d.idDocumento, f.numero`,
    )
  ).recordset;
}
export async function original(db, id) {
  return (
    await query(
      db,
      `SELECT nombreArchivo fileName, CONVERT(VARCHAR(MAX), archivoOriginal, 2) fileHex
FROM dbo.App_KnowledgeDocument WHERE idDocumento=@id AND archivoOriginal IS NOT NULL`,
      { id },
    )
  ).recordset[0];
}
