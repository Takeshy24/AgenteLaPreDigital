import { useEffect, useState } from 'react';
import { request } from '../../api';
import { Button, Card, Empty } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
const STEPS = ['Preparada', 'Entregada', 'Aceptada', 'Pagada', 'Validada'];
function ProposalProgress({
  delivered,
  failed,
  result,
  paid,
  validated,
}: {
  delivered: boolean;
  failed: boolean;
  result: number | null;
  paid: boolean;
  validated: boolean;
}) {
  const reached = validated ? 5 : paid ? 4 : result === 1 ? 3 : delivered ? 2 : 1;
  const closed = result === 2 || result === 3;
  const next = failed
    ? 'La entrega por el canal falló. Reintenta el envío o documenta una entrega externa.'
    : closed
      ? result === 2
        ? 'El lead rechazó la propuesta.'
        : 'Venció el plazo sin respuesta.'
      : validated
        ? 'Contratación validada.'
        : paid
          ? 'Pago confirmado. Falta validar la contratación en Gestión comercial.'
          : result === 1
            ? 'Aceptada. Falta el pago: el lead paga desde el enlace de la propuesta o se registra en Gestión comercial.'
            : delivered
              ? 'Esperando que el lead abra el enlace de la propuesta y la acepte. Aún no ha aceptado.'
              : 'Esperando la confirmación de entrega por el canal.';
  return (
    <div className="proposal-progress">
      <ol aria-label="Avance de la propuesta">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={index < reached ? (index === reached - 1 ? 'current' : 'done') : undefined}
            aria-current={index === reached - 1 ? 'step' : undefined}
          >
            {step}
          </li>
        ))}
      </ol>
      <p className={closed || failed ? 'stopped' : undefined}>{next}</p>
    </div>
  );
}
export function ProposalCard() {
  const { selected, data, detail, busy, run, setError } = useWorkspace();
  const [tariff, setTariff] = useState(''),
    [replyTo, setReplyTo] = useState(''),
    [justification, setJustification] = useState(''),
    [receipt, setReceipt] = useState(''),
    [offerLink, setOfferLink] = useState<{ proposal: number; url: string } | null>(null);
  const incomingMessages = detail?.messages.filter((message) => message.idDireccion === 1) ?? [];
  const lastIncoming = incomingMessages.at(-1);
  const lastProposal = detail?.proposals[0];
  const suggestedTariff = (() => {
    const tariffs = data?.tariffs ?? [];
    const same = lastProposal
      ? tariffs.find(
          (item) =>
            item.plan === lastProposal.plan &&
            Number(item.precio) === Number(lastProposal.precioAutorizado),
        )
      : undefined;
    if (same) return same.idPlanTarifa;
    const budget = selected?.budget;
    if (budget == null) return null;
    return (
      tariffs
        .filter((item) => item.modalidad === 'Mensual' && Number(item.precio) <= Number(budget))
        .sort((a, b) => Number(a.precio) - Number(b.precio))
        .at(-1)?.idPlanTarifa ?? null
    );
  })();
  const knownData = [
    selected?.career && `Carrera: ${selected.career}`,
    selected?.availability && `Disponibilidad: ${selected.availability}`,
    selected?.budget != null && `Presupuesto: hasta S/ ${selected.budget} al mes`,
  ].filter(Boolean) as string[];
  const suggestedJustification = knownData.length ? `${knownData.join('. ')}.` : '';
  useEffect(() => {
    setTariff('');
    setReplyTo('');
    setJustification('');
  }, [selected?.id]);
  useEffect(() => {
    if (!tariff && suggestedTariff) setTariff(String(suggestedTariff));
  }, [tariff, suggestedTariff]);
  useEffect(() => {
    if (!replyTo && lastIncoming) setReplyTo(String(lastIncoming.idMensaje));
  }, [replyTo, lastIncoming?.idMensaje]);
  useEffect(() => {
    if (!justification && suggestedJustification) setJustification(suggestedJustification);
  }, [justification, suggestedJustification]);
  if (!selected) return null;
  return (
    <Card title="Propuesta comercial" label="L-4 · CATÁLOGO AUTORIZADO" mode="agent">
      <p>
        Preparar, entregar y aceptar son pasos distintos. La entrega debe estar confirmada por el
        canal y la respuesta debe ser expresa y posterior a esa entrega.
      </p>
      <dl className="known-data" aria-label="Datos que el agente ya obtuvo">
        <div>
          <dt>Carrera</dt>
          <dd className={selected.career ? undefined : 'pending'}>
            {selected.career ?? 'Pendiente'}
          </dd>
        </div>
        <div>
          <dt>Disponibilidad</dt>
          <dd className={selected.availability ? undefined : 'pending'}>
            {selected.availability ?? 'Pendiente'}
          </dd>
        </div>
        <div>
          <dt>Presupuesto mensual</dt>
          <dd className={selected.budget == null ? 'pending' : undefined}>
            {selected.budget == null ? 'Pendiente' : `S/ ${selected.budget}`}
          </dd>
        </div>
        <div>
          <dt>Último mensaje del lead</dt>
          <dd className={lastIncoming ? undefined : 'pending'}>
            {lastIncoming ? lastIncoming.textoMensaje.slice(0, 60) : 'Sin mensajes'}
          </dd>
        </div>
      </dl>
      {!detail?.proposals.length && <Empty>Sin propuestas registradas para este caso.</Empty>}
      {detail?.proposals.map((proposal) => (
        <article className="live-message proposal-item" key={proposal.idPropuesta}>
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
          <ProposalProgress
            delivered={proposal.idEstadoEntrega === 2}
            failed={proposal.idEstadoEntrega === 3}
            result={proposal.idResultado}
            paid={!!detail?.contracts[0]?.idEventoPago}
            validated={!!detail?.contracts[0]?.idEventoValidacion}
          />
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
            <details className="manual-block">
              <summary>El lead aceptó o rechazó por otro medio</summary>
              <p>
                Normalmente el lead acepta solo desde el enlace de la propuesta y aquí se actualiza.
                Usa esto únicamente si respondió por otra vía y el mensaje seleccionado lo prueba.
              </p>
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
            </details>
          )}
        </article>
      ))}
      <details className="manual-block">
        <summary>Preparar otra propuesta manualmente</summary>
        <p>Se precargó con lo que el agente ya sabe del lead. Revisa y ajusta antes de preparar.</p>
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
                channel:
                  incoming?.canal === 'Telegram' ? 3 : incoming?.canal === 'WhatsApp' ? 1 : 2,
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
      </details>
    </Card>
  );
}
