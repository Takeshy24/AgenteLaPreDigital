// Condiciones de contratación que la persona acepta en su oferta personal (informe, secciones 2.2,
// 2.4 y F7). Se arman con los datos de la propuesta y la tabla 4, sin texto inventado.
import { readFileSync } from 'node:fs';

const features = JSON.parse(
  readFileSync(new URL('../../src/shared/offer.json', import.meta.url), 'utf8'),
);
const PLANS = ['Explora UNT', 'Ruta UNT', 'Meta UNT', 'Meta UNT Plus'];
const money = (value) => `S/ ${Number(value).toFixed(2)}`;
const date = (value) =>
  new Date(value).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

export function offerConditions(offer) {
  const period = String(offer.modalidad).toLowerCase() === 'semestral' ? 'semestre' : 'mes';
  const support = features.find((item) => item.label.startsWith('Primera respuesta de soporte'))
    ?.values[PLANS.indexOf(offer.plan)];
  const discount =
    offer.precioCatalogo != null && Number(offer.precioAutorizado) < Number(offer.precioCatalogo);
  return [
    `Se cobra ${money(offer.precioAutorizado)} por cada ${period} contratado (modalidad ${String(offer.modalidad).toLowerCase()}), sin cuotas pendientes.`,
    ...(discount
      ? [
          `El precio incluye un descuento aprobado por el personal comercial sobre el precio de catálogo de ${money(offer.precioCatalogo)}.`,
        ]
      : []),
    `${offer.plan} incluye los beneficios de su plan según el catálogo; los planes superiores incluyen los de los inferiores.`,
    ...(support
      ? [
          `Tiempo máximo de primera respuesta de soporte: ${support}. Es un tiempo de primera respuesta, no de resolución.`,
        ]
      : []),
    'Aceptar esta oferta no confirma el pago: el pago se confirma cuando la pasarela lo registra, y el personal comercial valida la contratación antes de habilitar el servicio.',
    ...(offer.expiresAt ? [`Esta oferta es personal y vence el ${date(offer.expiresAt)}.`] : []),
  ];
}
