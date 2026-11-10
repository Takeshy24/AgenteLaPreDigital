import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';
export async function findContacts(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  idContacto id
FROM
  dbo.Contacto
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  (
    @email IS NOT NULL
    AND correo = @email
  )`,
    params,
  );
}
export async function insertContact(db, params = {}, options = {}) {
  return insert(
    db,
    `INSERT
  dbo.Contacto (nombreCompleto, correo, telefono)
VALUES
  (@name, @email, @phone)`,
    params,
  );
}
export async function findBeneficiaryByName(db, name) {
  return (
    await query(
      db,
      `SELECT
  idBeneficiario id
FROM
  dbo.Beneficiario
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  nombreNormalizado = @name`,
      { name },
    )
  ).recordset;
}
export async function findContactBeneficiary(db, params = {}) {
  return query(
    db,
    `SELECT
  TOP 1 b.idBeneficiario id
FROM
  dbo.Lead l
  JOIN dbo.Beneficiario b ON b.idBeneficiario = l.idBeneficiario
WHERE
  l.idContacto = @contact
  AND b.nombreNormalizado = @name
ORDER BY
  b.idBeneficiario`,
    params,
  );
}
export async function insertProvisionalRequest(db, params = {}) {
  return query(
    db,
    `IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.SolicitudProvisional
  WHERE
    idContacto = @contact
    AND idEstadoSolicitud = 1
    AND textoSolicitud = @text
)
INSERT
  dbo.SolicitudProvisional (
    idContacto,
    idRolContacto,
    idCanalCaptacion,
    textoSolicitud
  )
VALUES
  (@contact, @role, @channel, @text)`,
    params,
  );
}
export async function findStudent(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  TOP 1 idBeneficiario id
FROM
  dbo.Beneficiario
WHERE
  idContactoBeneficiario = @contact
ORDER BY
  idBeneficiario`,
    params,
  );
}
export async function findBeneficiary(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  1 ok
FROM
  dbo.Beneficiario
WHERE
  idBeneficiario = @beneficiary`,
    params,
  );
}
export async function insertBeneficiary(db, params = {}, options = {}) {
  return insert(
    db,
    `INSERT
  dbo.Beneficiario (
    nombreCompleto,
    nombreNormalizado,
    idContactoBeneficiario
  )
VALUES
  (
    @beneficiaryName,
    UPPER(@beneficiaryName),
    @studentContact
  )`,
    params,
  );
}
export async function ensureProfiles(db, params = {}, options = {}) {
  return query(
    db,
    `IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.PerfilContacto
  WHERE
    idContacto = @contact
)
INSERT
  dbo.PerfilContacto (idContacto)
VALUES
  (@contact);

IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.PerfilBeneficiario
  WHERE
    idBeneficiario = @beneficiary
)
INSERT
  dbo.PerfilBeneficiario (idBeneficiario)
VALUES
  (@beneficiary)`,
    params,
  );
}
export async function findLead(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  idLead id
FROM
  dbo.Lead
WHERE
  idContacto = @contact
  AND idBeneficiario = @beneficiary`,
    params,
  );
}
export async function insertLead(db, params = {}, options = {}) {
  return insert(
    db,
    `INSERT
  dbo.Lead (
    idContacto,
    idBeneficiario,
    idRolContacto,
    idCanalCaptacion
  )
VALUES
  (@contact, @beneficiary, @role, @channel)`,
    params,
  );
}
export async function findOpenCase(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  idCaso id
FROM
  dbo.Caso
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  idBeneficiario = @beneficiary
  AND idEstadoCaso = 1`,
    params,
  );
}
export async function insertCase(db, params = {}, options = {}) {
  return insert(
    db,
    `INSERT
  dbo.Caso (idBeneficiario)
VALUES
  (@beneficiary)`,
    params,
  );
}
export async function recordCaseOpening(db, params = {}, options = {}) {
  return query(
    db,
    `INSERT
  dbo.EventoCaso (idCaso, idTipoEvento)
VALUES
  (@caseId, 2)`,
    params,
  );
}
export async function findParticipation(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  idLeadCaso id
FROM
  dbo.LeadCaso
WHERE
  idLead = @lead
  AND idCaso = @caseId`,
    params,
  );
}
export async function grantConsent(db, params = {}, options = {}) {
  return query(
    db,
    `IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.AutorizacionContacto
  WHERE
    idContacto = @contact
    AND idCanal = @communicationChannel
    AND idEstadoAutorizacion = 1
)
INSERT
  dbo.AutorizacionContacto (
    idContacto,
    idCanal,
    idEstadoAutorizacion,
    fechaOtorgamiento,
    idOrigenAutorizacion,
    versionTexto
  )
VALUES
  (
    @contact,
    @communicationChannel,
    1,
    ${now},
    1,
    N'captacion-local-v1'
  )`,
    params,
  );
}
export async function findConsent(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  TOP 1 idAutorizacion
FROM
  dbo.AutorizacionContacto
WHERE
  idContacto = @contact
  AND idEstadoAutorizacion = 1`,
    params,
  );
}
export async function insertParticipation(db, params = {}, options = {}) {
  const { authorized } = options;
  return insert(
    db,
    `INSERT
  dbo.LeadCaso (
    idLead,
    idCaso,
    idRolContacto,
    fechaInicioElegibilidad,
    idEstadoParticipacion,
    idMotivoSuspension
  )
VALUES
  (
    @lead,
    @caseId,
    @role,
    ${authorized ? now : 'NULL'},
    @state,
    @reason
  )`,
    params,
  );
}
