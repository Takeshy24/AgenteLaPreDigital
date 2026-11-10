import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Ellipsis,
  FlaskConical,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { catalog, Lead } from '../data';
import { initials } from './initials';
import { Pill } from './Pill';
import { PriorityPill } from './PriorityPill';
export function Conversation({
  lead,
  leads,
  setSelected,
  message,
  setMessage,
  send,
  simulate,
  demoActive,
  setDemoActive,
  openProposal,
  openProfile,
}: {
  lead: Lead;
  leads: Lead[];
  setSelected: (s: string) => void;
  message: string;
  setMessage: (s: string) => void;
  send: () => void;
  simulate: (s: string) => void;
  demoActive: boolean;
  setDemoActive: (v: boolean) => void;
  openProposal: () => void;
  openProfile: () => void;
}) {
  return (
    <div className="conversation-layout">
      <aside className="conversation-list panel">
        <div className="conv-list-head">
          <div>
            <span className="eyebrow">BANDEJA LEADS</span>
            <h3>Conversaciones</h3>
          </div>
          <button className="icon-btn">
            <Search size={16} />
          </button>
        </div>
        <div className="conv-search">
          <Search size={14} />
          <input placeholder="Buscar contacto" />
        </div>
        {leads.slice(0, 7).map((x) => (
          <button
            className={`conv-contact ${x.id === lead.id ? 'selected' : ''}`}
            onClick={() => setSelected(x.id)}
            key={x.id}
          >
            <div className="avatar">{initials(x.name)}</div>
            <div className="conv-contact-content">
              <div>
                <b>{x.name}</b>
                <time>{x.last}</time>
              </div>
              <span>{x.messages[x.messages.length - 1]?.text}</span>
              <div className="conv-tags">
                <PriorityPill value={x.priority} />
                <small>{x.channel}</small>
              </div>
            </div>
          </button>
        ))}
      </aside>
      <section className="chat-panel panel">
        <div className="chat-head">
          <div className="avatar">{initials(lead.name)}</div>
          <div>
            <b>{lead.name}</b>
            <span>
              {lead.role} · <i className="online-dot" /> En LEAD
            </span>
          </div>
          <PriorityPill value={lead.priority} />
          <button className="icon-btn" onClick={openProfile}>
            <UserRound size={17} /> Perfil
          </button>
          <button className="icon-btn">
            <Ellipsis size={18} />
          </button>
        </div>
        <div className="simulation-banner">
          <FlaskConical size={15} />
          <span>
            <b>Conversación demostrativa</b> · Respuestas predefinidas, sin conexión a un modelo de
            IA.
          </span>
          <button onClick={() => setDemoActive(!demoActive)}>
            {demoActive ? 'Ocultar escenarios' : 'Ver escenarios'} <ChevronDown size={13} />
          </button>
        </div>
        {demoActive && (
          <div className="scenario-bar">
            <span>Simular una situación:</span>
            <button onClick={() => simulate('medicina')}>
              Me interesa Medicina <ArrowRight size={13} />
            </button>
            <button onClick={() => simulate('precio')}>
              Preguntar el precio <ArrowRight size={13} />
            </button>
            <button onClick={() => simulate('proposal')}>
              Solicitar propuesta <ArrowRight size={13} />
            </button>
          </div>
        )}
        <div className="chat-messages">
          <div className="date-divider">
            <span>Hoy · 5 de noviembre</span>
          </div>
          {lead.messages.map((m, i) => (
            <div className={`message-row ${m.from}`} key={i}>
              {m.from === 'agent' && (
                <div className="agent-avatar">
                  <Sparkles size={14} />
                </div>
              )}
              <div className="message-content">
                <div className="bubble">{m.text}</div>
                <div className="message-meta">
                  {m.from === 'agent' ? 'Agente (simulado)' : 'Contacto'} · {m.time}
                  {m.from === 'agent' && <Pill tone="violet">DEMO</Pill>}
                </div>
              </div>
              {m.from === 'lead' && <div className="avatar mini">{initials(lead.name)}</div>}
            </div>
          ))}
        </div>
        <div className="composer">
          <div className="suggestions">
            <span>Sugerencias</span>
            <button onClick={() => setMessage('¿Qué cursos te gustaría reforzar?')}>
              Preguntar por dificultades <Plus size={12} />
            </button>
            <button onClick={openProposal}>
              Preparar propuesta <Plus size={12} />
            </button>
          </div>
          <div className="composer-box">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe una respuesta de demostración…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div className="composer-actions">
              <span>
                <FlaskConical size={13} /> Mensaje local · Enter para enviar
              </span>
              <button className="button primary" onClick={send}>
                <Send size={15} /> Enviar
              </button>
            </div>
          </div>
        </div>
      </section>
      <aside className="context-panel">
        <section className="panel context-card">
          <div className="context-title">
            <span className="eyebrow">CONTEXTO DEL CONTACTO</span>
            <button className="text-link" onClick={openProfile}>
              Ver perfil <ArrowRight size={13} />
            </button>
          </div>
          <h3>{lead.name}</h3>
          <div className="context-detail">
            <span>Objetivo académico</span>
            <b>{lead.career}</b>
          </div>
          <div className="context-detail">
            <span>Universidad</span>
            <b>{lead.university}</b>
          </div>
          <div className="context-detail">
            <span>Disponibilidad</span>
            <b>{lead.availability}</b>
          </div>
          <div className="context-detail">
            <span>Presupuesto</span>
            <b>{lead.budget}</b>
          </div>
          <div className="context-detail">
            <span>Plan de interés</span>
            <b>{lead.plan}</b>
          </div>
          <div className="completeness">
            <div>
              <span>Perfil conocido</span>
              <b>5 de 9 campos</b>
            </div>
            <div className="bar-track">
              <i style={{ width: '56%' }} />
            </div>
          </div>
        </section>
        <section className="panel context-card">
          <div className="context-title">
            <span className="eyebrow">PROPUESTA AUTORIZADA</span>
            <BookOpen size={15} />
          </div>
          <h3>{lead.plan}</h3>
          <p className="muted">{catalog.find((x) => x.name === lead.plan)?.audience}</p>
          <div className="price-highlight">
            {catalog.find((x) => x.name === lead.plan)?.monthly
              ? `S/ ${catalog.find((x) => x.name === lead.plan)?.monthly.toFixed(2)}`
              : '14 días'}{' '}
            <small>
              {catalog.find((x) => x.name === lead.plan)?.monthly ? 'por mes' : 'gratuitos'}
            </small>
          </div>
          <button className="button secondary full" onClick={openProposal}>
            Preparar propuesta <ArrowRight size={14} />
          </button>
          <div className="catalog-note">
            <ShieldCheck size={13} /> Catálogo de referencia 7.1
          </div>
        </section>
        <div className="context-ai">
          <div className="ai-title">
            <Sparkles size={15} /> Hallazgos demostrativos
          </div>
          <p>
            El contacto mencionó <b>{lead.career}</b>.{' '}
            {lead.objections.length
              ? 'Duda registrada: ' + lead.objections[0] + '.'
              : 'No hay objeciones registradas.'}
          </p>
          <span>Resumen local ilustrativo · No generado por IA</span>
        </div>
      </aside>
    </div>
  );
}
