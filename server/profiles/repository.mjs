import { query } from '../db.mjs';
import { now } from '../shared/repository.mjs';
export async function ensureProfiles(db, params = {}, options = {}) {
  return query(
    db,
    `IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.PerfilBeneficiario
  WHERE
    idBeneficiario = @b
)
INSERT
  dbo.PerfilBeneficiario (idBeneficiario)
VALUES
  (@b);

IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.PerfilContacto
  WHERE
    idContacto = @c
)
INSERT
  dbo.PerfilContacto (idContacto)
VALUES
  (@c)`,
    params,
  );
}
export async function getField(db, params = {}, options = {}) {
  const { column, table, pk } = options;
  return query(
    db,
    `SELECT
  ${column} value
FROM
  dbo.${table}
WITH
  (UPDLOCK)
WHERE
  ${pk} = @entity`,
    params,
  );
}
export async function saveField(db, params = {}, options = {}) {
  const { table, column, pk } = options;
  // Las listas (cursos difíciles, postulaciones) se guardan aparte; aquí solo queda su cambio.
  const update = table
    ? `UPDATE dbo.${table}
SET
  ${column} = @value,
  fechaActualizacion = ${now}
WHERE
  ${pk} = @entity;`
    : '';
  return query(
    db,
    `${update}

INSERT
  dbo.CambioPerfil (
    idPregunta,
    idLeadCaso,
    idContactoInformante,
    idTipoTitular,
    idContactoTitular,
    idBeneficiarioTitular,
    idCampoPerfil,
    datoPrevio,
    datoNuevo,
    idTipoCambio,
    idCanal,
    idRolReferencia,
    idOperadorCorrige,
    idMensajeRespuesta
  )
VALUES
  (
    (SELECT TOP 1 q.idPregunta FROM dbo.PreguntaPerfil q JOIN dbo.Mensaje m ON m.idMensaje=q.idMensajePregunta WHERE q.idContacto=@contact AND q.idCampoPerfil=@field AND m.idEstadoEntrega=2 AND m.fechaEntrega>=DATEADD(DAY,-7,${now}) ORDER BY m.fechaEntrega DESC,q.idPregunta DESC),
    @id,
    @contact,
    @type,
    @ct,
    @bt,
    @field,
    @old,
    @new,
    @changeType,
    @channel,
    @role,
    @op,
    @reply
  )`,
    params,
  );
}

// Cursos difíciles (F3): el último dato informado reemplaza la lista anterior.
export async function getCourses(db, beneficiary) {
  return (
    await query(
      db,
      'SELECT curso FROM dbo.BeneficiarioCursoDificil WHERE idBeneficiario=@beneficiary ORDER BY curso',
      { beneficiary },
    )
  ).recordset.map((row) => row.curso);
}
export async function replaceCourses(db, beneficiary, courses) {
  await query(db, 'DELETE dbo.BeneficiarioCursoDificil WHERE idBeneficiario=@beneficiary', {
    beneficiary,
  });
  for (const curso of courses)
    await query(
      db,
      'INSERT dbo.BeneficiarioCursoDificil(idBeneficiario,curso) VALUES(@beneficiary,@curso)',
      { beneficiary, curso },
    );
}
export async function getLastApplication(db, beneficiary) {
  return (
    (
      await query(
        db,
        'SELECT TOP 1 descripcion FROM dbo.BeneficiarioPostulacionAnterior WHERE idBeneficiario=@beneficiary ORDER BY idPostulacion DESC',
        { beneficiary },
      )
    ).recordset[0]?.descripcion ?? null
  );
}
export async function addApplication(db, beneficiary, description) {
  await query(
    db,
    'INSERT dbo.BeneficiarioPostulacionAnterior(idBeneficiario,descripcion) VALUES(@beneficiary,@description)',
    { beneficiary, description },
  );
}
