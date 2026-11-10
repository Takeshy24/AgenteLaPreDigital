import { query } from '../db.mjs';
import { now } from '../shared/repository.mjs';
export async function getContact(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  *
FROM
  dbo.Contacto
WHERE
  idContacto = @contact`,
    params,
  );
}
export async function revokeChannel(db, params = {}, options = {}) {
  return query(
    db,
    `UPDATE dbo.AutorizacionContacto
SET
  idEstadoAutorizacion = 2,
  fechaRevocacion = ${now}
WHERE
  idContacto = @contact
  AND idCanal = @channel
  AND idEstadoAutorizacion = 1`,
    params,
  );
}
export async function grantChannel(db, params = {}, options = {}) {
  return query(
    db,
    `INSERT
  dbo.AutorizacionContacto (
    idContacto,
    idCanal,
    idEstadoAutorizacion,
    fechaOtorgamiento,
    idOrigenAutorizacion,
    versionTexto
  )
VALUES
  (@contact, @channel, 1, ${now}, 3, @version)`,
    params,
  );
}
export async function listConsent(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  1 ok
FROM
  dbo.AutorizacionContacto
WHERE
  idContacto = @contact
  AND idEstadoAutorizacion = 1`,
    params,
  );
}
export async function suspendContact(db, params = {}, options = {}) {
  return query(
    db,
    `UPDATE lc
SET
  idEstadoParticipacion = 2,
  idMotivoSuspension = 2
FROM
  dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Caso c ON c.idCaso = lc.idCaso
WHERE
  l.idContacto = @contact
  AND c.idEstadoCaso = 1
  AND lc.idEstadoParticipacion = 1`,
    params,
  );
}
export async function resumeContact(db, params = {}, options = {}) {
  return query(
    db,
    `UPDATE lc
SET
  idEstadoParticipacion = 1,
  idMotivoSuspension = NULL,
  fechaInicioElegibilidad = COALESCE(fechaInicioElegibilidad, ${now})
FROM
  dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Caso c ON c.idCaso = lc.idCaso
WHERE
  l.idContacto = @contact
  AND c.idEstadoCaso = 1
  AND lc.idEstadoParticipacion = 2
  AND lc.idMotivoSuspension = 2`,
    params,
  );
}
export async function listActive(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  lc.idLeadCaso id
FROM
  dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead = lc.idLead
WHERE
  l.idContacto = @contact
  AND lc.idEstadoParticipacion = 1
  AND lc.fechaInicioElegibilidad IS NOT NULL`,
    params,
  );
}
