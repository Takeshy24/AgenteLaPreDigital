import { useState } from 'react';
import { Button, Modal } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
import type { PublicInquiry } from '../../api';
export function LeadForm({ onClose, inquiry }: { onClose: () => void; inquiry?: PublicInquiry }) {
  const { data, busy, run, error } = useWorkspace();
  const [form, setForm] = useState({
    name: inquiry?.name || '',
    email: inquiry?.email || '',
    phone: inquiry?.phone || '',
    role: inquiry?.role || (inquiry?.name !== inquiry?.beneficiary ? 2 : 1),
    channel: inquiry && inquiry.id < 0 ? 5 : 1,
    communicationChannel: 2,
    consent: inquiry?.consent || false,
    beneficiaryName: inquiry?.beneficiary || '',
    beneficiaryId: '',
  });
  return (
    <Modal title="Registrar contacto y negociación" onClose={onClose}>
      <p className="form-intro">
        {inquiry?.status === 'Revisar identidad' &&
          'Confirma la identidad con la persona antes de guardar la vinculación. '}
        Registra los datos declarados por el contacto. Si el beneficiario ya existe, utiliza su
        identificador para evitar duplicados.
      </p>
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await run(
              inquiry
                ? inquiry.id < 0
                  ? `/onboarding/${-inquiry.id}/complete`
                  : `/public-inquiries/${inquiry.id}/complete`
                : '/leads',
              inquiry
                ? {
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    role: form.role,
                    beneficiary: form.role === 1 ? form.name : form.beneficiaryName,
                    beneficiaryId: form.beneficiaryId ? Number(form.beneficiaryId) : undefined,
                    isStudent: form.role === 1,
                    consent: form.consent,
                    plan: inquiry.plan,
                  }
                : {
                    ...form,
                    beneficiaryId: form.beneficiaryId ? Number(form.beneficiaryId) : undefined,
                  },
              'LEAD registrado.',
            )
          )
            onClose();
        }}
      >
        {error && (
          <p role="alert" className="live-alert">
            {error}
          </p>
        )}
        <label>
          Nombre del contacto
          <input
            required
            minLength={2}
            maxLength={150}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          Correo
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </label>
        <label>
          Teléfono internacional
          <input
            required
            type="tel"
            pattern="\+[0-9 ]{7,19}"
            placeholder="+519XXXXXXXX"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </label>
        <div className="profile-edit-grid">
          <label>
            Rol
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: Number(event.target.value) })}
            >
              {data?.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Captación
            <select
              disabled={!!inquiry}
              value={form.channel}
              onChange={(event) => setForm({ ...form, channel: Number(event.target.value) })}
            >
              {data?.channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          ID de beneficiario existente (si corresponde)
          <input
            type="number"
            min={1}
            value={form.beneficiaryId}
            onChange={(event) => setForm({ ...form, beneficiaryId: event.target.value })}
          />
        </label>
        {form.role !== 1 && !form.beneficiaryId && (
          <label>
            Nombre completo del beneficiario
            <input
              required
              value={form.beneficiaryName}
              onChange={(event) => setForm({ ...form, beneficiaryName: event.target.value })}
            />
          </label>
        )}
        <label>
          Canal autorizado
          <select
            disabled={!!inquiry}
            value={form.communicationChannel}
            onChange={(event) =>
              setForm({ ...form, communicationChannel: Number(event.target.value) })
            }
          >
            <option value={2}>Correo</option>
            <option value={1}>WhatsApp</option>
          </select>
        </label>
        <label className="authorization-toggle">
          <input
            required
            type="checkbox"
            checked={form.consent}
            onChange={(event) => setForm({ ...form, consent: event.target.checked })}
          />
          El contacto autorizó expresamente este canal
        </label>
        <small className="muted">
          La captación válida requiere autorización de contacto por al menos un canal. Las
          revocaciones posteriores se registran en el expediente.
        </small>
        <Button disabled={busy || !data}>
          {busy ? 'Guardando…' : 'Guardar contacto y participación'}
        </Button>
      </form>
    </Modal>
  );
}
