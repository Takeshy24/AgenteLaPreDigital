import { useCallback, useEffect, useState } from 'react';
import { request } from '../api';
import { Button, Card, Empty } from '../components/ui';
import { useWorkspace } from '../state/Workspace';

interface PendingItem {
  type:
    'handoff' | 'payment' | 'activation' | 'scholarship' | 'identity' | 'delivery' | 'evaluation';
  id: number;
  caseId?: number;
  reason?: number;
  title: string;
  since: string;
  resumedAt?: string | null;
  person: string;
  detail: string | null;
  participationId: number | null;
  action: string;
}

const GROUPS: { type: PendingItem['type']; label: string }[] = [
  { type: 'handoff', label: 'Derivaciones abiertas' },
  { type: 'payment', label: 'Pagos por validar' },
  { type: 'activation', label: 'Servicios por habilitar' },
  { type: 'scholarship', label: 'Becas por habilitar' },
  { type: 'identity', label: 'Identidades por revisar' },
  { type: 'delivery', label: 'Entregas fallidas' },
  { type: 'evaluation', label: 'Evaluaciones iniciales vencidas' },
];

// Acción directa de cada pendiente, cuando la consola ya tiene la operación.
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
      done: 'Servicio habilitado.',
    };
  if (item.type === 'scholarship')
    return {
      label: 'Habilitar beca',
      path: `/cases/${item.caseId}/scholarship/activate`,
      done: 'Beca habilitada.',
    };
  return null;
}

const since = (value: string) =>
  new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export function Pending() {
  const { data, busy, run, open, navigate } = useWorkspace();
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setItems(await request<PendingItem[]>('/pending'));
      setError('');
    } catch (failure) {
      setError((failure as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);
  const known = (id: number | null) => !!id && !!data?.leads.some((lead) => lead.id === id);
  return (
    <div className="pending-page">
      <Card title="Pendientes del operador" label="LO QUE EL SISTEMA NO RESUELVE SOLO">
        <p>
          Derivaciones, pagos, habilitaciones y revisiones que esperan una decisión del personal
          comercial. Se actualiza cada 15 segundos.
        </p>
        {error && <p className="stopped">{error}</p>}
        {!items && !error && <Empty>Cargando pendientes…</Empty>}
        {items && !items.length && <Empty>No hay pendientes. 🎉</Empty>}
      </Card>
      {GROUPS.map((group) => {
        const list = items?.filter((item) => item.type === group.type) ?? [];
        if (!list.length) return null;
        return (
          <Card key={group.type} title={`${group.label} (${list.length})`} label="PENDIENTE">
            {list.map((item) => {
              const action = directAction(item);
              return (
                <article className="live-message pending-item" key={`${item.type}-${item.id}`}>
                  <b>
                    {item.title} · {item.person}
                  </b>
                  <p>
                    Desde {since(item.since)}
                    {item.resumedAt ? ' · el agente ya retomó la conversación' : ''}
                  </p>
                  {item.detail && <p className="pending-detail">«{item.detail.slice(0, 160)}»</p>}
                  <p>{item.action}</p>
                  <div className="section-actions">
                    {known(item.participationId) && (
                      <Button variant="secondary" onClick={() => open(item.participationId!)}>
                        Abrir caso
                      </Button>
                    )}
                    {item.type === 'identity' && (
                      <Button variant="secondary" onClick={() => navigate('leads')}>
                        Ir a LEADS y casos
                      </Button>
                    )}
                    {action && (
                      <Button
                        disabled={busy}
                        onClick={async () => {
                          if (await run(action.path, {}, action.done)) await load();
                        }}
                      >
                        {action.label}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}
