import { useState } from 'react';
import { request } from '../../api';
import { Button, Card } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
export function ContractCard() {
  const { selected, detail, busy, run, setError } = useWorkspace();
  const [proposal, setProposal] = useState(''),
    [reference, setReference] = useState(''),
    [amount, setAmount] = useState(''),
    [attested, setAttested] = useState(false),
    [incident, setIncident] = useState('dispute'),
    [plan, setPlan] = useState(2),
    [endDate, setEndDate] = useState('');
  if (!selected) return null;
  const contract = detail?.contracts[0];
  const path = `/cases/${selected.idCaso}`;
  const validReference = reference.trim().length >= 5;
  async function openCheckout() {
    try {
      const result = await request<{ url: string }>(path + '/stripe-checkout', 'POST', {});
      window.location.assign(result.url);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  return (
    <Card title="Formalización y resultados" label="CONTRATACIÓN" mode="manual">
      <p className="contract-status">
        {contract?.idEventoValidacion
          ? 'Contratación validada'
          : contract?.idEventoPago
            ? 'Pago externo registrado · pendiente de validación'
            : contract
              ? 'Condiciones registradas · falta pago confirmado'
              : 'Sin contratación registrada'}
      </p>
      <p>
        La aceptación de una propuesta no confirma el pago. Puedes usar Stripe Checkout en modo de
        prueba; el importe sale de la propuesta aceptada y se confirma consultando Stripe al volver.
      </p>
      <div className="form">
        <label>
          Referencia o evidencia documental
          <input
            maxLength={250}
            minLength={5}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Referencia verificable de la operación"
          />
        </label>
        <label>
          Propuesta aceptada
          <select value={proposal} onChange={(event) => setProposal(event.target.value)}>
            <option value="">Seleccionar</option>
            {detail?.proposals
              .filter((item) => item.idResultado === 1)
              .map((item) => (
                <option value={item.idPropuesta} key={item.idPropuesta}>
                  #{item.idPropuesta} · {item.plan}
                </option>
              ))}
          </select>
        </label>
        <Button disabled={busy || !contract || !!contract.idEventoPago} onClick={openCheckout}>
          Pagar con Stripe de prueba
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !validReference || !proposal || !!contract}
          onClick={() =>
            run(
              path + '/terms',
              { proposalId: Number(proposal), reference },
              'Aceptación de condiciones registrada.',
            )
          }
        >
          Registrar condiciones aceptadas
        </Button>
        <label>
          Importe confirmado externamente (S/)
          <input
            type="number"
            min="0.01"
            step=".01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="authorization-toggle">
          <input
            type="checkbox"
            checked={attested}
            onChange={(event) => setAttested(event.target.checked)}
          />
          Verifiqué el pago en el sistema externo. Esto es un registro manual, no una consulta a la
          pasarela.
        </label>
        <Button
          variant="secondary"
          disabled={
            busy ||
            !validReference ||
            !attested ||
            !contract ||
            !!contract.idEventoPago ||
            !(Number(amount) > 0)
          }
          onClick={() =>
            run(
              path + '/payment-confirmation',
              { reference, amount: Number(amount), confirmedExternally: true },
              'Confirmación externa de pago registrada.',
            )
          }
        >
          Registrar pago ya confirmado
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !contract || !!contract.idEventoPago}
          onClick={() =>
            run(path + '/demo-payment', {}, 'Pago simulado registrado (solo para demostración).')
          }
        >
          Simular pago (demo)
        </Button>
        <Button
          disabled={busy || !contract?.idEventoPago || !!contract.idEventoValidacion}
          onClick={() => run(path + '/validate', {}, 'Contratación validada y caso cerrado.')}
        >
          Validar contratación
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !contract?.idEventoValidacion || !!contract.fechaHabilitacion}
          onClick={() => run(path + '/activate', {}, 'Habilitación del servicio registrada.')}
        >
          Registrar habilitación del servicio
        </Button>
        <label>
          Incidencia
          <select value={incident} onChange={(event) => setIncident(event.target.value)}>
            <option value="dispute">Disputa</option>
            <option value="resolution">Resolución de disputa</option>
            <option value="refund">Reembolso total invalidante</option>
            <option value="partial-refund">Reembolso parcial o posterior</option>
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={busy || !contract?.idEventoPago || !validReference}
          onClick={() =>
            run(
              path + '/incident',
              { type: incident, reference },
              'Incidencia comercial registrada.',
            )
          }
        >
          Registrar incidencia verificada
        </Button>
      </div>
      <details>
        <summary>Beca completa autorizada</summary>
        <div className="form">
          <label>
            Plan
            <select value={plan} onChange={(event) => setPlan(Number(event.target.value))}>
              <option value={1}>Ruta UNT</option>
              <option value={2}>Meta UNT</option>
              <option value={3}>Meta UNT Plus</option>
            </select>
          </label>
          <label>
            Fin de vigencia
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={busy || !validReference || !endDate || !!contract}
            onClick={() =>
              run(
                path + '/scholarship',
                { plan, endDate, reference },
                'Beca completa autorizada. Agenda pausada hasta habilitación.',
              )
            }
          >
            Registrar autorización de beca
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !!contract}
            onClick={() =>
              run(path + '/scholarship/activate', {}, 'Beca habilitada, sin pago ficticio.')
            }
          >
            Registrar habilitación de beca
          </Button>
        </div>
      </details>
    </Card>
  );
}
