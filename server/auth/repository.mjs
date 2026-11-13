import { query } from '../db.mjs';

export async function findAdmin(db, username) {
  const ready = (await query(db, "SELECT OBJECT_ID(N'dbo.App_AdminUser', N'U') id")).recordset[0];
  if (!ready.id) return { missing: true };
  return (
    await query(
      db,
      `SELECT id, usuario username, claveHash passwordHash
FROM dbo.App_AdminUser WHERE id=1 AND usuario=@username`,
      { username },
    )
  ).recordset[0];
}
