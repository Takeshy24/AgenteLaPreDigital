import { readFileSync } from 'node:fs';

// Se usa solo en la importación explícita. La atención no consulta estos archivos.
export function initialDocuments(tariffs) {
  const features = JSON.parse(
    readFileSync(new URL('../../src/shared/offer.json', import.meta.url), 'utf8'),
  );
  const conditions = JSON.parse(
    readFileSync(new URL('../agent/knowledge/conditions.json', import.meta.url), 'utf8'),
  );
  const names = ['Explora UNT', 'Ruta UNT', 'Meta UNT', 'Meta UNT Plus'];
  const prices = (name) =>
    tariffs
      .filter((item) => item.plan === name)
      .map((item) => `${item.modalidad}: S/ ${Number(item.precio).toFixed(2)}`)
      .join(' · ');
  const catalogSource = 'Importación del catálogo PlanTarifa y src/shared/offer.json';
  const synonyms = {
    'Transmisiones académicas en vivo': 'clases, vivo, zoom, directo',
    'Videoclases y materiales': 'videos, grabadas, materiales',
    'Simulacros completos': 'simulacro, simulacros, ensayo',
    'Descarga de contenido': 'descargar, descarga, offline, internet, pdf',
    'Primera respuesta de soporte (máximo)': 'soporte, ayuda, atención, tardan',
    'Consultas de IA mensuales': 'consultas, ia, inteligencia artificial, chat',
    'Reportes para apoderados': 'reportes, reporte, padres, apoderados',
  };
  const docs = conditions.map((item) => ({
    key: `conditions:${item.id}`,
    title: item.title,
    content: item.answer,
    keywords: item.keywords.join(', '),
    source: item.source,
  }));
  docs.push({
    key: 'catalog:prices',
    title: 'Catálogo de planes, precios y modalidades',
    content:
      names
        .map((name) => `${name}: ${prices(name) || '14 días gratuitos, una vez por estudiante'}.`)
        .join('\n') +
      '\nLos importes son por periodo contratado. La aceptación de una propuesta no confirma el pago.',
    keywords:
      'planes, catálogo, precios, precio, cuesta, cuestan, cuánto, costo, costos, vale, soles, tarifa, tarifas, mensual, semestral, comparar',
    source: catalogSource,
  });
  const cheapest = [...tariffs]
    .filter((item) => Number(item.precio) > 0)
    .sort((a, b) => Number(a.precio) - Number(b.precio))[0];
  if (cheapest)
    docs.push({
      key: 'catalog:alternatives',
      title: 'Alternativas para un presupuesto menor',
      source: catalogSource,
      content: `Explora UNT es gratis por 14 días, una vez por estudiante. ${cheapest.plan} cuesta S/ ${Number(cheapest.precio).toFixed(2)} ${cheapest.modalidad === 'Mensual' ? 'al mes' : 'el semestre'} y es la alternativa pagada de menor importe en el catálogo importado.`,
      keywords:
        'caro, cara, carísimo, barata, barato, económico, económica, accesible, costoso, alcanza, alternativas',
    });
  docs.push({
    key: 'operations:comparison',
    title: 'Conocer la plataforma antes de decidir',
    source: 'Condiciones Explora UNT y presentación de LaPreDigital',
    content:
      'LaPreDigital es una preparación 100 % virtual para la admisión a la UNT. Con Explora UNT puedes probarla gratis 14 días, una vez por estudiante, antes de decidir si contratas un plan.',
    keywords: 'confiable, confianza, comparar, comparación, academia, alternativas',
  });
  names.forEach((name, index) =>
    docs.push({
      key: `catalog:plan:${index}`,
      title: `Plan ${name}`,
      source: catalogSource,
      content:
        `${name}\n${prices(name) || 'Prueba gratuita de 14 días, una vez por estudiante'}.\n` +
        features
          .map(
            (item) =>
              `${item.label}: ${item.values[index] === '—' ? 'No incluido' : item.values[index]}.`,
          )
          .join('\n'),
      keywords: `${name}, incluye, beneficios, contenido, características, precio, cuesta, costo, mensual, semestral`,
    }),
  );
  features.forEach((item, index) =>
    docs.push({
      key: `catalog:feature:${index}`,
      title: item.label,
      source: catalogSource,
      content:
        `${item.label}\n` +
        names
          .map(
            (name, plan) =>
              `${name}: ${item.values[plan] === '—' ? 'No incluido' : item.values[plan]}.`,
          )
          .join('\n'),
      keywords: `${item.label}, comparación, diferencias, ${synonyms[item.label] ?? ''}`,
    }),
  );
  const operations = [
    [
      'registro',
      'Registro y datos del estudiante',
      'Para registrar una solicitud se piden nombre completo, correo, teléfono y rol del contacto. Si el contacto es padre, madre o apoderado, se identifica también al estudiante beneficiario. Un mismo contacto puede participar en casos de distintos estudiantes.',
      'registro, registrar, datos, formulario, estudiante, beneficiario',
      'server/leads y server/public',
    ],
    [
      'identidad',
      'Verificación de identidad y correo existente',
      'Cuando el correo ya está registrado, el formulario público evita vincular automáticamente a otra persona. La solicitud puede requerir revisión de identidad. Un enlace de Telegram asociado al correo se entrega mediante el flujo de verificación correspondiente.',
      'identidad, correo, existente, registrado, verificación',
      'server/public y server/onboarding',
    ],
    [
      'autorizaciones',
      'Autorización y revocación del seguimiento',
      'La autorización de seguimiento se registra por canal. Puedes revocarla escribiendo que no deseas que te contacten o usando /revocar. Volver a saludar no renueva la autorización: para reanudar el seguimiento debes autorizarlo expresamente. Se conserva el historial de la autorización y su revocación.',
      'autorización, autorizar, revocar, seguimiento, dejar, contactar, escribir, suspendida',
      'server/consents y server/integrations/telegram.mjs',
    ],
    [
      'invitaciones',
      'Invitar al responsable económico',
      'Puedes pedir una invitación para tu padre, madre, esposa, esposo u otro responsable económico. Para prepararla hacen falta su nombre completo, teléfono y relación con el estudiante. El enlace permite revisar y aceptar la vinculación y autorizar el contacto. Compartir un teléfono no equivale a otorgar autorización en nombre de otra persona.',
      'invitar, invitación, esposa, esposo, mamá, papá, responsable, económico, vínculo, link, enlace',
      'server/links y server/agent/service.mjs',
    ],
    [
      'propuestas',
      'Propuestas, aceptación y contratación',
      'La propuesta identifica el plan, la modalidad, el periodo y el precio autorizado. Para prepararla se necesita conocer qué alternativa quieres contratar. Debes revisar y aceptar la propuesta y las condiciones en tu enlace personal. Aceptarla no acredita un pago.',
      'propuesta, aceptar, aceptación, contratar, contratación, condiciones',
      'server/proposals y server/public',
    ],
    [
      'credenciales',
      'Validación, habilitación y credenciales',
      'Tras confirmar el pago se revisa y valida la contratación. La habilitación crea o reutiliza la cuenta del estudiante y prepara el envío de credenciales al contacto correspondiente. Un pago confirmado y una cuenta habilitada son estados diferentes. Si la entrega falla, el equipo puede revisar su estado y reintentar un fallo confirmado.',
      'credenciales, acceso, habilitación, activar, usuario, contraseña, validación',
      'server/contracts y server/access',
    ],
    [
      'incidencias',
      'Pagos no reflejados, reclamos y atención humana',
      'Si ya pagaste y el pago no aparece, o necesitas un reembolso, abrir una disputa, presentar un reclamo o hablar con una persona, tu consulta requiere atención del equipo. El agente no confirma pagos a partir de una captura ni aprueba por sí mismo becas, descuentos o devoluciones.',
      'incidencia, reclamo, reembolso, devolución, disputa, asesor, humano, pagué, pago',
      'server/handoffs y server/agent/service.mjs',
    ],
    [
      'perfil',
      'Datos de preparación y recomendación de plan',
      'Para orientar la recomendación se solicitan carrera de interés, tiempo disponible y presupuesto mensual. Pueden añadirse preguntas opcionales sobre cursos difíciles y postulaciones previas. Los datos pueden actualizarse con lo que escribes en la conversación. La recomendación no supone una compra ni un pago.',
      'perfil, carrera, disponibilidad, presupuesto, cursos, postulaciones, recomendación',
      'server/agent/profile-flow.mjs y server/profiles',
    ],
  ];
  for (const [key, title, content, keywords, source] of operations)
    docs.push({ key: `operations:${key}`, title, content, keywords, source });
  return docs;
}
