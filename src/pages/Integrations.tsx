import { useEffect, useState } from 'react';
import { request } from '../api';
import { Button, Card, Empty } from '../components/ui';
interface Status {
  telegram: { configured: boolean; enabled: boolean };
  ollama: { configured: boolean; model: string; available: boolean };
  followup: { enabled: boolean };
}
export function Integrations() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setStatus(await request<Status>('/integrations/status'));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <div className="integrations-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ENTORNO LOCAL</span>
          <h2>Canales y agente</h2>
        </div>
        <Button variant="secondary" disabled={loading} onClick={refresh}>
          {loading ? 'Consultando…' : 'Actualizar estado'}
        </Button>
      </div>
      {error && (
        <div className="live-alert" role="alert">
          {error}
        </div>
      )}
      {loading && !status && <Empty>Consultando la configuración…</Empty>}
      {status && (
        <div className="integration-grid">
          <Card title="Telegram" label="CANAL DE COMUNICACIÓN">
            <span
              className="integration-status"
              data-ready={status.telegram.configured && status.telegram.enabled}
            >
              {status.telegram.configured && status.telegram.enabled
                ? 'Configurado y habilitado'
                : 'Configuración pendiente o desactivado'}
            </span>
            <dl className="detail-list">
              <div>
                <dt>Credenciales</dt>
                <dd>{status.telegram.configured ? 'Configuradas' : 'Sin configurar'}</dd>
              </div>
              <div>
                <dt>Recepción</dt>
                <dd>{status.telegram.enabled ? 'Habilitada' : 'Desactivada'}</dd>
              </div>
            </dl>
            <p>
              El contacto debe iniciar la conversación con el bot. La vinculación se prepara desde
              su expediente.
            </p>
            <small>La configuración no acredita una entrega real.</small>
          </Card>
          <Card title="Ollama" label="AGENTE LOCAL · L-2 / L-4 / L-5">
            <span className="integration-status" data-ready={status.ollama.available}>
              {status.ollama.available ? 'Modelo disponible' : 'Modelo no disponible'}
            </span>
            <dl className="detail-list">
              <div>
                <dt>Modelo configurado</dt>
                <dd>{status.ollama.model || 'No configurado'}</dd>
              </div>
            </dl>
            <p>
              Propone datos expresos e interés comercial. El sistema calcula la prioridad y controla
              tarifas y transiciones.
            </p>
            <small>Las salidas requieren revisión; no confirman pagos.</small>
          </Card>
          <Card title="Seguimiento" label="PROCESO PROGRAMADO · L-1">
            <span className="integration-status" data-ready={status.followup.enabled}>
              {status.followup.enabled ? 'Habilitado' : 'Desactivado'}
            </span>
            <p>
              Ejecuta la agenda según las autorizaciones y las reglas de suspensión. Los intentos
              omitidos no se reprograman.
            </p>
            <small>La revisión manual de vencimientos está en Seguimiento.</small>
          </Card>
        </div>
      )}
      <Card title="Alcance de esta consola" label="IMPLEMENTACIÓN ACTUAL">
        <p>
          WhatsApp y correo admiten constancias manuales; no tienen envío integrado. Los pagos se
          documentan desde una confirmación externa. La plataforma educativa y el DataMart todavía
          no están conectados.
        </p>
        <p>
          Las funciones descritas por el informe son requisitos del proyecto; no acreditan que todas
          las integraciones estén operativas.
        </p>
      </Card>
    </div>
  );
}
