import { useState } from 'react';
import { Badge, Card, Empty, ModeLegend } from '../components/ui';
import { AgentCard } from '../features/agent/AgentCard';
import { ConsentCard } from '../features/consents/ConsentCard';
import { ContractCard } from '../features/contracts/ContractCard';
import { LeadDataPanel } from '../features/leads/LeadDataPanel';
import { TelegramCard } from '../features/integrations/TelegramCard';
import { GuardianCard } from '../features/links/GuardianCard';
import { Conversation } from '../features/messages/Conversation';
import { PriorityCard } from '../features/priorities/PriorityCard';
import { ProfileCard } from '../features/profiles/ProfileCard';
import { ProposalCard } from '../features/proposals/ProposalCard';
import { TrialCard } from '../features/trials/TrialCard';
import { formatDate } from '../shared/dates';
import { useWorkspace } from '../state/Workspace';
const tabs = [
  { id: 'profile', label: 'Perfil' },
  { id: 'conversation', label: 'Conversación' },
  { id: 'proposals', label: 'Propuestas' },
  { id: 'commercial', label: 'Servicio' },
  { id: 'guardian', label: 'Responsable económico' },
];
export function Profile() {
  const { selected, detail, navigate } = useWorkspace();
  const [tab, setTab] = useState('profile');
  if (!selected) return null;
  return (
    <div className="profile-page">
      <button className="text-link" onClick={() => navigate('leads')}>
        ← Volver a LEADS
      </button>
      <div className="profile-banner">
        <div className="profile-identity">
          <div className="avatar large">
            {selected.name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')}
          </div>
          <div>
            <h3>{selected.name}</h3>
            <span>
              {selected.beneficiary} · Caso #{selected.idCaso} · {selected.role}
            </span>
          </div>
          <Badge value={selected.priority} />
          <Badge value={selected.status} />
        </div>
      </div>
      <LeadDataPanel />
      <div className="tabs" role="tablist" aria-label="Expediente">
        {tabs.map((item) => (
          <button
            key={item.id}
            id={'tab-' + item.id}
            role="tab"
            tabIndex={tab === item.id ? 0 : -1}
            onKeyDown={(event) => {
              const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              const current = tabs.findIndex((candidate) => candidate.id === item.id);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabs.length - 1
                    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              setTab(tabs[next].id);
              document.getElementById('tab-' + tabs[next].id)?.focus();
            }}
            aria-selected={tab === item.id}
            aria-controls="profile-panel"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab !== 'commercial' && <ModeLegend />}
      {detail ? (
        <div className={`live-detail-grid${tab === 'commercial' ? ' is-service-summary' : ''}`}>
          <div id="profile-panel" role="tabpanel" aria-labelledby={'tab-' + tab}>
            {tab === 'profile' && (
              <>
                <ProfileCard />
                <TrialCard />
              </>
            )}
            {tab === 'conversation' && (
              <>
                <Conversation />
                <AgentCard />
              </>
            )}
            {tab === 'proposals' && <ProposalCard />}
            {tab === 'commercial' && <ContractCard />}
            {tab === 'guardian' && <GuardianCard />}
          </div>
          {tab !== 'commercial' && (
            <aside className="profile-sidebar">
              <PriorityCard />
              <ConsentCard />
              <details className="context-disclosure">
                <summary>Vinculación con Telegram</summary>
                <TelegramCard />
              </details>
              <Card title="Agenda programada" label="L-1" mode="agent">
                {!detail.attempts.length && <Empty>Sin intentos programados.</Empty>}
                {detail.attempts.map((attempt) => (
                  <p key={attempt.idIntento}>
                    Intento {attempt.numeroIntento} · {formatDate(attempt.fechaProgramada)}{' '}
                    {attempt.omitido
                      ? '· omitido'
                      : attempt.idMensajeEnvio
                        ? `· enviado por ${attempt.canalEnvio}${attempt.fechaEnvio ? ` el ${formatDate(attempt.fechaEnvio)}` : ''}`
                        : '· pendiente'}
                  </p>
                ))}
              </Card>
            </aside>
          )}
        </div>
      ) : (
        <Empty>Cargando expediente…</Empty>
      )}
    </div>
  );
}
