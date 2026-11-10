import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { formatDate } from '../../shared/dates';
import { useWorkspace } from '../../state/Workspace';
export function CaseActions() {
  const { selected, detail, busy, run } = useWorkspace();
  const [message, setMessage] = useState(''),
    [reason, setReason] = useState(''),
    [handoff, setHandoff] = useState(1);
  if (!selected) return null;
  return (
    <Card title="Gestión de la negociación" label="CASO Y ATENCIÓN PERSONAL">
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            `/participations/${selected.id}/withdraw`,
            { messageId: Number(message), reason },
            'Desistimiento registrado según la autoridad del participante.',
          );
        }}
      >
        <label>
          Mensaje de evidencia
          <select required value={message} onChange={(event) => setMessage(event.target.value)}>
            <option value="">Seleccionar</option>
            {detail?.messages
              .filter((item) => item.idDireccion === 1)
              .map((item) => (
                <option key={item.idMensaje} value={item.idMensaje}>
                  #{item.idMensaje} · {item.textoMensaje.slice(0, 35)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Motivo del desistimiento
          <input
            required
            minLength={5}
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <Button variant="secondary" disabled={busy || selected.idEstadoCaso !== 1}>
          Registrar desistimiento expreso
        </Button>
      </form>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            `/participations/${selected.id}/handoff`,
            { reason: handoff, ...(message ? { messageId: Number(message) } : {}) },
            'Conversación derivada a una persona.',
          );
        }}
      >
        <label>
          Derivación
          <select value={handoff} onChange={(event) => setHandoff(Number(event.target.value))}>
            {[
              'Pide una persona',
              'Reclamo',
              'Pedido de reembolso',
              'Disputa',
              'Pago no confirmado',
              'Descuento o beca',
              'No se interpreta la consulta',
            ].map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" disabled={busy}>
          Derivar conversación
        </Button>
        <Button
          variant="secondary"
          type="button"
          disabled={busy || !detail?.handoffs.some((item) => !item.fechaAtencion)}
          onClick={() =>
            run(`/participations/${selected.id}/handoff/attend`, {}, 'Derivación atendida.')
          }
        >
          Marcar atención realizada
        </Button>
      </form>
      {detail?.events.map((item) => (
        <div className="audit-line" key={item.idEvento}>
          <span>{item.type}</span>
          <small>{formatDate(item.fechaEvento)}</small>
        </div>
      ))}
    </Card>
  );
}
