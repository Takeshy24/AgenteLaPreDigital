import { Button, Card, Empty } from '../components/ui';
import { parameterLabels } from '../shared/reportCatalog';
import { useWorkspace } from '../state/Workspace';
export function Followup() {
  const { data, busy, run } = useWorkspace();
  return (
    <div className="followup-page">
      <Card title="Una agenda por participación" label="L-1 · SEGUIMIENTO AUTORIZADO">
        <p>
          Los días se cuentan desde el inicio original del seguimiento autorizado. Una reactivación
          no reinicia la secuencia.
        </p>
        <div className="schedule-track" aria-label="Días de la agenda vigente">
          {data?.agenda.map((attempt) => (
            <div className="schedule-step" key={attempt.numeroIntento}>
              <span className="step-dot">{attempt.numeroIntento}</span>
              <b>Día {attempt.diaDesdeInicio}</b>
            </div>
          ))}
        </div>
        {!data?.agenda.length && <Empty>Sin agenda configurada.</Empty>}
        <div className="section-actions">
          <Button
            disabled={busy}
            onClick={() => run('/followup/run', {}, 'Revisión de seguimiento completada.')}
          >
            {busy ? 'Revisando…' : 'Revisar vencimientos'}
          </Button>
          <span>Esta revisión no envía mensajes por sí sola.</span>
        </div>
      </Card>
      <div className="guidance-grid">
        <Card title="Antes de cada envío" label="INFORME §2.2 Y §2.5">
          <p>
            Se comprueban autorización, estado de participación y caso, bloqueo promocional,
            derivación y pagos o becas pendientes. Los intentos omitidos no se reprograman.
          </p>
        </Card>
        <Card title="Entrega y respuesta" label="F2 · F9">
          <p>
            Entregado significa que el canal confirmó el envío; no implica lectura. Solo los
            intentos entregados con plazo vencido sin respuesta incrementan el contador.
          </p>
        </Card>
      </div>
      <section className="data-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CONFIGURACIÓN VIGENTE</span>
            <h2>Parámetros del proceso</h2>
          </div>
          <span>Referencia: informe §2.5, tabla 7</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Parámetro</th>
                <th scope="col">Valor configurado</th>
              </tr>
            </thead>
            <tbody>
              {data?.parameters.map((parameter) => (
                <tr key={parameter.codigo}>
                  <td>{parameterLabels[parameter.codigo]?.label || parameter.codigo}</td>
                  <td>
                    <b>{parameter.valor}</b> {parameterLabels[parameter.codigo]?.unit || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.parameters.length && <Empty>Sin parámetros disponibles.</Empty>}
        </div>
      </section>
    </div>
  );
}
