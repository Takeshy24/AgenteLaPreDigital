import { useState } from 'react';
import { Badge, Button, Card } from '../../components/ui';
import { formatDate } from '../../shared/dates';
import { useWorkspace } from '../../state/Workspace';
export function PriorityCard() {
  const { selected, detail, busy, run } = useWorkspace();
  const [level, setLevel] = useState(1),
    [messageId, setMessageId] = useState('');
  if (!selected) return null;
  return (
    <Card title="Evaluar con evidencia" label="L-5 · PRIORIDAD">
      <Badge value={selected.priority} />
      <p>
        {selected.status} · Interés {selected.interest}
      </p>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            `/participations/${selected.id}/evaluations`,
            { level, ...(messageId ? { messageId: Number(messageId) } : {}) },
            'Evaluación registrada.',
          );
        }}
      >
        <label>
          Nivel
          <select value={level} onChange={(event) => setLevel(Number(event.target.value))}>
            <option value={1}>Ninguno</option>
            <option value={2}>Consulta</option>
            <option value={3}>Compra</option>
          </select>
        </label>
        <label>
          Mensaje de evidencia
          <select value={messageId} onChange={(event) => setMessageId(event.target.value)}>
            <option value="">Sin mensaje (solo Ninguno)</option>
            {detail?.messages
              .filter((message) => message.idDireccion === 1)
              .map((message) => (
                <option key={message.idMensaje} value={message.idMensaje}>
                  #{message.idMensaje} · {message.textoMensaje.slice(0, 40)}
                </option>
              ))}
          </select>
        </label>
        <Button disabled={busy || (level !== 1 && !messageId)}>Evaluar prioridad</Button>
      </form>
      {detail?.evaluations.map((evaluation) => (
        <p key={evaluation.idEvaluacion}>
          {evaluation.prioridad} · {evaluation.intentosSinRespuesta} intentos ·{' '}
          {formatDate(evaluation.fechaEvaluacion)}
        </p>
      ))}
    </Card>
  );
}
