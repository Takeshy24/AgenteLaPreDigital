// Base de conocimiento del agente (recuperación tipo RAG). Las respuestas sobre planes salen de tres
// fuentes, nunca del modelo de lenguaje:
//   1. Precios y modalidades: tabla PlanTarifa del OLTP (catálogo vigente).
//   2. Características de cada plan: src/shared/offer.json (tabla 4 del informe).
//   3. Condiciones comerciales: server/agent/knowledge/conditions.json (secciones 1.1, 2.2, 2.4, F5 y 7.3).
// Para cada mensaje se recuperan los fragmentos más parecidos por palabras clave. Esos fragmentos
// se dan al modelo como contexto y, si la persona pregunta por los planes, la respuesta se arma
// copiando esos fragmentos (sin texto generado), con su fuente registrada.
import { readFileSync } from 'node:fs';

const features = JSON.parse(
  readFileSync(new URL('../../src/shared/offer.json', import.meta.url), 'utf8'),
);
const conditions = JSON.parse(
  readFileSync(new URL('./knowledge/conditions.json', import.meta.url), 'utf8'),
);
const PLAN_NAMES = ['Explora UNT', 'Ruta UNT', 'Meta UNT', 'Meta UNT Plus'];
const FEATURE_SOURCE = 'Informe v30, sección 2.4, tabla 4 (src/shared/offer.json)';
const PRICE_SOURCE = 'OLTP, tabla PlanTarifa (catálogo vigente)';
const FEATURE_KEYWORDS = {
  'Diagnóstico académico': ['diagnostico', 'evaluacion inicial', 'nivel'],
  'Temario completo UNT': ['temario', 'cursos', 'temas', 'contenido'],
  'Videoclases y materiales': ['videoclases', 'videos', 'grabadas', 'materiales'],
  'Ejercicios por curso y tema': ['ejercicios', 'practicas', 'problemas'],
  'Ruta de estudio': ['ruta de estudio', 'plan de estudio', 'cronograma', 'personalizada'],
  'Evaluaciones por tema y acumulativas': ['evaluaciones', 'examenes', 'evaluacion'],
  'Simulacros completos': ['simulacro', 'simulacros'],
  'Análisis de rendimiento': ['analisis', 'rendimiento', 'estadisticas', 'resultados'],
  'Recomendaciones personalizadas con IA': ['ia', 'inteligencia artificial', 'recomendaciones'],
  'Consultas de IA mensuales': ['consultas', 'preguntas a la ia', 'chat'],
  'Transmisiones académicas en vivo': [
    'en vivo',
    'vivo',
    'transmisiones',
    'transmision',
    'zoom',
    'directo',
  ],
  'Seguimiento del progreso': ['seguimiento', 'progreso', 'avance'],
  'Reportes para apoderados': ['reportes', 'reporte', 'padres', 'apoderados', 'apoderado'],
  'Alertas avanzadas de rendimiento': ['alertas', 'alerta', 'avisos'],
  'Primera respuesta de soporte (máximo)': ['soporte'],
  'Descarga de contenido': ['descargar', 'descarga', 'offline', 'sin internet', 'pdf'],
};
const PRICE_KEYWORDS = [
  'precio',
  'precios',
  'cuesta',
  'cuestan',
  'cuanto',
  'costo',
  'costos',
  'sale',
  'vale',
  'soles',
  'tarifa',
  'tarifas',
];

export const normalize = (text) =>
  ` ${String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((char) => char.charCodeAt(0) < 0x300 || char.charCodeAt(0) > 0x36f)
    .join('')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()} `;
const has = (text, keyword) => text.includes(` ${keyword} `);

export function mentionedPlans(text) {
  const value = normalize(text);
  const plans = [];
  if (has(value, 'explora')) plans.push('Explora UNT');
  if (has(value, 'ruta')) plans.push('Ruta UNT');
  if (has(value, 'plus')) plans.push('Meta UNT Plus');
  else if (has(value, 'meta')) plans.push('Meta UNT');
  return plans;
}

function chunks(tariffs) {
  const list = [];
  const prices = PLAN_NAMES.filter((name) => tariffs.some((tariff) => tariff.plan === name));
  list.push({
    id: 'precios',
    title: 'Precios y modalidades vigentes',
    source: PRICE_SOURCE,
    keywords: PRICE_KEYWORDS,
    render: (plans) =>
      (plans.filter((name) => prices.includes(name)).length
        ? plans.filter((name) => prices.includes(name))
        : prices
      )
        .map(
          (name) =>
            `${name}: ${tariffs
              .filter((tariff) => tariff.plan === name)
              .map(
                (tariff) =>
                  `S/ ${Number(tariff.precio).toFixed(2)} ${tariff.modalidad === 'Mensual' ? 'al mes' : 'el semestre'}`,
              )
              .join(' o ')}`,
        )
        .join('. ') + '. Explora UNT es gratis por 14 días.',
  });
  // Objeción de precio: el agente responde con las alternativas del catálogo (sección 2.2).
  const paid = [...tariffs].sort((a, b) => a.precio - b.precio)[0];
  if (paid)
    list.push({
      id: 'alternativas',
      title: 'Alternativas más económicas',
      source: `${PRICE_SOURCE} e informe v30, sección 2.2 (objeción de precio)`,
      keywords: [
        'caro',
        'cara',
        'carisimo',
        'barato',
        'barata',
        'economico',
        'economica',
        'accesible',
        'costoso',
        'no me alcanza',
      ],
      render: () =>
        `Te cuento las opciones más accesibles: Explora UNT es gratis por 14 días para que pruebes la plataforma, y ${paid.plan} cuesta S/ ${Number(paid.precio).toFixed(2)} ${paid.modalidad === 'Mensual' ? 'al mes' : 'el semestre'}, el plan pagado más económico.`,
    });
  for (const feature of features)
    list.push({
      id: `caracteristica:${feature.label}`,
      title: feature.label,
      source: FEATURE_SOURCE,
      keywords: FEATURE_KEYWORDS[feature.label] ?? [],
      render: (plans) => {
        const scope = plans.length ? plans : PLAN_NAMES;
        const describe = (name) => {
          const value = feature.values[PLAN_NAMES.indexOf(name)];
          if (value === 'Sí') return `${name}: sí`;
          if (value === '—' || value === 'No') return `${name}: no`;
          return `${name}: ${value}`;
        };
        return `${feature.label} — ${scope.map(describe).join('; ')}.`;
      },
    });
  for (const condition of conditions) list.push({ ...condition, render: () => condition.answer });
  return list;
}

// Devuelve los fragmentos con al menos una palabra clave, ordenados por coincidencias.
export function retrieve(text, tariffs, limit = 3) {
  const value = normalize(text);
  return chunks(tariffs)
    .map((chunk) => ({
      chunk,
      score: chunk.keywords.reduce(
        (total, keyword) =>
          total + (has(value, normalize(keyword).trim()) ? keyword.split(' ').length : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Contexto breve para el modelo: títulos y textos de los fragmentos recuperados.
export function knowledgeContext(text, tariffs) {
  const plans = mentionedPlans(text);
  return retrieve(text, tariffs).map(({ chunk }) => `${chunk.title}: ${chunk.render(plans)}`);
}

// Respuesta extractiva: copia los fragmentos recuperados y conserva sus fuentes.
export function answerFromKnowledge(text, tariffs) {
  const found = retrieve(text, tariffs, 2).filter(
    (item, index, all) => index === 0 || item.score >= all[0].score,
  );
  if (!found.length) return null;
  const plans = mentionedPlans(text);
  return {
    text: `${found.map(({ chunk }) => chunk.render(plans)).join('\n\n')}\n\n¿Te ayudo con algo más o prefieres que te prepare una propuesta?`,
    sources: found.map(({ chunk }) => ({ id: chunk.id, title: chunk.title, source: chunk.source })),
  };
}

export const sourcesOf = (text, tariffs) =>
  retrieve(text, tariffs).map(({ chunk }) => ({ id: chunk.id, source: chunk.source }));
