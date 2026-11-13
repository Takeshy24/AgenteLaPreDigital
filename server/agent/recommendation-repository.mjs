import { query } from '../db.mjs';

export async function countLeads(db) {
  return Number((await query(db, 'SELECT COUNT_BIG(*) total FROM dbo.Lead')).recordset[0].total);
}
export async function listPlanChoices(db, excludeBeneficiary = null) {
  return (
    await query(
      db,
      `WITH choices AS (
SELECT c.idBeneficiario beneficiaryId, pb.carreraDeseada career,
       pb.disponibilidadEstudio availability, pc.nombre [plan],
       ROW_NUMBER() OVER (PARTITION BY c.idBeneficiario ORDER BY validacion.fechaEvento DESC, k.idContratacion DESC) choiceRank
FROM dbo.Contratacion k
INNER JOIN dbo.Caso c ON c.idCaso=k.idCaso
INNER JOIN dbo.EventoCaso validacion ON validacion.idEvento=k.idEventoValidacion
INNER JOIN dbo.PropuestaComercial p ON p.idPropuesta=k.idPropuestaAceptada
INNER JOIN dbo.PlanTarifa tarifa ON tarifa.idPlanTarifa=p.idPlanTarifa
INNER JOIN dbo.PlanComercial pc ON pc.idPlan=tarifa.idPlan
INNER JOIN dbo.PerfilBeneficiario pb ON pb.idBeneficiario=c.idBeneficiario
WHERE k.idEventoPago IS NOT NULL AND k.idEventoValidacion IS NOT NULL
  AND (@exclude IS NULL OR c.idBeneficiario<>@exclude)
  AND NOT EXISTS (SELECT 1 FROM dbo.EventoCaso e WHERE e.idCaso=c.idCaso AND e.idTipoEvento IN (9,10))
)
SELECT beneficiaryId, career, availability, [plan] FROM choices WHERE choiceRank=1`,
      { exclude: excludeBeneficiary },
    )
  ).recordset;
}
