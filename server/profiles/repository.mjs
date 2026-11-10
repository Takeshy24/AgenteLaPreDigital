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
  return query(
    db,
    `UPDATE dbo.${table}
SET
  ${column} = @value,
  fechaActualizacion = ${now}
WHERE
  ${pk} = @entity;

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
    (SELECT TOP 1 q.idPregunta FROM dbo.PreguntaPerfil q JOIN dbo.Mensaje m ON m.idMensaje=q.idMensajePregunta WHERE q.idContacto=@contact AND m.idEstadoEntrega=2 AND m.fechaEntrega>=DATEADD(DAY,-7,${now}) ORDER BY m.fechaEntrega DESC,q.idPregunta DESC),
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
