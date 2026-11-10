import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
export function ConsentCard() {
  const { selected, busy, run } = useWorkspace();
  const [channel, setChannel] = useState(2);
  if (!selected) return null;
  const save = (granted: boolean) =>
    run(
      `/participations/${selected.id}/consent`,
      { channel, granted, version: 'gestion-local-v1' },
      granted ? 'Autorización registrada.' : 'Autorización revocada.',
    );
  return (
    <Card title="Permisos de contacto" label="AUTORIZACIÓN">
      <p>{selected.authorized ? 'Existe algún canal vigente.' : 'Sin autorización vigente.'}</p>
      <label className="live-label">
        Canal
        <select value={channel} onChange={(event) => setChannel(Number(event.target.value))}>
          <option value={1}>WhatsApp</option>
          <option value={2}>Correo</option>
          <option value={3}>Telegram</option>
        </select>
      </label>
      <small>Registrar únicamente decisiones expresas del contacto.</small>
      <Button variant="secondary" disabled={busy} onClick={() => save(true)}>
        Registrar autorización
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => save(false)}>
        Registrar revocación
      </Button>
    </Card>
  );
}
