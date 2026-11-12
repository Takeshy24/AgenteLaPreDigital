import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { request, type PublicInquiry } from '../api';
import { Button, Empty } from '../components/ui';
import { LeadForm } from '../features/leads/LeadForm';
import { formatDate } from '../shared/dates';
import { useWorkspace } from '../state/Workspace';

interface PendingItem {
  type:
    | 'handoff'
    | 'payment'
    | 'activation'
    | 'scholarship'
    | 'identity'
    | 'delivery'
    | 'evaluation'
    | 'access-delivery';
  id: number;
  caseId?: number;
  reason?: number;
  title: string;
  since: string;
  resumedAt?: string | null;
  person: string;
  email?: string;
  beneficiary?: string;
  detail: string | null;
  participationId: number | null;
  action: string;
  retryAllowed?: boolean;
}

const GROUPS: {
  type: PendingItem['type'];
  label: string;
  description: string;
  personLabel: string;
  showDetail?: boolean;
}[] = [
  {
    type: 'handoff',
    label: 'Conversaciones por atender',
    personLabel: 'Contacto',
    showDetail: true,
    description: 'Revisa la consulta y registra la atención del personal comercial.',
  },
  {
    type: 'payment',
    label: 'Pagos por validar',
    personLabel: 'Beneficiario',
    showDetail: true,
    description:
      'Comprueba que el pago corresponda a la propuesta antes de validar la contratación.',
  },
  {
    type: 'activation',
    label: 'Servicios por habilitar',
    personLabel: 'Beneficiario',
    description:
      'La contratación ya está validada. Registrar la habilitación crea la cuenta del beneficiario y prepara el envío de sus credenciales por el canal de la contratación.',
  },
  {
    type: 'access-delivery',
    label: 'Credenciales pendientes de entrega',
    personLabel: 'Beneficiario',
    showDetail: true,
    description:
      'La cuenta ya está registrada. Revisa el estado del envío; una entrega incierta debe comprobarse en el canal antes de reintentar.',
  },
  {
    type: 'scholarship',
    label: 'Becas por habilitar',
    personLabel: 'Beneficiario',
    showDetail: true,
    description:
      'Revisa la autorización y registra la habilitación del acceso correspondiente a la beca.',
  },
  {
    type: 'identity',
    label: 'Identidades por confirmar',
    personLabel: 'Contacto',
    description:
      'Confirma la identidad de quien envió la solicitud antes de vincular sus datos al estudiante.',
  },
  {
    type: 'delivery',
    label: 'Propuestas sin entregar',
    personLabel: 'Contacto',
    showDetail: true,
    description: 'Revisa la entrega fallida en el caso antes de preparar un nuevo envío.',
  },
  {
    type: 'evaluation',
    label: 'Primera evaluación pendiente',
    personLabel: 'Contacto',
    description:
      'El plazo de evaluación inicial venció. Revisa la participación y registra su prioridad.',
  },
];

function directAction(item: PendingItem) {
  if (item.type === 'handoff' && item.participationId)
    return {
      label: 'Marcar como atendida',
      path: `/participations/${item.participationId}/handoff/attend`,
      done: 'Derivación atendida.',
    };
  if (item.type === 'payment')
    return {
      label: 'Validar contratación',
      path: `/cases/${item.caseId}/validate`,
      done: 'Contratación validada.',
    };
  if (item.type === 'activation')
    return {
      label: 'Registrar habilitación',
      path: `/cases/${item.caseId}/activate`,
      done: 'Acceso registrado. El envío de credenciales se procesa automáticamente.',
    };
  if (item.type === 'access-delivery' && item.retryAllowed)
    return {
      label: 'Reintentar envío',
      path: `/cases/${item.caseId}/access-delivery/retry`,
      done: 'Envío de credenciales nuevamente en cola.',
    };
  if (item.type === 'scholarship')
    return {
      label: 'Habilitar beca',
      path: `/cases/${item.caseId}/scholarship/activate`,
      done: 'Beca habilitada.',
    };
  return null;
}

export function Pending() {
  const { data, busy, run, open, navigate, inquiries, refreshInquiries } = useWorkspace();
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [intake, setIntake] = useState<PublicInquiry | null>(null);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await request<PendingItem[]>('/pending'));
      setError('');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);
  return (
    <div className="pending-page">
      <div className="pending-toolbar">
        <div>
          <p className="pending-total" role="status">
            {items
              ? `${items.length} ${items.length === 1 ? 'gestión pendiente' : 'gestiones pendientes'}`
              : 'Consultando pendientes…'}
          </p>
          <p className="pending-refresh-note">Actualización automática cada 15 segundos.</p>
        </div>
        <Button variant="secondary" disabled={refreshing || busy} onClick={() => void load()}>
          <RefreshCw size={15} aria-hidden="true" />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>
      {error && (
        <div className="live-alert" role="alert">
          No se pudieron actualizar los pendientes: {error}
        </div>
      )}
      {!items && !error && <Empty>Cargando pendientes…</Empty>}
      {items?.length === 0 && <Empty>No hay gestiones pendientes por atender.</Empty>}
      {GROUPS.map((group) => {
        const list = items?.filter((item) => item.type === group.type) ?? [];
        if (!list.length) return null;
        return (
          <section
            className="data-section pending-group"
            key={group.type}
            aria-labelledby={`pending-${group.type}`}
          >
            <header className="pending-group-header">
              <div className="pending-group-title">
                <h2 id={`pending-${group.type}`}>{group.label}</h2>
                <span className="pending-count" aria-label={`${list.length} pendientes`}>
                  {list.length}
                </span>
              </div>
              <p>{group.description}</p>
            </header>
            <div className="table-wrap">
              <table className="pending-table" aria-labelledby={`pending-${group.type}`}>
                <thead>
                  <tr>
                    <th scope="col">{group.personLabel}</th>
                    {group.type === 'identity' && <th scope="col">Estudiante declarado</th>}
                    {group.showDetail && <th scope="col">Detalle</th>}
                    <th scope="col">Pendiente desde · Lima</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => {
                    const action = directAction(item);
                    const participation = data?.leads.find(
                      (lead) => lead.id === item.participationId,
                    );
                    const inquiry =
                      item.type === 'identity'
                        ? inquiries?.find((entry) => entry.id === item.id)
                        : undefined;
                    return (
                      <tr key={`${item.type}-${item.id}`}>
                        <td data-label={group.personLabel}>
                          <strong className="pending-person">{item.person}</strong>
                          {(item.email || inquiry?.email) && (
                            <small className="live-sub">{item.email || inquiry?.email}</small>
                          )}
                          {(item.caseId || participation?.idCaso) && (
                            <small className="live-sub">
                              Caso #{item.caseId || participation?.idCaso}
                            </small>
                          )}
                        </td>
                        {group.type === 'identity' && (
                          <td data-label="Estudiante declarado">
                            {item.beneficiary || inquiry?.beneficiary || 'Sin identificar'}
                          </td>
                        )}
                        {group.showDetail && (
                          <td data-label="Detalle" className="pending-context">
                            {group.type === 'handoff' && <strong>{item.title}</strong>}
                            {item.detail && <span>{item.detail}</span>}
                            {item.resumedAt && (
                              <small className="live-sub">
                                El agente retomó la conversación; la atención humana sigue
                                pendiente.
                              </small>
                            )}
                            {group.type === 'handoff' && (
                              <small className="live-sub">{item.action}</small>
                            )}
                          </td>
                        )}
                        <td data-label="Pendiente desde · Lima" className="pending-since">
                          <time dateTime={item.since}>{formatDate(item.since)}</time>
                        </td>
                        <td data-label="Acciones">
                          <div className="pending-row-actions">
                            {action && (
                              <Button
                                disabled={busy}
                                aria-label={`${action.label}: ${item.person}`}
                                onClick={async () => {
                                  if (await run(action.path, {}, action.done)) await load();
                                }}
                              >
                                {action.label}
                              </Button>
                            )}
                            {item.type === 'identity' && (
                              <Button
                                disabled={busy}
                                aria-label={`Revisar solicitud: ${item.person}`}
                                onClick={() => (inquiry ? setIntake(inquiry) : navigate('leads'))}
                              >
                                {inquiry ? 'Revisar solicitud' : 'Ver solicitudes'}
                                <ArrowUpRight size={15} aria-hidden="true" />
                              </Button>
                            )}
                            {participation && (
                              <Button
                                variant="secondary"
                                onClick={() => open(participation.id)}
                                aria-label={`Ver caso de ${item.person}`}
                              >
                                Ver caso <ArrowUpRight size={15} aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {intake && (
        <LeadForm
          inquiry={intake}
          onClose={() => {
            setIntake(null);
            void load();
            void refreshInquiries();
          }}
        />
      )}
    </div>
  );
}
