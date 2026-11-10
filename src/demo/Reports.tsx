import { BarChart3, CircleHelp, Clock, Download } from 'lucide-react';
import { kpis } from '../data';
export function Reports({ period, setPeriod }: { period: string; setPeriod: (s: string) => void }) {
  return (
    <>
      <div className="report-banner">
        <div>
          <div className="report-icon">
            <BarChart3 size={20} />
          </div>
          <div>
            <b>Indicadores de diseño de la fase LEADS</b>
            <p>
              Datos ficticios para mostrar la estructura de análisis. No corresponden a resultados
              del proyecto.
            </p>
          </div>
        </div>
        <div className="report-tools">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option>Este mes</option>
            <option>Últimos 3 meses</option>
            <option>Últimos 6 meses</option>
          </select>
          <button className="button secondary" onClick={() => window.print()}>
            <Download size={15} /> Exportar
          </button>
        </div>
      </div>
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div className="panel kpi-card" key={k.code}>
            <div className="kpi-top">
              <span className="eyebrow">{k.code}</span>
              <button className="icon-btn small" title="Definición del indicador">
                <CircleHelp size={15} />
              </button>
            </div>
            <h3>{k.name}</h3>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-progress">
              <i style={{ width: k.value }} />
            </div>
            <div className="kpi-count">
              <b>{k.num}</b>
              <span>/ {k.den}</span>
            </div>
            <p>{k.detail}</p>
            <div className="kpi-window">
              <Clock size={12} />
              {i === 0 || i === 1 || i === 5 ? 'Cierre mensual' : 'Ventana de resultado: 7 días'}
            </div>
          </div>
        ))}
      </div>
      <section className="panel report-chart">
        <div className="panel-head">
          <div>
            <span className="eyebrow">EVOLUCIÓN DEMOSTRATIVA</span>
            <h3>Indicadores por periodo</h3>
          </div>
          <select>
            <option>Todos los indicadores</option>
            {kpis.map((k) => (
              <option key={k.code}>
                {k.code} · {k.name}
              </option>
            ))}
          </select>
        </div>
        <div className="report-chart-body">
          <div className="report-scale">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>
          <div className="report-chart-plot">
            <div className="report-lines">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="bar-chart">
              {[
                ['L-1.1', 86],
                ['L-1.2', 62],
                ['L-2.1', 54],
                ['L-3.1', 71],
                ['L-4.1', 38],
                ['L-5.1', 92],
              ].map(([n, v]) => (
                <div className="bar-col" key={String(n)}>
                  <span>{v}%</span>
                  <i style={{ height: `${Number(v)}%` }} />
                  <small>{n}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="report-caption">
          <span>Porcentajes ilustrativos · No calculados desde un DataMart</span>
          <span>Umbrales de semáforo: no disponibles en el informe</span>
        </div>
      </section>
      <section className="panel kpi-method">
        <div className="method-icon">
          <CircleHelp size={17} />
        </div>
        <div>
          <b>Cómo se interpretan</b>
          <p>
            Los indicadores se expresan como numerador dividido entre denominador por 100. Si el
            denominador es cero, el resultado es “No aplicable”. L-1.1, L-1.2 y L-5.1 se observan al
            cierre mensual; L-2.1, L-3.1 y L-4.1 se atribuyen al mes de origen y observan una
            ventana de siete días. La población y la unidad de análisis siguen las definiciones del
            informe.
          </p>
        </div>
      </section>
    </>
  );
}
