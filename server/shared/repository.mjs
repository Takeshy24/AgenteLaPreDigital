import { query } from '../db.mjs';
import { BusinessError } from './errors.mjs';
export const now = 'DATEADD(HOUR,-5,SYSUTCDATETIME())';
export async function insert(db, text, params = {}) {
  const result = await query(db, text + '; SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;', params);
  return result.recordset[0].id;
}
export async function getOperator(db) {
  const result = await query(
    db,
    `SELECT
  TOP 1 idOperador id
FROM
  dbo.Operador
WHERE
  nombreCompleto = SUSER_SNAME()
  AND activo = 1;`,
  );
  return (
    result.recordset[0]?.id ??
    (await insert(
      db,
      `INSERT
  dbo.Operador (nombreCompleto, rolOperador)
VALUES
  (SUSER_SNAME(), N'Administrador local')`,
    ))
  );
}
export async function getParticipation(db, id) {
  const result = await query(
    db,
    `SELECT
  lc.*,
  l.idContacto,
  l.idBeneficiario,
  c.idEstadoCaso
FROM
  dbo.LeadCaso lc
WITH
  (UPDLOCK, HOLDLOCK)
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Caso c ON c.idCaso = lc.idCaso
WHERE
  lc.idLeadCaso = @id`,
    { id },
  );
  if (!result.recordset.length) throw new BusinessError('Participación no encontrada', 404);
  return result.recordset[0];
}
export async function scheduleAttempts(db, id) {
  await query(
    db,
    `INSERT
  dbo.IntentoContacto (idLeadCaso, numeroIntento, fechaProgramada)
SELECT
  @id,
  a.numeroIntento,
  DATEADD(DAY, a.diaDesdeInicio, lc.fechaInicioElegibilidad)
FROM
  dbo.Param_AgendaIntento a
  CROSS JOIN dbo.LeadCaso lc
WHERE
  lc.idLeadCaso = @id
  AND NOT EXISTS (
    SELECT
      1
    FROM
      dbo.IntentoContacto i
    WHERE
      i.idLeadCaso = @id
  )`,
    { id },
  );
}
