import { useState } from 'react';
import { request } from '../../api';
import { useWorkspace } from '../../state/Workspace';
import { Card, Button } from '../../components/ui';
interface Analysis {
  level: number;
  action: string;
  tariffId: number | null;
  fields: { field: string; value: string; quote: string }[];
}
export function AgentCard() {
  const { selected, detail, run, busy, setError } = useWorkspace();
  const [messageId, setMessageId] = useState(''),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [loading, setLoading] = useState(false);
  if (!selected) return null;
  const message = detail?.messages.find((item) => item.idMensaje === Number(messageId));
  return (
    <Card title="Revisar con Ollama" label="AGENTE LOCAL" mode="manual">
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!message) return;
          setLoading(true);
          setAnalysis(null);
          try {
            setAnalysis(
              await request<Analysis>(`/participations/${selected.id}/agent/analyze`, 'POST', {
                text: message.textoMensaje,
              }),
            );
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <label>
          Mensaje recibido
          <select
            required
            value={messageId}
            onChange={(event) => {
              setMessageId(event.target.value);
              setAnalysis(null);
            }}
          >
            <option value="">Seleccionar</option>
            {detail?.messages
              .filter((item) => item.idDireccion === 1)
              .map((item) => (
                <option key={item.idMensaje} value={item.idMensaje}>
                  #{item.idMensaje} · {item.textoMensaje.slice(0, 40)}
                </option>
              ))}
          </select>
        </label>
        <Button disabled={busy || loading || !message}>
          {loading ? 'Analizando con el modelo local…' : 'Analizar mensaje'}
        </Button>
      </form>
      {analysis && (
        <>
          <p>Interés propuesto: {['', 'Ninguno', 'Consulta', 'Compra'][analysis.level]}</p>
          <p>
            Acción sugerida:{' '}
            {
              (
                {
                  ask: 'ampliar contexto',
                  catalog: 'consultar catálogo',
                  proposal: 'preparar propuesta',
                  trial: 'ofrecer prueba',
                  handoff: 'revisar necesidad de atención personal',
                } as Record<string, string>
              )[analysis.action]
            }
          </p>
          {analysis.fields.map((item, index) => (
            <div className="live-message" key={index}>
              <b>
                {item.field}: {item.value}
              </b>
              <p>Declaración: “{item.quote}”</p>
            </div>
          ))}
          <Button
            variant="secondary"
            disabled={busy || !analysis.fields.length}
            onClick={() =>
              run(
                `/participations/${selected.id}/profile`,
                {
                  fields: Object.fromEntries(
                    analysis.fields.map((item) => [
                      item.field,
                      item.field === 'budget' ? Number(item.value) : item.value,
                    ]),
                  ),
                  channel:
                    message?.canal === 'Telegram' ? 3 : message?.canal === 'WhatsApp' ? 1 : 2,
                },
                'Datos revisados y guardados por el operador.',
                'PATCH',
              )
            }
          >
            Guardar datos tras revisión
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(
                `/participations/${selected.id}/evaluations`,
                { level: analysis.level, messageId: Number(messageId) },
                'Evaluación registrada con revisión del operador.',
              )
            }
          >
            Confirmar nivel y evaluar prioridad
          </Button>
        </>
      )}
    </Card>
  );
}
