import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { planFeatures } from '../../shared/reportCatalog';

const differentiators = new Set([
  'Ruta de estudio',
  'Simulacros completos',
  'Consultas de IA mensuales',
  'Reportes para apoderados',
  'Alertas avanzadas de rendimiento',
]);

export function PlanBenefits({ plan }: { plan: string }) {
  const features = planFeatures(plan).filter(
    (feature) => feature.value !== '—' && feature.value !== 'No',
  );
  return (
    <ul className="plans-benefits">
      {features.map((feature, position) => (
        <li
          className={differentiators.has(feature.label) ? 'is-differential' : ''}
          key={feature.label}
          style={{ '--check-delay': `${position * 30}ms` } as CSSProperties}
        >
          <span className="plans-check">
            <Check size={13} strokeWidth={2.3} aria-hidden="true" />
          </span>
          <span>
            {feature.label}
            {feature.value !== 'Sí' && <b>{feature.value}</b>}
          </span>
        </li>
      ))}
    </ul>
  );
}
