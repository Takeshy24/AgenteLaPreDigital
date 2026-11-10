import { useState } from 'react';
import { Button, Card, Empty } from '../../components/ui';
import { formatDate } from '../../shared/dates';
import { useWorkspace } from '../../state/Workspace';
export function ProfileCard() {
  const { selected, detail, busy, run } = useWorkspace();
  const [fields, setFields] = useState({
    university: selected?.university || '',
    career: selected?.career || '',
    availability: selected?.availability || '',
    budget: selected?.budget == null ? '' : String(selected.budget),
  });
  const [channel, setChannel] = useState('');
  if (!selected) return null;
  return (
    <>
      <Card title="Contexto académico y económico" label="L-2 · PERFIL">
        <p>
          Guarda únicamente datos expresamente comunicados. Los campos desconocidos permanecen sin
          completar.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const values: Record<string, string | number> = {};
            for (const [key, value] of Object.entries(fields))
              if (value.trim()) values[key] = key === 'budget' ? Number(value) : value;
            run(
              `/participations/${selected.id}/profile`,
              { fields: values, channel: Number(channel) },
              'Perfil guardado con historial.',
              'PATCH',
            );
          }}
        >
          <div className="profile-edit-grid">
            {Object.entries(fields).map(([key, value]) => (
              <label key={key}>
                {
                  (
                    {
                      university: 'Universidad',
                      career: 'Carrera',
                      availability: 'Disponibilidad',
                      budget: 'Presupuesto mensual (S/)',
                    } as Record<string, string>
                  )[key]
                }
                <input
                  value={value}
                  type={key === 'budget' ? 'number' : 'text'}
                  min={0}
                  step={key === 'budget' ? '.01' : undefined}
                  placeholder="Pendiente"
                  onChange={(event) => setFields({ ...fields, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <label className="live-label">
            Canal en el que se comunicaron los datos
            <select required value={channel} onChange={(event) => setChannel(event.target.value)}>
              <option value="">Seleccionar canal de procedencia</option>
              <option value="1">WhatsApp</option>
              <option value="2">Correo</option>
              <option value="3">Telegram</option>
            </select>
          </label>
          <Button disabled={busy || !channel}>Guardar perfil</Button>
        </form>
      </Card>
      <Card title="Cambios del perfil" label="TRAZABILIDAD">
        {!detail?.changes.length && <Empty>Sin cambios de perfil registrados.</Empty>}
        {detail?.changes.map((change) => (
          <div className="audit-line" key={change.idCambio}>
            <span>
              {change.campo}: {change.datoPrevio ?? 'Pendiente'} → <b>{change.datoNuevo}</b>
            </span>
            <small>{formatDate(change.fechaRespuesta)}</small>
          </div>
        ))}
      </Card>
    </>
  );
}
