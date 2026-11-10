import { useState } from 'react';
import { request } from '../../api';
import { Button, Card, Empty } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
export function ProposalCard() {
  const { selected, data, detail, busy, run, setError } = useWorkspace();
  const [tariff, setTariff] = useState(''),
    [replyTo, setReplyTo] = useState(''),
    [justification, setJustification] = useState(''),
    [receipt, setReceipt] = useState(''),
    [offerLink, setOfferLink] = useState<{ proposal: number; url: string } | null>(null);
  if (!selected) return null;
  return (
    <Card title="Propuesta comercial" label="L-4 · CATÁLOGO AUTORIZADO">
      <p>
        Preparar, entregar y aceptar son pasos distintos. La entrega debe estar confirmada por el
        canal y la respuesta debe ser expresa y posterior a esa entrega.
      </p>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          const incoming = detail?.messages.find(
            (message) => message.idMensaje === Number(replyTo),
          );
          run(
            `/participations/${selected.id}/proposals`,
            {
              tariff: Number(tariff),
              replyTo: Number(replyTo),
              channel: incoming?.canal === 'Telegram' ? 3 : incoming?.canal === 'WhatsApp' ? 1 : 2,
              justification,
            },
            'Propuesta preparada. Entrega y pago aún no confirmados.',
          );
        }}
      >
        <label>
          Tarifa vigente
          <select required value={tariff} onChange={(event) => setTariff(event.target.value)}>
            <option value="">Seleccionar</option>
            {data?.tariffs.map((item) => (
              <option key={item.idPlanTarifa} value={item.idPlanTarifa}>
                {item.plan} · {item.modalidad} · S/ {item.precio}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mensaje entrante de contexto o evidencia de respuesta
          <select required value={replyTo} onChange={(event) => setReplyTo(event.target.value)}>
            <option value="">Seleccionar mensaje recibido</option>
            {detail?.messages
              .filter((message) => message.idDireccion === 1)
              .map((message) => (
                <option key={message.idMensaje} value={message.idMensaje}>
                  #{message.idMensaje} · {message.textoMensaje.slice(0, 40)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Justificación con datos conocidos
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
        </label>
        <Button disabled={busy}>Preparar propuesta</Button>
      </form>
      <label className="live-label">
        Referencia de entrega externa (correo o WhatsApp)
        <input
          value={receipt}
          onChange={(event) => setReceipt(event.target.value)}
          placeholder="Únicamente si la entrega ya se confirmó externamente"
        />
      </label>
      {!detail?.proposals.length && <Empty>Sin propuestas registradas para este caso.</Empty>}
      {detail?.proposals.map((proposal) => (
        <article className="live-message" key={proposal.idPropuesta}>
          <b>
            #{proposal.idPropuesta} · {proposal.plan}
          </b>
          <p>
            S/ {proposal.precioAutorizado} ·{' '}
            {proposal.idEstadoEntrega === 2
              ? 'Entregada al canal'
              : proposal.idEstadoEntrega === 3
                ? 'Entrega fallida'
                : 'Envío pendiente'}
          </p>
          <small>
            {proposal.idResultado === 1
              ? 'Aceptada · consultar pago y validación en Gestión comercial'
              : proposal.idResultado === 2
                ? 'Rechazada'
                : proposal.idResultado === 3
                  ? 'Sin respuesta (plazo vencido)'
                  : 'Resultado pendiente'}
          </small>
          {proposal.idEstadoEntrega === 2 && proposal.idResultado !== 2 && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                try {
                  const result = await request<{ url: string }>(
                    `/proposals/${proposal.idPropuesta}/public-link`,
                    'POST',
                    {},
                  );
                  setOfferLink({ proposal: proposal.idPropuesta, url: result.url });
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              Crear enlace personal para el lead
            </Button>
          )}
          {offerLink?.proposal === proposal.idPropuesta && (
            <label className="live-label">
              Enlace personal (vence en 7 días)
              <input readOnly value={offerLink.url} onFocus={(event) => event.target.select()} />
            </label>
          )}
          {proposal.idEstadoEntrega !== 2 && (
            <Button
              variant="secondary"
              disabled={busy || receipt.length < 5}
              onClick={() =>
                run(
                  `/messages/${proposal.idMensajeEntrega}/external-delivery`,
                  { reference: receipt, confirmedExternally: true },
                  'Entrega externa documentada.',
                )
              }
            >
              Registrar entrega externa confirmada
            </Button>
          )}
          {proposal.idEstadoEntrega === 2 && !proposal.idResultado && (
            <div className="form">
              <Button
                disabled={busy || !replyTo}
                onClick={() =>
                  run(
                    `/proposals/${proposal.idPropuesta}/response`,
                    { messageId: Number(replyTo), result: 1 },
                    'Aceptación expresa registrada; pago aún no confirmado.',
                  )
                }
              >
                Registrar aceptación con mensaje seleccionado
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !replyTo}
                onClick={() =>
                  run(
                    `/proposals/${proposal.idPropuesta}/response`,
                    { messageId: Number(replyTo), result: 2 },
                    'Rechazo expreso registrado.',
                  )
                }
              >
                Registrar rechazo con mensaje seleccionado
              </Button>
            </div>
          )}
        </article>
      ))}
    </Card>
  );
}
