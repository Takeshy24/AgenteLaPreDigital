import type { KpiDimension, KpiFilters } from '../../api';

export const filterLabels: Record<keyof KpiFilters, string> = {
  from: 'Periodo',
  to: 'Periodo',
  grain: 'Agrupación temporal',
  contact: 'Contacto',
  channel: 'Canal',
  role: 'Rol',
  plan: 'Plan',
};
const dimensions: Record<keyof KpiFilters, KpiDimension> = {
  from: 'time',
  to: 'time',
  grain: 'time',
  contact: 'contact',
  channel: 'channel',
  role: 'role',
  plan: 'plan',
};

export function filterImpact(
  supported: KpiDimension[],
  filters: KpiFilters,
  focus: keyof KpiFilters | null,
) {
  const active = (Object.keys(dimensions) as (keyof KpiFilters)[]).filter(
    (key) => key !== 'grain' && filters[key] !== '',
  );
  const names = (keys: (keyof KpiFilters)[]) => [...new Set(keys.map((key) => filterLabels[key]))];
  const applied = names(active.filter((key) => supported.includes(dimensions[key])));
  const ignored = names(active.filter((key) => !supported.includes(dimensions[key])));
  const affected = focus ? supported.includes(dimensions[focus]) : applied.length > 0;
  return {
    applied,
    ignored,
    affected,
    state: focus || active.length ? (affected ? 'affected' : 'unaffected') : 'neutral',
  } as const;
}
