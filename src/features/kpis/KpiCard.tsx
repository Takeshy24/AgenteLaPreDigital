import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { Kpi, KpiBreakdownItem, KpiDimension, KpiFilters } from '../../api';
import { formatDate } from '../../shared/dates';

const stateTone = { ok: 'green', alert: 'amber', critical: 'red', na: 'gray' } as const;
const dimensionNames: Record<KpiDimension, string> = {
  time: 'Tiempo',
  channel: 'Canal',
  role: 'Rol',
  plan: 'Plan',
  contact: 'Contacto',
  priority: 'Prioridad',
};
const filterDimension: Record<string, KpiDimension | undefined> = {
  contact: 'contact',
  channel: 'channel',
  role: 'role',
  plan: 'plan',
};

const percentText = (value: number | null) => (value == null ? '—' : `${value}%`);

function Meter({ value, thresholds }: { value: number | null; thresholds: [number, number] }) {
  return (
    <div className="kpi-meter" aria-hidden="true">
      <span className="kpi-meter-fill" style={{ width: `${value ?? 0}%` }} />
      {thresholds.map((threshold) => (
        <i key={threshold} style={{ left: `${threshold}%` }} />
      ))}
    </div>
  );
}

function BreakdownTable({ items }: { items: KpiBreakdownItem[] }) {
  if (!items.length) return <p className="kpi-empty">Sin datos para esta dimensión.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Valor</th>
            <th scope="col">Numerador</th>
            <th scope="col">Denominador</th>
            <th scope="col">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <td>{item.label}</td>
              <td>{item.numerator}</td>
              <td>{item.denominator}</td>
              <td>
                <div className="kpi-row-bar">
                  <span style={{ width: `${item.percent ?? 0}%` }} />
                  <b>{percentText(item.percent)}</b>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KpiCard({ kpi, filters }: { kpi: Kpi; filters: KpiFilters }) {
  const [open, setOpen] = useState(false);
  const available = kpi.dimensions.filter((dimension) => kpi.breakdown[dimension] !== undefined);
  const [dimension, setDimension] = useState<KpiDimension>(available[0] ?? 'time');
  const panelId = useId();
  const ignored = Object.entries(filterDimension)
    .filter(
      ([name, dim]) =>
        filters[name as keyof KpiFilters] !== '' && dim && !kpi.dimensions.includes(dim),
    )
    .map(([, dim]) => dimensionNames[dim as KpiDimension].toLowerCase());
  return (
    <article className={`kpi-card ${kpi.state.code}${open ? ' open' : ''}`}>
      <header>
        <span className="kpi-code">{kpi.id}</span>
        <span className={`pill ${stateTone[kpi.state.code]}`}>{kpi.state.label}</span>
      </header>
      <h3>{kpi.name}</h3>
      <div className="kpi-figure">
        <strong>{percentText(kpi.percent)}</strong>
        <span>
          {kpi.numerator} de {kpi.denominator} · {kpi.unit}
        </span>
      </div>
      <Meter value={kpi.percent} thresholds={kpi.thresholds} />
      <p className="kpi-scale">
        Crítico &lt; {kpi.thresholds[0]}% · Alerta hasta {kpi.thresholds[1]}% · Satisfactorio desde{' '}
        {kpi.thresholds[1]}%
      </p>
      {kpi.provisional > 0 && (
        <p className="kpi-flag">
          Provisional: {kpi.provisional} unidad{kpi.provisional === 1 ? '' : 'es'} con la ventana de
          7 días abierta.
        </p>
      )}
      {ignored.length > 0 && (
        <p className="kpi-flag muted">
          No filtra por {ignored.join(' ni ')}: la medida no tiene esa dimensión.
        </p>
      )}
      <button
        type="button"
        className="kpi-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Ocultar detalle' : 'Ver detalle e interpretación'}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="kpi-detail" id={panelId}>
          <section>
            <h4>Qué mide</h4>
            <p>{kpi.meaning}</p>
            <p className="kpi-formula">
              {kpi.formula}
              {kpi.measures.map((measure) => (
                <span key={measure.code}>
                  <b>{measure.code}</b> {measure.label}: {measure.value}
                </span>
              ))}
            </p>
          </section>
          <section>
            <h4>Cómo leerlo</h4>
            <p>{kpi.interpretation}</p>
            {kpi.note && <p className="kpi-flag muted">{kpi.note}</p>}
          </section>
          {kpi.causes.length > 0 && (
            <section>
              <h4>Por qué no se cumple</h4>
              <ul className="kpi-causes">
                {kpi.causes.map((cause) => (
                  <li key={cause.label}>
                    <span>{cause.label}</span>
                    <b>{cause.count}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {available.length > 0 && (
            <section>
              <h4>Desglose por dimensión</h4>
              <div className="kpi-tabs" role="tablist" aria-label="Dimensión del desglose">
                {available.map((item) => (
                  <button
                    key={item}
                    role="tab"
                    type="button"
                    aria-selected={dimension === item}
                    className={dimension === item ? 'active' : ''}
                    onClick={() => setDimension(item)}
                  >
                    {dimensionNames[item]}
                  </button>
                ))}
              </div>
              <BreakdownTable items={kpi.breakdown[dimension] ?? []} />
            </section>
          )}
          {kpi.units.length > 0 && (
            <section>
              <h4>Unidades más recientes</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Unidad</th>
                      <th scope="col">Origen</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpi.units.slice(0, 10).map((unit) => (
                      <tr key={unit.label + unit.at}>
                        <td>{unit.label}</td>
                        <td>{formatDate(unit.at)}</td>
                        <td>{unit.done ? 'Cumple' : (unit.reason ?? 'No cumple')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </article>
  );
}
