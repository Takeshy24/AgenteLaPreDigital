import { query } from '../db.mjs';

export async function saveInquiry(db, data) {
  await query(
    db,
    `INSERT dbo.App_PublicInquiry
    (nombre,correo,beneficiario,esEstudiante,planSolicitado,autorizaCorreo)
    VALUES (@name,@email,@beneficiary,@isStudent,@plan,@consent)`,
    data,
  );
}

export async function listInquiries(db) {
  return (
    await query(
      db,
      `SELECT TOP 100 idSolicitud id, nombre name, correo email,
    beneficiario beneficiary, esEstudiante isStudent, planSolicitado [plan],
    autorizaCorreo consent, createdAt
    FROM dbo.App_PublicInquiry ORDER BY idSolicitud DESC`,
    )
  ).recordset;
}

export async function getOfferByProposal(db, proposal) {
  return (
    await query(
      db,
      `SELECT p.idPropuesta, p.idResultado, m.idEstadoEntrega
    FROM dbo.PropuestaComercial p JOIN dbo.Mensaje m ON m.idMensaje=p.idMensajeEntrega
    WHERE p.idPropuesta=@proposal`,
      { proposal },
    )
  ).recordset[0];
}

export async function saveOffer(db, proposal, hash) {
  await query(
    db,
    `INSERT dbo.App_PublicOffer (idPropuesta, tokenHash, expiresAt)
    VALUES (@proposal, @hash, DATEADD(DAY, 7, DATEADD(HOUR,-5,SYSUTCDATETIME())))`,
    { proposal, hash },
  );
}

export async function getOffer(db, hash) {
  return (
    await query(
      db,
      `SELECT TOP 1 o.idOferta, o.idPropuesta, p.idCaso, p.idLeadCasoEntrega,
      p.idResultado, p.precioAutorizado, m.idEstadoEntrega,
      c.nombreCompleto contacto, b.nombreCompleto beneficiario,
      pc.nombre [plan], modal.nombre modalidad, lc.idLead, l.idContacto,
      k.idContratacion, k.idEventoPago, k.idEventoValidacion
    FROM dbo.App_PublicOffer o
    JOIN dbo.PropuestaComercial p ON p.idPropuesta=o.idPropuesta
    JOIN dbo.Mensaje m ON m.idMensaje=p.idMensajeEntrega
    JOIN dbo.PlanTarifa t ON t.idPlanTarifa=p.idPlanTarifa
    JOIN dbo.PlanComercial pc ON pc.idPlan=t.idPlan
    JOIN dbo.Cat_Modalidad modal ON modal.id=t.idModalidad
    JOIN dbo.LeadCaso lc ON lc.idLeadCaso=p.idLeadCasoEntrega
    JOIN dbo.Lead l ON l.idLead=lc.idLead
    JOIN dbo.Contacto c ON c.idContacto=l.idContacto
    JOIN dbo.Beneficiario b ON b.idBeneficiario=l.idBeneficiario
    LEFT JOIN dbo.Contratacion k ON k.idCaso=p.idCaso
    WHERE o.tokenHash=@hash AND o.expiresAt>DATEADD(HOUR,-5,SYSUTCDATETIME())`,
      { hash },
    )
  ).recordset[0];
}

export async function publicTariffs(db) {
  return (
    await query(
      db,
      `SELECT t.idPlanTarifa id, p.nombre [plan], modal.nombre modalidad, t.precio
    FROM dbo.PlanTarifa t JOIN dbo.PlanComercial p ON p.idPlan=t.idPlan
    JOIN dbo.Cat_Modalidad modal ON modal.id=t.idModalidad
    WHERE t.vigenciaDesde<=CAST(DATEADD(HOUR,-5,SYSUTCDATETIME()) AS DATE)
    AND (t.vigenciaHasta IS NULL OR t.vigenciaHasta>=CAST(DATEADD(HOUR,-5,SYSUTCDATETIME()) AS DATE))
    ORDER BY p.idPlan,t.idModalidad`,
    )
  ).recordset;
}
