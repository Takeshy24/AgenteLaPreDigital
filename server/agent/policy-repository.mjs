import { query } from '../db.mjs';
export async function readPolicy(db, { lock = false } = {}) {
  return (
    await query(
      db,
      `SELECT configuracion settings, version FROM dbo.App_AgentPolicy ${lock ? 'WITH (UPDLOCK)' : ''} WHERE id=1`,
    )
  ).recordset[0];
}
export async function updatePolicy(db, settings, version) {
  return query(
    db,
    `UPDATE dbo.App_AgentPolicy
SET configuracion=@settings, version=version+1,
fechaActualizacion=DATEADD(HOUR,-5,SYSUTCDATETIME())
WHERE id=1 AND version=@version`,
    { settings: JSON.stringify(settings), version },
  );
}
