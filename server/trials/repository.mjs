import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';
export async function getTrial(db, beneficiary) {
  return (
    await query(
      db,
      `SELECT
  *
FROM
  dbo.PruebaGratuita
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  idBeneficiario = @beneficiary`,
      { beneficiary },
    )
  ).recordset[0];
}
export async function saveTrialLink(db, hash, id) {
  await query(
    db,
    `INSERT
  dbo.App_TrialLink (codeHash, idLeadCaso, expiresAt)
VALUES
  (@hash, @id, DATEADD(HOUR, 24, ${now}))`,
    { hash, id },
  );
}
export async function getTrialLink(db, hash) {
  return (
    await query(
      db,
      `SELECT
  *
FROM
  dbo.App_TrialLink
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  codeHash = @hash
  AND usedAt IS NULL
  AND expiresAt > ${now}`,
      { hash },
    )
  ).recordset[0];
}
export async function createTrial(db, beneficiary, id, days, hash) {
  const trial = await insert(
    db,
    `INSERT
  dbo.PruebaGratuita (idBeneficiario, idLeadCaso, fechaFin)
VALUES
  (
    @beneficiary,
    @id,
    DATEADD(DAY, @days, ${now})
  )`,
    { beneficiary, id, days },
  );
  await query(
    db,
    `UPDATE dbo.App_TrialLink
SET
  usedAt = ${now}
WHERE
  codeHash = @hash`,
    { hash },
  );
  return trial;
}
