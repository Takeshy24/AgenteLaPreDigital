import PDFDocument from 'pdfkit';
import { CHANNEL_NAMES, ROLE_NAMES } from './rules.mjs';

const COLORS = { critical: '#B03A2E', alert: '#9A6700', ok: '#1E7B45', na: '#6B7280' };
const INK = '#1F2933';
const MUTED = '#52606D';
const LINE = '#CBD2D9';
const LEFT = 48;
const WIDTH = 499;

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - 60) doc.addPage();
}

function heading(doc, text, size = 14) {
  ensureSpace(doc, size + 24);
  doc
    .moveDown(0.6)
    .font('Helvetica-Bold')
    .fontSize(size)
    .fillColor(INK)
    .text(text, LEFT, doc.y, { width: WIDTH });
  doc.moveDown(0.2);
}

function paragraph(doc, text, color = INK, size = 10) {
  doc.font('Helvetica').fontSize(size).fillColor(color);
  ensureSpace(doc, doc.heightOfString(text, { width: WIDTH }) + 4);
  doc.text(text, LEFT, doc.y, { width: WIDTH, lineGap: 2 });
}

function fit(doc, value, width) {
  let text = String(value);
  if (doc.widthOfString(text) <= width) return text;
  while (text.length > 1 && doc.widthOfString(text + '...') > width) text = text.slice(0, -1);
  return text + '...';
}

function table(doc, headers, rows, widths) {
  const rowHeight = 18;
  const draw = (cells, bold) => {
    ensureSpace(doc, rowHeight + 2);
    const y = doc.y;
    let x = LEFT;
    cells.forEach((cell, index) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor(cell?.color ?? INK);
      const text = fit(doc, cell?.text ?? cell ?? '', widths[index] - 8);
      doc.text(text, x + 4, y + 5, { lineBreak: false });
      x += widths[index];
    });
    doc
      .moveTo(LEFT, y + rowHeight)
      .lineTo(LEFT + WIDTH, y + rowHeight)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    doc.x = LEFT;
    doc.y = y + rowHeight;
  };
  draw(headers, true);
  for (const row of rows) draw(row, false);
  doc.moveDown(0.4);
}

function describeFilters(filters, options) {
  const parts = [];
  if (filters.from || filters.to)
    parts.push(`Periodo: ${filters.from ?? 'inicio'} a ${filters.to ?? 'hoy'}`);
  parts.push(
    `Agrupación por tiempo: ${{ year: 'año', quarter: 'trimestre', month: 'mes', day: 'día' }[filters.grain]}`,
  );
  if (filters.contactId != null)
    parts.push(
      `Contacto: ${options.contacts.find((item) => item.id === filters.contactId)?.name ?? filters.contactId}`,
    );
  if (filters.channel != null) parts.push(`Canal: ${CHANNEL_NAMES[filters.channel]}`);
  if (filters.role != null) parts.push(`Rol: ${ROLE_NAMES[filters.role]}`);
  if (filters.plan != null)
    parts.push(
      `Plan: ${options.plans.find((item) => item.id === filters.plan)?.name ?? filters.plan}`,
    );
  return parts.join('  |  ');
}

const percent = (value) => (value == null ? 'N/A' : `${value}%`);
const breakdownTitles = {
  time: 'Por tiempo',
  channel: 'Por canal',
  role: 'Por rol del contacto',
  plan: 'Por plan',
  contact: 'Por contacto (primeros 15)',
  priority: 'Por prioridad',
};

export function createKpiReport(data) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    bufferPages: true,
    info: { Title: 'Indicadores de la fase LEADS' },
  });
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(INK)
    .text('Indicadores de la fase LEADS', LEFT, 48);
  doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('LaPreDigital · Agente Negociador');
  doc.moveDown(0.5);
  paragraph(doc, `Generado el ${data.generatedAt.replace('T', ' ')} (hora de Lima).`, MUTED, 9);
  paragraph(doc, describeFilters(data.filters, data.options), MUTED, 9);

  heading(doc, 'Resumen', 13);
  table(
    doc,
    ['Código', 'Indicador', 'Resultado', '%', 'Estado'],
    data.kpis.map((kpi) => [
      kpi.id,
      kpi.name,
      `${kpi.numerator} / ${kpi.denominator}`,
      percent(kpi.percent),
      { text: kpi.state.label, color: COLORS[kpi.state.code] },
    ]),
    [55, 230, 75, 55, 84],
  );

  for (const kpi of data.kpis) {
    doc.addPage();
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(INK)
      .text(`${kpi.id}  ${kpi.name}`, LEFT, 48, { width: WIDTH });
    doc.moveDown(0.3);
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(COLORS[kpi.state.code])
      .text(percent(kpi.percent), LEFT, doc.y, { continued: true });
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(MUTED)
      .text(`   ${kpi.state.label}  ·  ${kpi.formula}`);
    doc.moveDown(0.3);
    for (const measure of kpi.measures)
      paragraph(doc, `${measure.code}: ${measure.label} = ${measure.value}`, INK, 10);
    heading(doc, 'Qué mide', 11);
    paragraph(doc, kpi.meaning);
    heading(doc, 'Interpretación', 11);
    paragraph(doc, kpi.interpretation);
    if (kpi.note) paragraph(doc, kpi.note, MUTED, 9);
    if (kpi.causes.length) {
      heading(doc, 'Por qué no se cumple (unidades que no llegan al numerador)', 11);
      table(
        doc,
        ['Motivo', 'Unidades'],
        kpi.causes.map((cause) => [cause.label, cause.count]),
        [400, 99],
      );
    }
    for (const [dimension, items] of Object.entries(kpi.breakdown)) {
      if (!items.length) continue;
      heading(doc, breakdownTitles[dimension] ?? dimension, 11);
      table(
        doc,
        ['Valor', 'Numerador', 'Denominador', '%'],
        items.map((item) => [item.label, item.numerator, item.denominator, percent(item.percent)]),
        [235, 90, 90, 84],
      );
    }
  }

  doc.addPage();
  heading(doc, 'Notas metodológicas', 13);
  for (const note of [
    `Los indicadores se calculan sobre las tablas de hechos de ${data.source} con las reglas de las secciones 3.3 a 3.5 del informe: ventana de medición de 168 horas, unidad de conteo propia de cada indicador y denominador cero como «No aplicable».`,
    'Los semáforos son metas académicas propuestas en el informe, no resultados observados de operación real.',
    'Las unidades con la ventana de 7 días todavía abierta se cuentan, pero el resultado es provisional hasta que termine su ventana.',
    'Los datos obtenidos con el pago simulado de demostración o con contactos de prueba son simulados y deben declararse así al presentarlos.',
    'Los filtros por dimensión solo se aplican a los indicadores cuya medida las admite (tabla 10): L-4.1 no se filtra por contacto ni rol; L-5.1 no se filtra por canal ni plan.',
  ])
    paragraph(doc, `- ${note}`, INK, 9.5);

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(range.start + index);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Página ${index + 1} de ${range.count}`, LEFT, doc.page.height - 36, {
        width: WIDTH,
        align: 'right',
        lineBreak: false,
      });
  }
  doc.end();
  return doc;
}
