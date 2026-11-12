// Definición de los seis indicadores del informe (secciones 3.3 a 3.5 y tabla 10) y su cálculo a
// partir de las filas de análisis. Reglas puras, sin base de datos.
export const CHANNEL_NAMES = {
  0: 'Sin canal',
  1: 'WhatsApp',
  2: 'Correo electrónico',
  3: 'Telegram',
  4: 'Portal web',
};
export const ROLE_NAMES = { 1: 'Estudiante', 2: 'Padre', 3: 'Madre', 4: 'Apoderado' };
export const GRAINS = ['year', 'quarter', 'month', 'day'];

// Tabla 10: dimensiones aplicables a cada grupo de medidas.
const DIMENSIONS_L1_L3 = ['time', 'contact', 'channel', 'role'];
export const KPI_DEFINITIONS = [
  {
    id: 'L-1.1',
    activity: 'L-1',
    name: 'Cobertura de contacto inicial',
    formula: 'M2 / M1 × 100',
    numerator: { code: 'M2', label: 'Participaciones con contacto inicial entregado' },
    denominator: { code: 'M1', label: 'Participaciones elegibles para contacto inicial' },
    unit: 'participación LEAD–caso',
    thresholds: [90, 95],
    dimensions: DIMENSIONS_L1_L3,
    rows: 'initial',
    inDenominator: () => true,
    inNumerator: (row) => row.flags.m2,
    meaning:
      'Mide cuántas participaciones con seguimiento autorizado recibieron un primer mensaje de la agenda, entregado por el canal en las primeras 168 horas.',
    lowMeans:
      'La agenda no está llegando a quienes deberían recibirla: revisa autorizaciones de canal, intentos omitidos y entregas fallidas.',
  },
  {
    id: 'L-1.2',
    activity: 'L-1',
    name: 'Tasa de respuesta inicial',
    formula: 'M3 / M2 × 100',
    numerator: { code: 'M3', label: 'Participaciones que respondieron al contacto inicial' },
    denominator: { code: 'M2', label: 'Participaciones con contacto inicial entregado' },
    unit: 'participación contactada',
    thresholds: [20, 40],
    dimensions: DIMENSIONS_L1_L3,
    rows: 'initial',
    inDenominator: (row) => row.flags.m2,
    inNumerator: (row) => row.flags.m3,
    meaning:
      'Mide cuántas participaciones contactadas escribieron dentro de las 168 horas posteriores a la primera entrega de la agenda.',
    lowMeans:
      'El primer mensaje de la agenda no está generando conversación: revisa el contenido, el canal y el momento del envío.',
  },
  {
    id: 'L-2.1',
    activity: 'L-2',
    name: 'Tasa de ampliación o actualización del perfil',
    formula: 'M5 / M4 × 100',
    numerator: { code: 'M5', label: 'Contactos que ampliaron o actualizaron su perfil' },
    denominator: { code: 'M4', label: 'Contactos consultados para ampliar o actualizar el perfil' },
    unit: 'contacto único por mes',
    thresholds: [40, 70],
    dimensions: DIMENSIONS_L1_L3,
    rows: 'profile',
    inDenominator: () => true,
    inNumerator: (row) => row.flags.m5,
    meaning:
      'Mide qué proporción de los contactos a quienes se les entregó una pregunta del perfil informó un dato nuevo o actualizado en las 168 horas siguientes.',
    lowMeans:
      'Las preguntas del perfil no se están respondiendo: revisa su redacción, la cantidad de opciones y el canal por el que se envían.',
  },
  {
    id: 'L-3.1',
    activity: 'L-3',
    name: 'Tasa de vinculación autorizada',
    formula: 'M7 / M6 × 100',
    numerator: { code: 'M7', label: 'Casos con vinculación autorizada lograda' },
    denominator: { code: 'M6', label: 'Casos que requieren vincular a un responsable económico' },
    unit: 'caso de negociación único',
    thresholds: [30, 60],
    dimensions: DIMENSIONS_L1_L3,
    rows: 'linking',
    inDenominator: () => true,
    inNumerator: (row) => row.flags.m7,
    meaning:
      'Mide cuántos casos con una necesidad de responsable económico lograron su vínculo y las dos autorizaciones dentro de las 168 horas posteriores a la necesidad.',
    lowMeans:
      'Los responsables invitados no están completando la vinculación: revisa el enlace de invitación y el seguimiento a quien lo recibe.',
  },
  {
    id: 'L-4.1',
    activity: 'L-4',
    name: 'Tasa de aceptación de propuestas',
    formula: 'M9 / M8 × 100',
    numerator: { code: 'M9', label: 'Casos con propuesta aceptada expresamente' },
    denominator: { code: 'M8', label: 'Casos con propuesta entregada' },
    unit: 'caso de negociación único por mes',
    thresholds: [20, 40],
    dimensions: ['time', 'channel', 'plan'],
    rows: 'proposal',
    inDenominator: () => true,
    inNumerator: (row) => row.flags.m9,
    meaning:
      'Mide cuántos casos con alguna propuesta entregada recibieron una aceptación expresa dentro de las 168 horas posteriores a su entrega. Aceptar no equivale a pagar.',
    lowMeans:
      'Las propuestas se entregan, pero no se aceptan: revisa el plan ofrecido frente al presupuesto declarado y las objeciones registradas.',
  },
  {
    id: 'L-5.1',
    activity: 'L-5',
    name: 'Conversión pagada de casos con LEADS de prioridad Alta',
    formula: 'M11 / M10 × 100',
    numerator: { code: 'M11', label: 'Casos con contratación pagada y validada en la ventana' },
    denominator: { code: 'M10', label: 'Casos con al menos un LEAD que alcanzó prioridad Alta' },
    unit: 'caso de negociación único',
    thresholds: [30, 50],
    dimensions: ['time', 'contact', 'role', 'priority'],
    rows: 'conversion',
    inDenominator: (row) => row.flags.m10,
    inNumerator: (row) => row.flags.m11,
    meaning:
      'Mide cuántos casos con un LEAD en prioridad Alta consiguieron pago positivo y validación contractual dentro de las 168 horas posteriores a la primera clasificación Alta.',
    lowMeans:
      'La prioridad Alta no se convierte en pago: revisa si faltan aceptaciones, pagos pendientes o validaciones del personal comercial.',
  },
];

export function bucket(date, grain) {
  const value = String(date);
  if (grain === 'year') return value.slice(0, 4);
  if (grain === 'quarter')
    return `${value.slice(0, 4)}-T${Math.floor((Number(value.slice(5, 7)) - 1) / 3) + 1}`;
  if (grain === 'day') return value.slice(0, 10);
  return value.slice(0, 7);
}

export function stateOf(percent, thresholds) {
  if (percent == null) return { code: 'na', label: 'No aplicable' };
  if (percent < thresholds[0]) return { code: 'critical', label: 'Crítico' };
  if (percent < thresholds[1]) return { code: 'alert', label: 'Alerta' };
  return { code: 'ok', label: 'Satisfactorio' };
}

const round = (value) => Math.round(value * 10) / 10;

export function matchesFilters(row, filters, dimensions) {
  const day = String(row.originAt).slice(0, 10);
  if (dimensions.includes('time')) {
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
  }
  if (
    dimensions.includes('contact') &&
    filters.contactId != null &&
    row.contactId !== filters.contactId
  )
    return false;
  if (dimensions.includes('channel') && filters.channel != null && row.channel !== filters.channel)
    return false;
  if (dimensions.includes('role') && filters.role != null && row.role !== filters.role)
    return false;
  if (dimensions.includes('plan') && filters.plan != null && row.plan !== filters.plan)
    return false;
  return true;
}

// Cuenta unidades únicas: una unidad cumple el numerador si alguna de sus filas lo cumple.
function count(rows, definition) {
  const units = new Map();
  for (const row of rows) {
    if (!definition.inDenominator(row)) continue;
    const unit = units.get(row.unitKey) ?? { rows: [], done: false };
    unit.rows.push(row);
    if (definition.inNumerator(row)) unit.done = true;
    units.set(row.unitKey, unit);
  }
  return units;
}

function group(rows, definition, keyOf, labelOf, limit = 50) {
  const buckets = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (key == null) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets.entries()]
    .map(([key, list]) => {
      const units = count(list, definition);
      const numerator = [...units.values()].filter((unit) => unit.done).length;
      return {
        key: String(key),
        label: labelOf(key),
        numerator,
        denominator: units.size,
        percent: units.size ? round((numerator / units.size) * 100) : null,
      };
    })
    .filter((item) => item.denominator > 0)
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(0, limit);
}

function interpret(definition, result) {
  const { numerator, denominator, percent, state, causes, provisional } = result;
  if (percent == null)
    return 'Sin datos para este indicador con los filtros elegidos: el denominador es cero, por lo que el resultado es «No aplicable».';
  const parts = [
    `${numerator} de ${denominator} (${percent}%), ${definition.unit}. Estado ${state.label.toLowerCase()} (crítico por debajo de ${definition.thresholds[0]}%, satisfactorio desde ${definition.thresholds[1]}%).`,
  ];
  if (state.code === 'critical' || state.code === 'alert') {
    parts.push(definition.lowMeans);
    const top = causes.find((cause) => !cause.provisional);
    if (top)
      parts.push(
        `La causa más frecuente es «${top.label}» (${top.count} ${top.count === 1 ? 'caso' : 'casos'}).`,
      );
  } else parts.push('El indicador cumple la meta académica propuesta.');
  if (provisional)
    parts.push(
      `${provisional} unidad${provisional === 1 ? '' : 'es'} todavía ${provisional === 1 ? 'tiene' : 'tienen'} la ventana de 7 días abierta, así que el resultado es provisional.`,
    );
  return parts.join(' ');
}

export function computeKpi(definition, allRows, filters, now, extra = {}) {
  const applied = definition.dimensions;
  const rows = allRows.filter((row) => matchesFilters(row, filters, applied));
  const units = count(rows, definition);
  const entries = [...units.values()];
  const numerator = entries.filter((unit) => unit.done).length;
  const denominator = entries.length;
  const percent = denominator ? round((numerator / denominator) * 100) : null;
  const state = stateOf(percent, definition.thresholds);
  const causeCounts = new Map();
  let provisional = 0;
  for (const unit of entries) {
    const open = unit.rows.some((item) => (item.windowEnd[definition.id] ?? 0) > now);
    if (open) provisional++;
    if (unit.done) continue;
    const reason =
      unit.rows.map((item) => item.reasons[definition.id]).find(Boolean) ?? 'Sin clasificar';
    const entry = causeCounts.get(reason) ?? {
      label: reason,
      count: 0,
      provisional: reason.includes('abierta'),
    };
    entry.count++;
    causeCounts.set(reason, entry);
  }
  const causes = [...causeCounts.values()].sort((a, b) => b.count - a.count);
  const breakdown = {};
  if (applied.includes('time'))
    breakdown.time = group(
      rows,
      definition,
      (row) => bucket(row.originAt, filters.grain),
      (key) => key,
    );
  if (applied.includes('channel'))
    breakdown.channel = group(
      rows,
      definition,
      (row) => row.channel,
      (key) => extra.channelNames?.[key] ?? CHANNEL_NAMES[key] ?? `Canal ${key}`,
    );
  if (applied.includes('role'))
    breakdown.role = group(
      rows,
      definition,
      (row) => row.role,
      (key) => extra.roleNames?.[key] ?? ROLE_NAMES[key] ?? `Rol ${key}`,
    );
  if (applied.includes('plan'))
    breakdown.plan = group(
      rows,
      definition,
      (row) => row.plan,
      (key) => extra.planNames?.[key] ?? `Plan ${key}`,
    );
  if (applied.includes('contact'))
    breakdown.contact = group(
      rows.filter((row) => row.contactId != null),
      definition,
      (row) => row.contactId,
      (key) => rows.find((row) => row.contactId === key)?.contactName ?? `Contacto ${key}`,
      15,
    );
  if (applied.includes('priority'))
    breakdown.priority = [
      { key: '2', label: 'Alta (condición de elegibilidad)', numerator, denominator, percent },
    ].filter((item) => item.denominator > 0);
  const result = {
    id: definition.id,
    activity: definition.activity,
    name: definition.name,
    formula: definition.formula,
    unit: definition.unit,
    meaning: definition.meaning,
    thresholds: definition.thresholds,
    dimensions: applied,
    numerator,
    denominator,
    measures: [
      { ...definition.denominator, value: denominator },
      { ...definition.numerator, value: numerator },
    ],
    percent,
    state,
    provisional,
    causes,
    breakdown,
    note: extra.note ?? null,
    units: entries
      .map((unit) => ({
        label: unit.rows[0].unitLabel,
        at: unit.rows[0].originAt,
        done: unit.done,
        reason: unit.done
          ? null
          : (unit.rows.map((item) => item.reasons[definition.id]).find(Boolean) ?? null),
      }))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 50),
  };
  result.interpretation = interpret(definition, result);
  return result;
}
