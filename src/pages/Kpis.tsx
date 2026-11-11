import { useEffect, useState } from 'react';
import { apiUrl, request, type KpiFilters as Filters, type KpiResponse } from '../api';
import { Empty } from '../components/ui';
import { emptyFilters, filterQuery, KpiFilters } from '../features/kpis/KpiFilters';
import { KpiCard } from '../features/kpis/KpiCard';
import './Kpis.css';

export function Kpis() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [data, setData] = useState<KpiResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    request<KpiResponse>('/kpis?' + filterQuery(filters))
      .then((result) => {
        if (!active) return;
        setData(result);
        setError('');
      })
      .catch((failure: Error) => active && setError(failure.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filters]);
  return (
    <div className="kpis-page">
      <KpiFilters
        filters={filters}
        options={data?.options ?? null}
        onChange={setFilters}
        onPdf={() => window.open(apiUrl('/kpis/report.pdf?' + filterQuery(filters)), '_blank')}
      />
      {error && (
        <div role="alert" className="live-alert">
          {error}
        </div>
      )}
      {!data && !error && <Empty>Calculando indicadores…</Empty>}
      {data && (
        <>
          <p className="kpi-stamp" role="status" aria-live="polite">
            {loading
              ? 'Actualizando…'
              : `Calculado el ${data.generatedAt.replace('T', ' ')} (hora de Lima)`}
            {' · '}Los semáforos son metas académicas propuestas por el informe, no resultados de
            operación real.
          </p>
          <div className="kpi-grid">
            {data.kpis.map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} filters={filters} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
