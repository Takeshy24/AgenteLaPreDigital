import { query } from '../db.mjs';
export async function getParameters(db) {
  return Object.fromEntries(
    (
      await query(
        db,
        `SELECT
  codigo,
  valor
FROM
  dbo.Param_Proceso`,
      )
    ).recordset.map((row) => [row.codigo, row.valor]),
  );
}
