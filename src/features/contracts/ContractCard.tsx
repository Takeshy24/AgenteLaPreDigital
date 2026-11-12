import { ArrowUpRight, CheckCircle2, CircleDashed } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';

export function ContractCard() {
  const { selected, detail, busy, run } = useWorkspace();
  if (!selected || !detail) return null;
  const contract = detail.contracts[0];
  const acquired = !!(
    contract?.idEventoPago &&
    contract.idEventoValidacion &&
    !contract.invalidated
  );
  const enabled = acquired && !!contract?.fechaHabilitacion;
  let description = 'Todavía no hay una compra confirmada en este caso.';
  if (contract?.invalidated) description = 'La compra fue anulada por un reembolso.';
  else if (enabled) description = 'El servicio ya fue habilitado.';
  else if (acquired)
    description =
      'La compra está confirmada. Falta habilitar la cuenta y enviar los datos de acceso.';
  else if (contract?.idEventoPago)
    description = 'El pago está registrado. Falta validar la contratación.';

  return (
    <Card title="Servicio" className="service-summary">
      <div className={`service-summary-status${acquired ? ' is-acquired' : ''}`}>
        {acquired ? (
          <CheckCircle2 size={24} aria-hidden="true" />
        ) : (
          <CircleDashed size={24} aria-hidden="true" />
        )}
        <strong>{acquired ? 'Servicio adquirido' : 'Servicio no adquirido'}</strong>
        {acquired && (
          <span className="service-access-state">
            {enabled ? 'Habilitado' : 'Pendiente de habilitación'}
          </span>
        )}
      </div>
      <p className="service-summary-description">{description}</p>
      {acquired && !enabled && (
        <Button
          disabled={busy}
          onClick={() =>
            run(
              `/cases/${selected.idCaso}/activate`,
              {},
              'Servicio habilitado. El envío de credenciales se procesa automáticamente.',
            )
          }
        >
          {busy ? 'Habilitando…' : 'Habilitar servicio'}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Button>
      )}
    </Card>
  );
}
