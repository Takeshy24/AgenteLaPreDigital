import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Save, Check, GitBranch } from 'lucide-react';
import { request } from '../api';
import { Button, Empty } from '../components/ui';
import type { AgentPolicy, ProfileQuestion } from '../features/knowledge/api';
import { useWorkspace } from '../state/Workspace';
import './Knowledge.css';

const options = [
  [
    'profileQuestions',
    'Solicitar datos de preparación',
    'Pregunta por carrera, disponibilidad y presupuesto que todavía no se conocen. Si lo desactivas, no inicia ni continúa el cuestionario automáticamente.',
  ],
  [
    'optionalQuestions',
    'Añadir preguntas opcionales',
    'Después de los datos básicos, pregunta una sola vez por cursos difíciles y postulaciones previas.',
  ],
  [
    'recommendAfterProfile',
    'Recomendar al completar el perfil',
    'Selecciona una alternativa según el presupuesto y consulta su información en los documentos disponibles.',
  ],
  [
    'proposalLinks',
    'Preparar enlaces de propuestas',
    'Cuando la persona pide contratar e identifica plan y modalidad, prepara su propuesta. Si lo desactivas, deriva esa solicitud al equipo.',
  ],
  [
    'trialLinks',
    'Preparar enlaces de prueba',
    'Cuando la persona solicita la prueba, genera su enlace si cumple los requisitos. Si lo desactivas, deriva esa solicitud al equipo.',
  ],
  [
    'guardianInvitations',
    'Preparar invitaciones a responsables',
    'Cuando pide incluir a otra persona, solicita los datos faltantes y prepara la invitación. Si lo desactivas, deriva esa solicitud al equipo.',
  ],
] as const;
const labels: Record<ProfileQuestion, string> = {
  career: 'Carrera de interés',
  availability: 'Tiempo disponible',
  budget: 'Presupuesto mensual',
};

export function AgentRules() {
  const [policy, setPolicy] = useState<AgentPolicy | null>(null);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { setUnsavedChanges } = useWorkspace();
  const dirty = !!policy && JSON.stringify(policy) !== saved;
  useEffect(() => {
    let active = true;
    request<AgentPolicy>('/knowledge/policy')
      .then((result) => {
        if (!active) return;
        setPolicy(result);
        setSaved(JSON.stringify(result));
      })
      .catch((failure: Error) => active && setError(failure.message));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setUnsavedChanges(dirty);
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      setUnsavedChanges(false);
      window.removeEventListener('beforeunload', leave);
    };
  }, [dirty, setUnsavedChanges]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!policy || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request<AgentPolicy>('/knowledge/policy', 'PUT', policy);
      setPolicy(result);
      setSaved(JSON.stringify(result));
      setNotice('Reglas guardadas. Se aplican a los próximos mensajes y pasos del agente.');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function reorder(index: number, value: ProfileQuestion) {
    if (!policy) return;
    const order = [...policy.questionOrder];
    const previous = order.indexOf(value);
    [order[index], order[previous]] = [order[previous], order[index]];
    setPolicy({ ...policy, questionOrder: order });
  }
  return (
    <div className="knowledge-page">
      <div className="agent-rules-intro">
        <GitBranch size={23} />
        <div>
          <h2>Qué sabe y cuándo actúa</h2>
          <p>
            Conocimiento contiene la información para responder. Aquí decides cuándo pedir datos o
            preparar enlaces. Guardar una regla no envía mensajes ni modifica conversaciones
            anteriores.
          </p>
        </div>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="hint-box" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {!policy ? (
        <Empty>
          {error
            ? 'No se pudieron cargar las reglas. Vuelve a abrir este apartado para reintentar.'
            : 'Cargando reglas…'}
        </Empty>
      ) : (
        <form className="agent-rules-form" onSubmit={(event) => void save(event)}>
          <div className="knowledge-editor-bar">
            <span>
              Configuración · versión {policy.version}
              {dirty && <em>Sin guardar</em>}
            </span>
            <Button disabled={busy || !dirty}>
              <Save size={15} />
              {busy ? 'Guardando…' : 'Guardar reglas'}
            </Button>
          </div>
          <div className="agent-rules-list">
            {options.map(([key, title, description]) => (
              <label className="agent-rule" key={key}>
                <input
                  type="checkbox"
                  checked={policy[key]}
                  disabled={
                    busy ||
                    (['optionalQuestions', 'recommendAfterProfile'].includes(key) &&
                      !policy.profileQuestions)
                  }
                  onChange={(event) => setPolicy({ ...policy, [key]: event.target.checked })}
                />
                <span>
                  <b>{title}</b>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </div>
          <fieldset className="agent-rule-order" disabled={busy || !policy.profileQuestions}>
            <legend>Orden de las preguntas básicas</legend>
            <p>
              Solo solicita los datos que faltan. Cambiar una posición intercambia las dos
              preguntas.
            </p>
            <div>
              {policy.questionOrder.map((key, index) => (
                <label key={index}>
                  Pregunta {index + 1}
                  <select
                    value={key}
                    onChange={(event) => reorder(index, event.target.value as ProfileQuestion)}
                  >
                    {Object.entries(labels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="agent-rules-boundaries">
            <h3>Comprobaciones del sistema</h3>
            <p>
              Las autorizaciones por canal, identidad, requisitos de la prueba, tarifas de las
              propuestas, confirmación de pago y aceptación de invitaciones se validan en el
              sistema. Estas opciones no sustituyen esas comprobaciones.
            </p>
            <p>
              Los enlaces o preguntas ya enviados conservan su historial. Las nuevas solicitudes
              siguen la configuración guardada.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
