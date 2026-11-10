import { useState } from 'react';
import { request } from '../../api';
import { Button, Card } from '../../components/ui';
import { formatDate } from '../../shared/dates';
import { useWorkspace } from '../../state/Workspace';
export function TrialCard() {
  const { selected, detail, busy, run, setError } = useWorkspace();
  const [token, setToken] = useState(''),
    [loading, setLoading] = useState(false);
  if (!selected) return null;
  return (
    <Card title="Explora UNT" label="PRUEBA GRATUITA">
      {detail?.trials.map((trial) => (
        <p key={trial.idPrueba}>
          {trial.idEstadoPrueba === 1 ? 'Activa' : 'Finalizada'} · hasta{' '}
          {formatDate(trial.fechaFin)}
        </p>
      ))}
      <p>14 días, una sola vez por beneficiario. La activación no cambia la etapa comercial.</p>
      <Button
        variant="secondary"
        disabled={busy || loading || !!detail?.trials.length}
        onClick={async () => {
          setLoading(true);
          try {
            const result = await request<{ token: string }>(
              `/participations/${selected.id}/trial-link`,
              'POST',
              {},
            );
            setToken(result.token);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        Preparar activación
      </Button>
      {token && (
        <Button
          disabled={busy}
          onClick={() => run('/trials/activate', { token }, 'Activación de prueba registrada.')}
        >
          Registrar activación solicitada
        </Button>
      )}
    </Card>
  );
}
