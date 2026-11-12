import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';
export async function openHandoff(db, contact, reason, message) {
  return insert(
    db,
    `INSERT
  dbo.Derivacion (idContacto, idMotivoDerivacion, idMensajeOrigen)
VALUES
  (@contact, @reason, @message)`,
    { contact, reason, message },
  );
}
export async function getOpenHandoff(db, contact) {
  return (
    await query(
      db,
      `SELECT
  TOP 1 *
FROM
  dbo.Derivacion
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  idContacto = @contact
  AND fechaAtencion IS NULL
ORDER BY
  idDerivacion DESC`,
      { contact },
    )
  ).recordset[0];
}
export async function attendHandoff(db, id, operator) {
  return query(
    db,
    `UPDATE dbo.Derivacion
SET
  idOperador = @operator,
  fechaAtencion = ${now}
WHERE
  idDerivacion = @id
  AND fechaAtencion IS NULL`,
    { id, operator },
  );
}
export async function resumeExpired(db) {
  return query(
    db,
    `DECLARE @resumedContacts TABLE (idContacto bigint);

UPDATE dbo.Derivacion
SET
  fechaRetomaAgente = ${now}
OUTPUT INSERTED.idContacto INTO @resumedContacts
WHERE
  fechaAtencion IS NULL
  AND fechaRetomaAgente IS NULL
  AND DATEADD(
    HOUR,
    (
      SELECT
        valor
      FROM
        dbo.Param_Proceso
      WHERE
        codigo = N'ATENCION_DERIVACION_HORAS'
    ),
    fechaInicio
  ) <= ${now};

SELECT idContacto FROM @resumedContacts;`,
  );
}
