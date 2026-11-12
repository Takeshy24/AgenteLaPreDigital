import { query } from '../db.mjs';
import { martTable } from '../datamart/service.mjs';

const rows = async (db, text) => (await query(db, text)).recordset;
export function listInitial(db) {
  return rows(
    db,
    `
SELECT h.*, c.nombreCompleto AS contactName
FROM ${martTable('HechoContactoInicial')} AS h
INNER JOIN ${martTable('DimContacto')} AS c ON c.idContacto = h.idContacto`,
  );
}
export function listProfile(db) {
  return rows(
    db,
    `
SELECT h.*, c.nombreCompleto AS contactName
FROM ${martTable('HechoAmpliacionPerfil')} AS h
INNER JOIN ${martTable('DimContacto')} AS c ON c.idContacto = h.idContacto`,
  );
}
export function listLinking(db) {
  return rows(
    db,
    `
SELECT h.*, c.nombreCompleto AS contactName
FROM ${martTable('HechoVinculacionEconomica')} AS h
INNER JOIN ${martTable('DimContacto')} AS c ON c.idContacto = h.idContactoDeclara`,
  );
}
export function listProposals(db) {
  return rows(db, `SELECT * FROM ${martTable('HechoPropuestaComercial')}`);
}
export function listConversion(db) {
  return rows(
    db,
    `
SELECT h.*, c.nombreCompleto AS contactName
FROM ${martTable('HechoConversionPagada')} AS h
INNER JOIN ${martTable('DimContacto')} AS c ON c.idContacto = h.idContactoPrimeraAlta`,
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
