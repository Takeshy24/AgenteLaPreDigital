import { useEffect, useState } from 'react';
import { apiUrl, request, type KpiFilters as Filters, type KpiResponse } from '../api';
import { Empty } from '../components/ui';
import { emptyFilters, filterQuery, KpiFilters } from '../features/kpis/KpiFilters';
import { KpiCard } from '../features/kpis/KpiCard';
import { filterImpact, filterLabels } from '../features/kpis/filter-impact';
import './Kpis.css';

export function Kpis() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [focus, setFocus] = useState<keyof Filters | null>(null);
  const [data, setData] = useState<KpiResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    request<KpiResponse>('/kpis?' + filterQuery(filters))
      .then((result) => {
        if (!active) return;
        setData(result);
        setAppliedFilters(filters);
        setError('');
      })
      .catch((failure: Error) => active && setError(failure.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filters, revision]);
  function changeFilters(next: Filters) {
    const changes = (Object.keys(next) as (keyof Filters)[]).filter(
      (key) => next[key] !== filters[key],
    );
    setFocus(
      JSON.stringify(next) === JSON.stringify(emptyFilters)
        ? null
        : changes.length === 1
          ? changes[0]
          : null,
    );
    setFilters(next);
  }
  const affected =
    data?.kpis.filter((kpi) => filterImpact(kpi.dimensions, filters, focus).affected).length ?? 0;
  async function refresh() {
    setRefreshing(true);
    setError('');
    try {
      await request('/kpis/refresh', 'POST', {});
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'No se pudieron actualizar los indicadores.',
      );
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className="kpis-page">
      <KpiFilters
        filters={filters}
        options={data?.options ?? null}
        onChange={changeFilters}
        onPdf={() => window.open(apiUrl('/kpis/report.pdf?' + filterQuery(filters)), '_blank')}
        onRefresh={refresh}
        busy={loading || refreshing}
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
            {refreshing
              ? 'Cargando datos del sistema…'
              : loading
                ? 'Actualizando…'
                : `Calculado el ${data.generatedAt.replace('T', ' ')} (hora de Lima)`}
            {' · '}Origen: {data.source}. Usa «Actualizar datos» para incorporar cambios.
            {' · '}Los semáforos son metas académicas propuestas por el informe, no resultados de
            operación real.
          </p>
          {focus && !error && (
            <div className="kpi-impact-legend" role="status" aria-live="polite">
              <span className="kpi-impact-dot" aria-hidden="true" />
              <p>
                <strong>{filterLabels[focus]}:</strong> se aplica a {affected} de {data.kpis.length}{' '}
                indicadores{focus === 'grain' ? ', en su desglose temporal' : ''}.{' '}
                {affected < data.kpis.length
                  ? 'Los demás se muestran atenuados.'
                  : 'Todos admiten esta opción.'}
                {loading
                  ? ' Actualizando resultados…'
                  : focus === 'grain'
                    ? ' Solo cambia el desglose; los porcentajes generales se conservan.'
                    : ' El valor puede coincidir con el cálculo anterior.'}
              </p>
            </div>
          )}
          {error && <p className="kpi-stamp">Se conserva el último cálculo confirmado.</p>}
          <div className="kpi-grid">
            {data.kpis.map((kpi) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                filters={appliedFilters}
                focus={error ? null : focus}
                updating={loading}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
