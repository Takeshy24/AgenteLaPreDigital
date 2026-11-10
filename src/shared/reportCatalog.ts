// Fuente: informe del usuario, sección 2.4, tabla 4. Información de oferta,
// no evidencia de una plataforma educativa integrada. Los precios vienen del OLTP.
export const reportPlanNames = ['Explora UNT', 'Ruta UNT', 'Meta UNT', 'Meta UNT Plus'] as const;
export const reportFeatures = [
  { label: 'Diagnóstico académico', values: ['Sí', 'Sí', 'Sí', 'Sí'] },
  { label: 'Temario completo UNT', values: ['Muestra', 'Sí', 'Sí', 'Sí'] },
  { label: 'Videoclases y materiales', values: ['Muestra', 'Sí', 'Sí', 'Sí'] },
  { label: 'Ejercicios por curso y tema', values: ['Muestra', 'Sí', 'Sí', 'Sí'] },
  { label: 'Ruta de estudio', values: ['—', 'Estándar', 'Personalizada', 'Personalizada'] },
  { label: 'Evaluaciones por tema y acumulativas', values: ['—', 'Sí', 'Sí', 'Sí'] },
  { label: 'Simulacros completos', values: ['1', '3 por semana', 'Ilimitados', 'Ilimitados'] },
  {
    label: 'Análisis de rendimiento',
    values: ['Básico', 'Por evaluación', 'Detallado', 'Detallado'],
  },
  { label: 'Recomendaciones personalizadas con IA', values: ['—', '—', 'Sí', 'Sí'] },
  { label: 'Consultas de IA mensuales', values: ['—', '—', '200', '200'] },
  { label: 'Transmisiones académicas en vivo', values: ['—', '—', 'Sí', 'Sí'] },
  {
    label: 'Seguimiento del progreso',
    values: ['Básico', 'Estándar', 'Personalizado', 'Personalizado'],
  },
  { label: 'Reportes para apoderados', values: ['—', '—', '—', 'Sí'] },
  { label: 'Alertas avanzadas de rendimiento', values: ['—', '—', '—', 'Sí'] },
  {
    label: 'Primera respuesta de soporte (máximo)',
    values: ['2 días', '1 día', '12 horas', '6 horas'],
  },
  { label: 'Descarga de contenido', values: ['No', 'No', 'No', 'No'] },
];
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
