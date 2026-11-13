import { Download, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui';
import type { KpiFilters as Filters, KpiResponse } from '../../api';

export const emptyFilters: Filters = {
  from: '',
  to: '',
  grain: 'month',
  contact: '',
  channel: '',
  role: '',
  plan: '',
};

export function filterQuery(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== '') params.set(key, value);
  return params.toString();
}

const grains = [
  { id: 'year', name: 'Año' },
  { id: 'quarter', name: 'Trimestre' },
  { id: 'month', name: 'Mes' },
  { id: 'day', name: 'Día' },
] as const;

export function KpiFilters({
  filters,
  options,
  onChange,
  onPdf,
  onRefresh,
  busy,
}: {
  filters: Filters;
  options: KpiResponse['options'] | null;
  onChange: (filters: Filters) => void;
  onPdf: () => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  const set = (name: keyof Filters) => (value: string) => onChange({ ...filters, [name]: value });
  const changed = JSON.stringify(filters) !== JSON.stringify(emptyFilters);
  return (
    <section className="kpi-filters" aria-label="Filtros por dimensión">
      <div className="kpi-filter-grid">
        <label>
          Desde
          <input type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} />
        </label>
        <label>
          Agrupar el tiempo por
          <select value={filters.grain} onChange={(e) => set('grain')(e.target.value)}>
            {grains.map((grain) => (
              <option key={grain.id} value={grain.id}>
                {grain.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Canal
          <select value={filters.channel} onChange={(e) => set('channel')(e.target.value)}>
            <option value="">Todos</option>
            {options?.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rol del contacto
          <select value={filters.role} onChange={(e) => set('role')(e.target.value)}>
            <option value="">Todos</option>
            {options?.roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Plan
          <select value={filters.plan} onChange={(e) => set('plan')(e.target.value)}>
            <option value="">Todos</option>
            {options?.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contacto
          <select value={filters.contact} onChange={(e) => set('contact')(e.target.value)}>
            <option value="">Todos</option>
            {options?.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="kpi-filter-actions">
        <p>
          Al cambiar un filtro, resaltan los indicadores que lo admiten y se atenúan los demás.
          «Agrupar el tiempo» cambia el desglose temporal. La prioridad de L-5.1 es siempre Alta.
        </p>
        <div>
          <Button variant="secondary" disabled={busy} onClick={onRefresh}>
            <RefreshCw size={14} />
            Actualizar datos
          </Button>
          <Button variant="secondary" disabled={!changed} onClick={() => onChange(emptyFilters)}>
            <RotateCcw size={14} />
            Limpiar filtros
          </Button>
          <Button disabled={busy || !options} onClick={onPdf}>
            <Download size={14} />
            Reporte PDF
          </Button>
        </div>
      </div>
    </section>
  );
}
