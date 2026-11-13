import { useEffect, useState } from 'react';
import { request } from '../api';
import { Button, Card, Empty } from '../components/ui';
import { RecommendationSettings } from '../features/integrations/RecommendationSettings';
interface Status {
  telegram: { configured: boolean; enabled: boolean };
  openai: { configured: boolean; model: string; available: boolean };
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
      <RecommendationSettings />
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
              El contacto puede iniciar directamente el bot o continuar desde el formulario de
              planes. El agente completa los datos de captación que falten.
            </p>
            <small>La configuración no acredita una entrega real.</small>
          </Card>
          <Card title="OpenAI (ChatGPT)" label="AGENTE · PROVEEDOR PRINCIPAL">
            <span className="integration-status" data-ready={status.openai.available}>
              {status.openai.available
                ? 'Modelo disponible'
                : status.openai.configured
                  ? 'No responde: se usa Ollama'
                  : 'Sin clave: se usa Ollama'}
            </span>
            <dl className="detail-list">
              <div>
                <dt>Modelo configurado</dt>
                <dd>{status.openai.configured ? status.openai.model : 'No configurado'}</dd>
              </div>
            </dl>
            <p>
              Analiza cada mensaje con el mismo esquema JSON y las mismas reglas que Ollama. Si
              falla, el agente pasa automáticamente al modelo local.
            </p>
          </Card>
          <Card title="Ollama" label="AGENTE LOCAL · RESPALDO">
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
            <small>
              Los datos y acciones se validan con reglas. Los casos excepcionales se derivan a una
              persona.
            </small>
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
      <Card title="Fuentes de las recomendaciones" label="INFORMACIÓN Y DECISIONES">
        <p>
          Los precios y beneficios que explica el agente se consultan en los documentos de
          Conocimiento. Las tarifas vigentes se comprueban al preparar propuestas. El historial,
          cuando está activado y tiene datos suficientes, ayuda a ordenar las alternativas según el
          perfil y el presupuesto.
        </p>
        <p>
          Los ejemplos simulados se identifican como tales y se muestran únicamente en la vista
          previa de esta consola.
        </p>
      </Card>
    </div>
  );
}
