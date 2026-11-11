import { readFileSync } from 'node:fs';
import { mentionedPlans } from './knowledge.mjs';
const features = JSON.parse(
  readFileSync(new URL('../../src/shared/offer.json', import.meta.url), 'utf8'),
);
const names = ['Explora UNT', 'Ruta UNT', 'Meta UNT', 'Meta UNT Plus'];
export function describePlans(text, tariffs) {
  const selected = mentionedPlans(text);
  const plans = (selected.length ? selected : names).filter(
    (name) => name === 'Explora UNT' || tariffs.some((tariff) => tariff.plan === name),
  );
  if (!plans.length)
    return 'No hay una tarifa vigente para esa alternativa. Podemos revisar otro plan del catálogo.';
  return (
    plans
      .map((name) => {
        const index = names.indexOf(name);
        const prices = tariffs
          .filter((tariff) => tariff.plan === name)
          .map((tariff) => `${tariff.modalidad}: S/ ${Number(tariff.precio).toFixed(2)}`)
          .join(' · ');
        const benefits = features
          .filter((feature) => !['—', 'No'].includes(feature.values[index]))
          .map(
            (feature) =>
              `${feature.label}${feature.values[index] === 'Sí' ? '' : `: ${feature.values[index]}`}`,
          )
          .join('\n• ');
        return `${name}${prices ? ` — ${prices}` : ' — 14 días gratuitos'}\n• ${benefits}`;
      })
      .join('\n\n') +
    '\n\nLos importes son por periodo contratado. ¿Qué plan y modalidad te interesa?'
  );
}
