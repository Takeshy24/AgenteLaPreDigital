import features from './offer.json';
// Fuente: informe del usuario, sección 2.4, tabla 4. Información de oferta,
// no evidencia de una plataforma educativa integrada. Los precios vienen del OLTP.
export const reportPlanNames = ['Explora UNT', 'Ruta UNT', 'Meta UNT', 'Meta UNT Plus'] as const;
export const reportFeatures = features;
export function planFeatures(plan: string) {
  const index = reportPlanNames.findIndex((name) => name === plan);
  return index < 0
    ? []
    : reportFeatures.map((feature) => ({ label: feature.label, value: feature.values[index] }));
}
export const parameterLabels: Record<string, { label: string; unit: string }> = {
  ATENCION_DERIVACION_HORAS: { label: 'Atención de una derivación', unit: 'horas' },
  DURACION_EXPLORA_DIAS: { label: 'Duración de Explora UNT', unit: 'días' },
  EVALUACION_INICIAL_HORAS: { label: 'Evaluación inicial', unit: 'horas' },
  INACTIVIDAD_CASO_DIAS: { label: 'Inactividad del caso', unit: 'días' },
  PLAZO_RESPUESTA_PROPUESTA_DIAS: { label: 'Respuesta de propuesta', unit: 'días' },
  PLAZO_RESPUESTA_TRAS_SEPTIMO_DIAS: { label: 'Respuesta tras el séptimo intento', unit: 'días' },
  REAPERTURA_DIAS: { label: 'Reapertura de caso sin contratación', unit: 'días' },
  REEVALUACION_DIAS: { label: 'Reevaluación de participaciones activas', unit: 'días' },
  UMBRAL_BAJA: { label: 'Umbral de prioridad Baja', unit: 'intentos sin respuesta' },
  UMBRAL_NULA: { label: 'Umbral de prioridad Nula', unit: 'intentos sin respuesta' },
  VENTANA_MEDICION_HORAS: { label: 'Ventana de medición', unit: 'horas' },
};
