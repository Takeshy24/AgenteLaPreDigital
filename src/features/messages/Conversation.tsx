import { useState } from 'react';
import { Button, Card, Empty } from '../../components/ui';
import { formatDate } from '../../shared/dates';
import { useWorkspace } from '../../state/Workspace';
export function Conversation() {
  const { selected, detail, busy, run } = useWorkspace();
  const [text, setText] = useState(''),
    [channel, setChannel] = useState(2),
    [level, setLevel] = useState(1);
  if (!selected || !detail) return null;
  return (
    <Card title="Conversación e interacciones" label="HISTORIAL">
      {detail.messages.map((message) => (
        <div
          className={`live-message conversation-message ${message.idDireccion === 1 ? 'incoming' : 'outgoing'}`}
          key={message.idMensaje}
        >
          <span className="eyebrow">
            #{message.idMensaje} · {message.idDireccion === 1 ? 'ENTRANTE' : 'SALIENTE'} ·{' '}
            {message.canal}
          </span>
          <p>{message.textoMensaje}</p>
          <small>
            {formatDate(message.fechaHora)} ·{' '}
            {message.idDireccion === 2
              ? message.idEstadoEntrega === 2
                ? 'Aceptado por el canal'
                : message.idEstadoEntrega === 3
                  ? 'Entrega fallida'
                  : 'Pendiente de envío'
              : 'Mensaje recibido'}
          </small>
        </div>
      ))}
      {!detail.messages.length && <Empty>Sin mensajes registrados.</Empty>}
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await run(
              `/participations/${selected.id}/messages/incoming`,
              { text, channel, level },
              'Mensaje entrante registrado.',
            )
          )
            setText('');
        }}
      >
        <label>
          Registrar un mensaje realmente recibido
          <textarea
            required
            maxLength={8000}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <div className="profile-edit-grid">
          <label>
            Canal
            <select value={channel} onChange={(event) => setChannel(Number(event.target.value))}>
              <option value={1}>WhatsApp</option>
              <option value={2}>Correo</option>
              <option value={3}>Telegram</option>
            </select>
          </label>
          <label>
            Nivel propuesto por el operador
            <select value={level} onChange={(event) => setLevel(Number(event.target.value))}>
              <option value={1}>Ninguno</option>
              <option value={2}>Consulta (incluye precio)</option>
              <option value={3}>Compra (cómo contratar)</option>
            </select>
          </label>
        </div>
        <Button disabled={busy}>Registrar mensaje</Button>
      </form>
    </Card>
  );
}
