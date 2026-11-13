import { query } from '../db.mjs';
import { insert } from '../shared/repository.mjs';

export async function saveInquiry(db, data) {
  return insert(
    db,
    `INSERT dbo.App_PublicInquiry
    (nombre,correo,beneficiario,esEstudiante,planSolicitado,autorizaCorreo,telefono,idRolContacto,requestKey,idPlanTarifa)
    VALUES (@name,@email,@beneficiary,@isStudent,@plan,@consent,@phone,@role,@requestKey,@tariff)`,
    { phone: null, role: null, requestKey: null, tariff: null, ...data },
  );
}

export async function listInquiries(db) {
  return (
    await query(
      db,
      `SELECT TOP 100 idSolicitud id, nombre name, correo email,
    beneficiario beneficiary, esEstudiante isStudent, planSolicitado [plan],
    autorizaCorreo consent, createdAt, telefono phone, idRolContacto role,
    idLeadCaso participationId, estado status, 2 communicationChannel
    FROM dbo.App_PublicInquiry
    UNION ALL
    SELECT -s.idSolicitud id, COALESCE(c.nombreCompleto,JSON_VALUE(o.payload,'$.name'),N'') name,
    COALESCE(c.correo,JSON_VALUE(o.payload,'$.email')) email, JSON_VALUE(o.payload,'$.beneficiary') beneficiary,
    CAST(CASE WHEN JSON_VALUE(o.payload,'$.role')='1' THEN 1 ELSE 0 END AS BIT) isStudent,
    CASE WHEN JSON_VALUE(o.payload,'$.channel')='1' THEN N'Captación WhatsApp' ELSE N'Captación Telegram' END [plan], CAST(0 AS BIT) consent, s.fechaSolicitud createdAt,
    COALESCE(c.telefono,JSON_VALUE(o.payload,'$.phone')) phone, TRY_CAST(JSON_VALUE(o.payload,'$.role') AS TINYINT) role,
    NULL participationId, CASE WHEN o.step='review' THEN N'Revisar identidad' ELSE N'Completar datos en chat' END status,
    CASE WHEN JSON_VALUE(o.payload,'$.channel')='1' THEN 1 ELSE 3 END communicationChannel
    FROM dbo.SolicitudProvisional s JOIN dbo.Contacto c ON c.idContacto=s.idContacto
    JOIN dbo.App_Onboarding o ON o.idSolicitud=s.idSolicitud
    WHERE s.idEstadoSolicitud=1 AND NOT EXISTS(SELECT 1 FROM dbo.App_PublicInquiry p WHERE p.idSolicitudProvisional=s.idSolicitud)
    ORDER BY createdAt DESC`,
    )
  ).recordset;
}

export async function getInquiry(db, id) {
  return (
    await query(
      db,
      'SELECT * FROM dbo.App_PublicInquiry WITH(UPDLOCK,HOLDLOCK) WHERE idSolicitud=@id',
      { id },
    )
  ).recordset[0];
}
export async function findRequest(db, key) {
  return (
    await query(
      db,
      'SELECT * FROM dbo.App_PublicInquiry WITH(UPDLOCK,HOLDLOCK) WHERE requestKey=@key',
      { key },
    )
  ).recordset[0];
}
export async function linkInquiry(db, id, contact, participation, status, provisional = null) {
  await query(
    db,
    'UPDATE dbo.App_PublicInquiry SET idContacto=@contact,idLeadCaso=@participation,estado=@status,idSolicitudProvisional=@provisional WHERE idSolicitud=@id',
    { id, contact, participation, status, provisional },
  );
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
      p.idResultado, p.precioAutorizado, t.precio precioCatalogo, o.expiresAt, m.idEstadoEntrega,
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
