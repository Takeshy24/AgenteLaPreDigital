import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
export function GuardianCard() {
  const { selected, detail, busy, run } = useWorkspace();
  const [name, setName] = useState(''),
    [role, setRole] = useState(3),
    [message, setMessage] = useState(''),
    [code, setCode] = useState(''),
    [email, setEmail] = useState(''),
    [phone, setPhone] = useState(''),
    [contactConsent, setContactConsent] = useState(false),
    [linkConsent, setLinkConsent] = useState(false);
  if (!selected) return null;
  return (
    <Card title="Responsable económico" label="L-3 · VINCULACIÓN" mode="agent">
      <p>
        La vinculación requiere aceptación del responsable, autorización para este caso y
        autorización de contacto. Esta consola registra la aceptación; el portal remoto aún no está
        integrado.
      </p>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            `/participations/${selected.id}/invitations`,
            { name, role, messageId: Number(message) },
            'Invitación registrada. Aceptación pendiente.',
          );
        }}
      >
        <label>
          Nombre del responsable
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Relación
          <select value={role} onChange={(event) => setRole(Number(event.target.value))}>
            <option value={1}>Estudiante</option>
            <option value={2}>Padre</option>
            <option value={3}>Madre</option>
            <option value={4}>Apoderado</option>
          </select>
        </label>
        <label>
          Mensaje que declara la necesidad
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
        <Button variant="secondary" disabled={busy}>
          Preparar invitación
        </Button>
      </form>
      {detail?.invitations.map((invitation) => (
        <div className="live-message" key={invitation.idInvitacion}>
          <b>{invitation.nombreInvitado}</b>
          <p>{invitation.fechaVinculacion ? 'Vinculado' : 'Pendiente'}</p>
          {!invitation.fechaVinculacion && (
            <Button
              variant="secondary"
              onClick={() => {
                setCode(invitation.codigoEnlace);
                setName(invitation.nombreInvitado);
              }}
            >
              Registrar aceptación documentada
            </Button>
          )}
        </div>
      ))}
      {code && (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              '/invitations/accept',
              { code, name, email, phone, channel: 2, contactConsent, linkConsent },
              'Responsable vinculado con ambas autorizaciones.',
            );
          }}
        >
          <label>
            Correo del responsable
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Teléfono internacional
            <input required value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="authorization-toggle">
            <input
              required
              type="checkbox"
              checked={linkConsent}
              onChange={(event) => setLinkConsent(event.target.checked)}
            />
            El responsable aceptó vincularse a este caso.
          </label>
          <label className="authorization-toggle">
            <input
              required
              type="checkbox"
              checked={contactConsent}
              onChange={(event) => setContactConsent(event.target.checked)}
            />
            El responsable autorizó contacto por correo.
          </label>
          <Button disabled={busy}>Confirmar aceptación documentada</Button>
        </form>
      )}
    </Card>
  );
}
