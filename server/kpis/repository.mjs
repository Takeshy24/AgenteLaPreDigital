import { query } from '../db.mjs';
import { martTable } from '../datamart/service.mjs';

const rows = async (db, text) => (await query(db, text)).recordset;
export function listInitial(db) {
  return rows(
    db,
    `
SELECT caso.idCaso, c.idContacto, c.nombreCompleto AS contactName,
    ca.idCanal, r.idRolContacto, t.fechaHora AS fechaInicioElegibilidad,
    entrega.fechaHora AS fechaPrimeraEntrega, respuesta.fechaHora AS fechaPrimeraRespuesta,
    h.M1, h.M2, h.M3
FROM ${martTable('HechoContactoInicial')} AS h
INNER JOIN ${martTable('DimCaso')} AS caso ON caso.KeyCaso = h.KeyCaso
INNER JOIN ${martTable('DimContacto')} AS c ON c.KeyContacto = h.KeyContacto
INNER JOIN ${martTable('DimTiempo')} AS t ON t.KeyTiempo = h.KeyTiempo
INNER JOIN ${martTable('DimRolContacto')} AS r ON r.KeyRolContacto = h.KeyRolContacto
LEFT JOIN ${martTable('DimCanal')} AS ca ON ca.KeyCanal = h.KeyCanal
LEFT JOIN ${martTable('DimTiempo')} AS entrega ON entrega.KeyTiempo = h.KeyTiempoPrimeraEntrega
LEFT JOIN ${martTable('DimTiempo')} AS respuesta ON respuesta.KeyTiempo = h.KeyTiempoPrimeraRespuesta`,
  );
}
export function listProfile(db) {
  return rows(
    db,
    `
SELECT c.idContacto, c.nombreCompleto AS contactName,
    ca.idCanal, r.idRolContacto, t.fechaHora AS fechaPreguntaEntregada,
    dato.fechaHora AS fechaDatoRegistrado, h.M4, h.M5
FROM ${martTable('HechoAmpliacionPerfil')} AS h
INNER JOIN ${martTable('DimContacto')} AS c ON c.KeyContacto = h.KeyContacto
INNER JOIN ${martTable('DimTiempo')} AS t ON t.KeyTiempo = h.KeyTiempo
INNER JOIN ${martTable('DimCanal')} AS ca ON ca.KeyCanal = h.KeyCanal
INNER JOIN ${martTable('DimRolContacto')} AS r ON r.KeyRolContacto = h.KeyRolContacto
LEFT JOIN ${martTable('DimTiempo')} AS dato ON dato.KeyTiempo = h.KeyTiempoDato`,
  );
}
export function listLinking(db) {
  return rows(
    db,
    `
SELECT caso.idCaso, c.idContacto AS idContactoDeclara, c.nombreCompleto AS contactName,
    ca.idCanal, r.idRolContacto AS idRolContactoDeclara,
    DATEFROMPARTS(t.anio, t.mes, 1) AS mesCohorte, t.fechaHora AS fechaNecesidad,
    vinculacion.fechaHora AS fechaVinculacionLograda, h.M6, h.M7
FROM ${martTable('HechoVinculacionEconomica')} AS h
INNER JOIN ${martTable('DimCaso')} AS caso ON caso.KeyCaso = h.KeyCaso
INNER JOIN ${martTable('DimContacto')} AS c ON c.KeyContacto = h.KeyContacto
INNER JOIN ${martTable('DimTiempo')} AS t ON t.KeyTiempo = h.KeyTiempo
INNER JOIN ${martTable('DimCanal')} AS ca ON ca.KeyCanal = h.KeyCanal
INNER JOIN ${martTable('DimRolContacto')} AS r ON r.KeyRolContacto = h.KeyRolContacto
LEFT JOIN ${martTable('DimTiempo')} AS vinculacion ON vinculacion.KeyTiempo = h.KeyTiempoVinculacion`,
  );
}
export function listProposals(db) {
  return rows(
    db,
    `
SELECT caso.idCaso, ca.idCanal, p.idPlan,
    t.fechaHora AS fechaEntrega, aceptacion.fechaHora AS fechaAceptacionExpresa, h.M8, h.M9
FROM ${martTable('HechoPropuestaComercial')} AS h
INNER JOIN ${martTable('DimCaso')} AS caso ON caso.KeyCaso = h.KeyCaso
INNER JOIN ${martTable('DimTiempo')} AS t ON t.KeyTiempo = h.KeyTiempo
INNER JOIN ${martTable('DimCanal')} AS ca ON ca.KeyCanal = h.KeyCanal
INNER JOIN ${martTable('DimPlan')} AS p ON p.KeyPlan = h.KeyPlan
LEFT JOIN ${martTable('DimTiempo')} AS aceptacion ON aceptacion.KeyTiempo = h.KeyTiempoAceptacion`,
  );
}
export function listConversion(db) {
  return rows(
    db,
    `
SELECT caso.idCaso, c.idContacto AS idContactoPrimeraAlta, c.nombreCompleto AS contactName,
    r.idRolContacto AS idRolContactoPrimeraAlta, p.idPrioridad,
    t.fechaHora AS fechaPrimeraAlta, pago.fechaHora AS fechaPagoConfirmado,
    validacion.fechaHora AS fechaValidacionContractual, reembolso.fechaHora AS fechaReembolsoInvalidante,
    beca.fechaHora AS fechaBecaCompleta, h.M10, h.M11
FROM ${martTable('HechoConversionPagada')} AS h
INNER JOIN ${martTable('DimCaso')} AS caso ON caso.KeyCaso = h.KeyCaso
INNER JOIN ${martTable('DimContacto')} AS c ON c.KeyContacto = h.KeyContacto
INNER JOIN ${martTable('DimTiempo')} AS t ON t.KeyTiempo = h.KeyTiempo
INNER JOIN ${martTable('DimRolContacto')} AS r ON r.KeyRolContacto = h.KeyRolContacto
INNER JOIN ${martTable('DimPrioridad')} AS p ON p.KeyPrioridad = h.KeyPrioridad
LEFT JOIN ${martTable('DimTiempo')} AS pago ON pago.KeyTiempo = h.KeyTiempoPago
LEFT JOIN ${martTable('DimTiempo')} AS validacion ON validacion.KeyTiempo = h.KeyTiempoValidacion
LEFT JOIN ${martTable('DimTiempo')} AS reembolso ON reembolso.KeyTiempo = h.KeyTiempoReembolso
LEFT JOIN ${martTable('DimTiempo')} AS beca ON beca.KeyTiempo = h.KeyTiempoBeca`,
  );
}
export function listPlans(db) {
  return rows(
    db,
    `SELECT idPlan AS id, nombre AS name FROM ${martTable('DimPlan')} ORDER BY idPlan`,
  );
}
export function listContacts(db) {
  return rows(
    db,
    `SELECT idContacto AS id, nombreCompleto AS name FROM ${martTable('DimContacto')} ORDER BY nombreCompleto`,
  );
}
export function listChannels(db) {
  return rows(
    db,
    `SELECT idCanal AS id, nombre AS name FROM ${martTable('DimCanal')} ORDER BY idCanal`,
  );
}
export function listRoles(db) {
  return rows(
    db,
    `SELECT idRolContacto AS id, nombre AS name FROM ${martTable('DimRolContacto')} ORDER BY idRolContacto`,
  );
}
