import { Check, ChevronDown, Info, MessageSquare, SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Badge, Button, Card } from '../../components/ui';
import { formatDate } from '../../shared/dates';
import { useWorkspace } from '../../state/Workspace';
import './PriorityCard.css';

const interests = [
  {
    value: 1,
    title: 'Sin señal de interés',
    example: 'Sin una consulta o intención de compra registrada.',
  },
  { value: 2, title: 'Consulta', example: '«¿Cuánto cuesta el plan?», «¿Qué incluye?»' },
  {
    value: 3,
    title: 'Intención de compra',
    example: '«Quiero contratar», «¿Cómo puedo inscribirme?»',
  },
];
const reasons: Record<number, string> = {
  1: 'Se alcanzó el límite de intentos vencidos sin respuesta.',
  2: 'Los intentos vencidos sin respuesta redujeron la prioridad.',
  3: 'Se registró una intención de compra.',
  4: 'Se registró una consulta sobre el servicio.',
  5: 'Aún no hay una señal de consulta o compra registrada.',
};

export function PriorityCard() {
  const { selected, detail, data, busy, error, run } = useWorkspace();
  const formId = useId();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const [level, setLevel] = useState<number | null>(null);
  const [messageId, setMessageId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (saved && !reviewing) reviewButton.current?.focus();
  }, [saved, reviewing]);
  if (!selected) return null;

  const evaluations = detail?.evaluations ?? [];
  const latest = evaluations[0];
  const messages = detail?.messages.filter((message) => message.idDireccion === 1) ?? [];
  const evidence = messages.find((message) => message.idMensaje === Number(messageId));
  const requiresEvidence = level !== null && level !== 1;
  const canReview = selected.idEstadoCaso === 1 && selected.idEstadoParticipacion < 3;
  const low = data?.parameters.find((parameter) => parameter.codigo === 'UMBRAL_BAJA')?.valor;
  const none = data?.parameters.find((parameter) => parameter.codigo === 'UMBRAL_NULA')?.valor;
  let explanation = 'Prioridad registrada en el expediente.';
  if (selected.priority === 'Pendiente')
    explanation = 'Todavía no se ha evaluado esta participación.';
  else if (latest?.prioridad === selected.priority && reasons[latest.idReglaAplicada])
    explanation = reasons[latest.idReglaAplicada];

  return (
    <Card title="Prioridad de seguimiento" label="L-5 · PRIORIDAD" className="priority-card">
      <div className="priority-current">
        <div>
          <span className="priority-caption">Prioridad actual</span>
          <Badge value={selected.priority} />
        </div>
        <div className="priority-participation">
          <span className="priority-caption">Participación</span>
          <Badge value={selected.status} />
        </div>
      </div>
      <p className="priority-reason">{explanation}</p>
      <p className="priority-interest-saved">
        Interés registrado: <strong>{selected.interest}</strong>
      </p>

      <dl className="priority-counts">
        <div>
          <dt>Sin respuesta</dt>
          <dd>
            <strong>{latest?.intentosSinRespuesta ?? '—'}</strong>
            <span>en la última evaluación</span>
          </dd>
        </div>
        <div>
          <dt>Intentos en agenda</dt>
          <dd>
            <strong>{detail?.attempts.length ?? '—'}</strong>
            <span>total programado</span>
          </dd>
        </div>
      </dl>
      <p className="priority-count-help">
        <Info size={15} aria-hidden="true" />
        Solo cuentan como «sin respuesta» los envíos entregados cuyo plazo de respuesta ya venció.
      </p>
      {latest && (
        <p className="priority-updated">
          Última evaluación:{' '}
          <time dateTime={latest.fechaEvaluacion}>{formatDate(latest.fechaEvaluacion)}</time>
        </p>
      )}
      {saved && (
        <p className="priority-success" role="status">
          <Check size={16} aria-hidden="true" /> Evaluación guardada.
        </p>
      )}
      <button
        ref={reviewButton}
        type="button"
        className="button secondary priority-review-toggle"
        aria-expanded={reviewing}
        aria-controls={`${formId}-review`}
        aria-describedby={!canReview ? `${formId}-closed` : undefined}
        disabled={busy || !canReview}
        onClick={() => {
          setReviewing(!reviewing);
          setSaved(false);
        }}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {reviewing ? 'Cerrar revisión' : 'Revisar interés y prioridad'}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {!canReview && (
        <p id={`${formId}-closed`} className="priority-help">
          El caso o la participación están cerrados para evaluaciones.
        </p>
      )}

      <div id={`${formId}-review`} hidden={!reviewing}>
        <form
          className="form priority-form"
          aria-label="Revisión manual de prioridad"
          onSubmit={async (event) => {
            event.preventDefault();
            if (level === null || (requiresEvidence && !evidence) || busy || saving || !canReview)
              return;
            setSaving(true);
            setFailed(false);
            try {
              const success = await run(
                `/participations/${selected.id}/evaluations`,
                { level, ...(evidence ? { messageId: evidence.idMensaje } : {}) },
                'Evaluación de prioridad guardada.',
              );
              if (!success) {
                setFailed(true);
                return;
              }
              setSaved(true);
              setReviewing(false);
              setLevel(null);
              setMessageId('');
            } finally {
              setSaving(false);
            }
          }}
        >
          <fieldset className="priority-choices" disabled={busy || !canReview}>
            <legend>¿Qué expresa el contacto?</legend>
            <p className="priority-help">Selecciona el interés que vas a registrar.</p>
            {interests.map((interest) => (
              <label
                key={interest.value}
                className={`priority-option${level === interest.value ? ' is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name={`${formId}-interest`}
                  value={interest.value}
                  checked={level === interest.value}
                  required
                  onChange={() => {
                    setLevel(interest.value);
                    setFailed(false);
                  }}
                />
                <span>
                  <strong>{interest.title}</strong>
                  <small>{interest.example}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="priority-evidence">
            Mensaje que respalda la evaluación {requiresEvidence ? '(obligatorio)' : '(opcional)'}
            <select
              value={messageId}
              required={requiresEvidence}
              disabled={busy || !canReview || !messages.length}
              aria-describedby={`${formId}-evidence-help`}
              onChange={(event) => {
                setMessageId(event.target.value);
                setFailed(false);
              }}
            >
              <option value="">
                {requiresEvidence
                  ? 'Selecciona un mensaje del contacto'
                  : 'Sin mensaje de respaldo'}
              </option>
              {messages.map((message) => (
                <option key={message.idMensaje} value={message.idMensaje}>
                  #{message.idMensaje} · {message.textoMensaje.replace(/\s+/g, ' ').slice(0, 85)}
                </option>
              ))}
            </select>
          </label>
          <p id={`${formId}-evidence-help`} className="priority-help">
            {!messages.length
              ? 'Aún no hay mensajes del contacto. Para registrar Consulta o Compra, primero debe existir un mensaje en la conversación.'
              : 'Consulta y Compra requieren un mensaje recibido del contacto. Sin señal de interés permite evaluar sin mensaje.'}
          </p>
          {evidence && (
            <figure className="priority-evidence-preview">
              <figcaption>
                <MessageSquare size={14} aria-hidden="true" /> {evidence.canal} ·{' '}
                {formatDate(evidence.fechaHora)}
              </figcaption>
              <blockquote>{evidence.textoMensaje}</blockquote>
            </figure>
          )}
          <p className="priority-calculation-note">
            Tú registras el interés; el sistema calcula la prioridad con las reglas del proceso.
          </p>
          {failed && (
            <p className="priority-error" role="alert">
              {error || 'No se pudo guardar la evaluación. Inténtalo de nuevo.'}
            </p>
          )}
          <Button
            disabled={
              busy || saving || level === null || (requiresEvidence && !evidence) || !canReview
            }
            aria-describedby={`${formId}-save-help`}
          >
            {saving ? 'Guardando evaluación…' : 'Guardar evaluación'}
          </Button>
          <p id={`${formId}-save-help`} className="priority-help">
            {level === null
              ? 'Elige una opción para continuar.'
              : requiresEvidence && !evidence
                ? 'Selecciona el mensaje de respaldo para poder guardar.'
                : 'La evaluación quedará registrada en el historial.'}
          </p>
        </form>
      </div>

      <details className="priority-disclosure">
        <summary>
          Cómo se calcula la prioridad <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <p>
          El interés orienta la prioridad cuando no se han alcanzado los límites de intentos sin
          respuesta.
        </p>
        <ul className="priority-rules">
          <li>
            <span>Sin señal de interés</span>
            <Badge value="Baja" />
          </li>
          <li>
            <span>Consulta</span>
            <Badge value="Media" />
          </li>
          <li>
            <span>Intención de compra</span>
            <Badge value="Alta" />
          </li>
        </ul>
        <p>
          {low !== undefined && none !== undefined
            ? `Desde ${low} intentos vencidos sin respuesta, la prioridad pasa a Baja; desde ${none}, a Nula, aunque antes hubiera interés de compra.`
            : 'Los límites de intentos sin respuesta pueden reducir la prioridad a Baja o Nula, según la configuración del proceso.'}
        </p>
      </details>
      <details className="priority-disclosure">
        <summary>
          Historial de evaluaciones ({evaluations.length}){' '}
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        {!evaluations.length && <p>Todavía no hay evaluaciones guardadas.</p>}
        {!!evaluations.length && (
          <ol className="priority-history">
            {evaluations.map((evaluation) => (
              <li key={evaluation.idEvaluacion}>
                <Badge value={evaluation.prioridad} />
                <div>
                  <time dateTime={evaluation.fechaEvaluacion}>
                    {formatDate(evaluation.fechaEvaluacion)}
                  </time>
                  <span>{evaluation.intentosSinRespuesta} intentos vencidos sin respuesta</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </details>
    </Card>
  );
}
