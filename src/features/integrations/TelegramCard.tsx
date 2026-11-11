import { useState } from 'react';
import { request } from '../../api';
import { Button, Card } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
export function TelegramCard() {
  const { selected, busy, setError } = useWorkspace();
  const [url, setUrl] = useState(''),
    [loading, setLoading] = useState(false);
  if (!selected) return null;
  return (
    <Card title="Vincular Telegram" label="VINCULACIÓN DE CANAL" mode="manual">
      <p>
        El contacto abre un enlace de un solo uso e inicia el bot. Después puede autorizar
        seguimiento con /autorizar y revocarlo con /revocar.
      </p>
      <Button
        variant="secondary"
        disabled={busy || loading}
        onClick={async () => {
          setLoading(true);
          try {
            const link = await request<{ url: string }>(
              `/participations/${selected.id}/telegram-link`,
              'POST',
              {},
            );
            setUrl(link.url);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        Crear enlace para el contacto
      </Button>
      {url && (
        <label className="live-label">
          Enlace válido durante 10 minutos
          <input readOnly value={url} onFocus={(event) => event.target.select()} />
        </label>
      )}
    </Card>
  );
}
