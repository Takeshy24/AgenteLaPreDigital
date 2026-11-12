import { toMs } from './cohorts.mjs';

const end = (date) => (date ? toMs(date) + 168 * 3600000 : null);
const month = (date) => String(date).slice(0, 7);
const within = (date, from) => date && from && toMs(date) >= toMs(from) && toMs(date) <= end(from);
const reason = (done, windowEnd, now, closed) =>
  done ? null : now < windowEnd ? 'Ventana aún abierta' : closed;

export function initialRows(records, now) {
  return records.map((h) => ({
    unitKey: `${h.idCaso}|${h.idContacto}`,
    unitLabel: `${h.contactName} · Caso #${h.idCaso}`,
    originAt: h.fechaInicioElegibilidad,
    contactId: h.idContacto,
    contactName: h.contactName,
    role: h.idRolContacto,
    channel: h.idCanal ?? 0,
    flags: { m1: Boolean(h.M1), m2: Boolean(h.M2), m3: Boolean(h.M3) },
    windowEnd: { 'L-1.1': end(h.fechaInicioElegibilidad), 'L-1.2': end(h.fechaPrimeraEntrega) },
    reasons: {
      'L-1.1': reason(
        h.M2,
        end(h.fechaInicioElegibilidad),
        now,
        h.fechaPrimeraEntrega
          ? 'Entregado fuera de la ventana de 7 días'
          : 'Sin entrega de la agenda en 7 días',
      ),
      'L-1.2': reason(h.M3, end(h.fechaPrimeraEntrega), now, 'Sin respuesta en 7 días'),
    },
  }));
}
export function profileRows(records, now) {
  return records.map((h) => ({
    unitKey: `${h.idContacto}|${month(h.fechaPreguntaEntregada)}`,
    unitLabel: `${h.contactName} · ${month(h.fechaPreguntaEntregada)}`,
    originAt: h.fechaPreguntaEntregada,
    contactId: h.idContacto,
    contactName: h.contactName,
    role: h.idRolContacto,
    channel: h.idCanal,
    flags: { m4: Boolean(h.M4), m5: Boolean(h.M5) },
    windowEnd: { 'L-2.1': end(h.fechaPreguntaEntregada) },
    reasons: {
      'L-2.1': reason(h.M5, end(h.fechaPreguntaEntregada), now, 'Sin dato nuevo en 7 días'),
    },
  }));
}
export function linkingRows(records, now) {
  return records.map((h) => ({
    unitKey: `${h.idCaso}|${month(h.mesCohorte)}`,
    unitLabel: `Caso #${h.idCaso} · ${month(h.mesCohorte)}`,
    originAt: h.fechaNecesidad,
    contactId: h.idContactoDeclara,
    contactName: h.contactName,
    role: h.idRolContactoDeclara,
    channel: h.idCanal,
    flags: { m6: Boolean(h.M6), m7: Boolean(h.M7) },
    windowEnd: { 'L-3.1': end(h.fechaNecesidad) },
    reasons: {
      'L-3.1': reason(
        h.M7,
        end(h.fechaNecesidad),
        now,
        h.fechaVinculacionLograda
          ? 'Vinculado después de 7 días'
          : 'Sin vínculo y dos autorizaciones coincidentes en 7 días',
      ),
    },
  }));
}
export function proposalRows(records, now) {
  return records.map((h) => ({
    unitKey: `${h.idCaso}|${month(h.fechaEntrega)}`,
    unitLabel: `Caso #${h.idCaso} · ${month(h.fechaEntrega)}`,
    originAt: h.fechaEntrega,
    channel: h.idCanal,
    plan: h.idPlan,
    flags: { m8: Boolean(h.M8), m9: Boolean(h.M9) },
    windowEnd: { 'L-4.1': end(h.fechaEntrega) },
    reasons: {
      'L-4.1': reason(
        h.M9,
        end(h.fechaEntrega),
        now,
        h.fechaAceptacionExpresa
          ? 'Aceptada después de 7 días'
          : 'Sin aceptación expresa en 7 días',
      ),
    },
  }));
}
export function conversionRows(records, now) {
  return records.map((h) => {
    let closed = 'Sin pago positivo y validación contractual en 7 días';
    if (h.fechaReembolsoInvalidante) closed = 'Contratación invalidada por reembolso';
    else if (!within(h.fechaPagoConfirmado, h.fechaPrimeraAlta))
      closed = 'Sin pago confirmado en 7 días';
    else if (!within(h.fechaValidacionContractual, h.fechaPrimeraAlta))
      closed = 'Pago sin validación contractual a tiempo';
    return {
      unitKey: String(h.idCaso),
      unitLabel: `Caso #${h.idCaso}`,
      originAt: h.fechaPrimeraAlta,
      contactId: h.idContactoPrimeraAlta,
      contactName: h.contactName,
      role: h.idRolContactoPrimeraAlta,
      priority: h.idPrioridad,
      flags: { m10: Boolean(h.M10), m11: Boolean(h.M11) },
      windowEnd: { 'L-5.1': end(h.fechaPrimeraAlta) },
      reasons: { 'L-5.1': reason(h.M11, end(h.fechaPrimeraAlta), now, closed) },
    };
  });
}
