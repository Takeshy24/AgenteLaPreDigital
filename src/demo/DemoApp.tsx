import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { catalog, initialLeads, Lead, ProposalStatus, saveLead } from '../data';
import { Conversation } from './Conversation';
import { Dashboard } from './Dashboard';
import { LeadsView } from './LeadsView';
import { Modal } from './Modal';
import { NewLead } from './NewLead';
import { Pill } from './Pill';
import { PriorityView } from './PriorityView';
import { ProfileModal } from './ProfileModal';
import { Proposals } from './Proposals';
import { Reports } from './Reports';
import { Rules } from './Rules';
import { Page } from './types';
import { navGroups } from './config';
import { useDemo } from './useDemo';
export default function DemoApp() {
  const {
    leads,
    setLeads,
    page,
    setPage,
    selected,
    setSelected,
    query,
    setQuery,
    priorityFilter,
    setPriorityFilter,
    planFilter,
    setPlanFilter,
    channelFilter,
    setChannelFilter,
    statusFilter,
    setStatusFilter,
    toast,
    modal,
    setModal,
    proposals,
    chosenPlan,
    setChosenPlan,
    proposalStatus,
    setProposalStatus,
    period,
    setPeriod,
    message,
    setMessage,
    demoActive,
    setDemoActive,
    showFilters,
    setShowFilters,
    lead,
    notify,
    update,
    openLead,
    filtered,
    simulate,
    sendMessage,
    makeProposal,
    title,
  } = useDemo();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={19} />
          </div>
          <div>
            <b>LaPreDigital</b>
            <span>NEGOCIACIONES</span>
          </div>
          <button className="collapse">
            <ChevronLeft size={15} />
          </button>
        </div>
        <div className="workspace">
          <div className="workspace-icon">L</div>
          <div>
            <b>Operación UNT</b>
            <span>Workspace</span>
          </div>
          <ChevronDown size={15} />
        </div>
        {navGroups.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-label">{group.title}</div>
            {group.items.map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setPage(id as Page)}
                className={`nav-item ${page === id ? 'active' : ''}`}
              >
                <Icon size={17} />
                <span>{label}</span>
                {id === 'leads' && <small>128</small>}
              </button>
            ))}
          </div>
        ))}
        <div className="side-bottom">
          <div className="demo-card">
            <div className="demo-icon">
              <FlaskConical size={16} />
            </div>
            <b>Entorno demostrativo</b>
            <p>Datos y acciones simulados para esta primera versión.</p>
            <button
              onClick={() => {
                setLeads(initialLeads);
                localStorage.removeItem('lp-leads');
                setSelected('LP-2048');
                notify('Datos de demostración restablecidos');
              }}
            >
              <RefreshCw size={13} /> Restablecer datos
            </button>
          </div>
          <button className="nav-item">
            <Settings size={17} />
            <span>Configuración</span>
          </button>
          <div className="user-row">
            <div className="avatar mini">DT</div>
            <div>
              <b>David Takeshy</b>
              <span>Administrador</span>
            </div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            LaPreDigital <ChevronRight size={13} /> <span>{title}</span>
          </div>
          <div className="top-actions">
            <div className="search-global">
              <Search size={15} />
              <input
                placeholder="Buscar en la plataforma"
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (page !== 'leads') setPage('leads');
                }}
              />
              <kbd>⌘ K</kbd>
            </div>
            <span className="demo-tag">
              <i /> DEMO
            </span>
            <button
              className="icon-btn"
              onClick={() => notify('No tienes notificaciones nuevas')}
              aria-label="Notificaciones"
            >
              <Bell size={18} />
              <i className="notification-dot" />
            </button>
            <div className="avatar mini">DT</div>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                FASE LEADS <span>•</span> UNT
              </div>
              <h1>{title}</h1>
              <p>
                {page === 'overview'
                  ? 'Una vista clara del trabajo comercial que requiere atención.'
                  : page === 'leads'
                    ? 'Consulta el contexto de cada contacto y continúa su seguimiento.'
                    : page === 'reports'
                      ? 'Indicadores de diseño con datos ficticios y trazabilidad visible.'
                      : 'Las acciones de esta vista se simulan localmente.'}
              </p>
            </div>
            {page === 'overview' && (
              <button
                className="button primary"
                onClick={() => {
                  setPage('leads');
                  setModal('newlead');
                }}
              >
                <Plus size={16} /> Nuevo LEAD
              </button>
            )}
            {page === 'proposals' && (
              <button className="button primary" onClick={() => setModal('newproposal')}>
                <Plus size={16} /> Preparar propuesta
              </button>
            )}
          </div>
          {page === 'overview' && (
            <Dashboard leads={leads} proposals={proposals} go={setPage} openLead={openLead} />
          )}
          {page === 'leads' && (
            <LeadsView
              leads={filtered}
              query={query}
              setQuery={setQuery}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              planFilter={planFilter}
              setPlanFilter={setPlanFilter}
              channelFilter={channelFilter}
              setChannelFilter={setChannelFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              clearFilters={() => {
                setPriorityFilter('Todas');
                setPlanFilter('Todos');
                setChannelFilter('Todos los canales');
                setStatusFilter('Todos los estados');
              }}
              openLead={(id) => {
                setSelected(id);
                setModal('profile');
              }}
              setModal={setModal}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
            />
          )}
          {page === 'conversation' && (
            <Conversation
              lead={lead}
              setSelected={setSelected}
              leads={leads}
              message={message}
              setMessage={setMessage}
              send={sendMessage}
              simulate={simulate}
              demoActive={demoActive}
              setDemoActive={setDemoActive}
              openProposal={() => {
                setModal('newproposal');
              }}
              openProfile={() => setModal('profile')}
            />
          )}
          {page === 'proposals' && (
            <Proposals
              leads={leads}
              proposals={proposals}
              setSelected={setSelected}
              setModal={setModal}
              setChosenPlan={setChosenPlan}
            />
          )}
          {page === 'priority' && (
            <PriorityView leads={leads} openLead={openLead} setSelected={setSelected} />
          )}
          {page === 'rules' && <Rules leads={leads} setLeads={setLeads} notify={notify} />}
          {page === 'reports' && <Reports period={period} setPeriod={setPeriod} />}
          <footer className="footer">
            <span>
              <ShieldCheck size={14} /> Datos de demostración · No representan resultados operativos
            </span>
            <span>LaPreDigital · Inteligencia comercial</span>
          </footer>
        </div>
      </main>
      {modal === 'profile' && (
        <ProfileModal
          lead={lead}
          close={() => setModal('')}
          openConversation={() => {
            setModal('');
            setPage('conversation');
          }}
          save={async (p) => {
            update(p);
            await saveLead({ ...lead, ...p });
            setModal('');
            notify('Perfil actualizado');
          }}
        />
      )}
      {modal === 'newproposal' && (
        <Modal title="Preparar propuesta" onClose={() => setModal('')}>
          <div className="form">
            <label>
              LEAD
              <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {leads.map((x: Lead) => (
                  <option value={x.id} key={x.id}>
                    {x.name} · {x.id}
                  </option>
                ))}
              </select>
            </label>
            <div className="hint-box">
              <Sparkles size={16} />
              <span>
                <b>Contexto del perfil</b>
                <br />
                {lead.career} · {lead.budget} · {lead.motivation}
              </span>
            </div>
            <label>
              Plan del catálogo autorizado
              <select value={chosenPlan} onChange={(e) => setChosenPlan(e.target.value)}>
                {catalog.map((x) => (
                  <option key={x.name}>{x.name}</option>
                ))}
              </select>
            </label>
            <div className="plan-options">
              {catalog.map((p) => (
                <button
                  className={`plan-option ${chosenPlan === p.name ? 'chosen' : ''}`}
                  onClick={() => setChosenPlan(p.name)}
                  key={p.name}
                >
                  <span>
                    {chosenPlan === p.name ? <Check size={15} /> : <span className="radio" />}
                  </span>
                  <b>{p.name}</b>
                  <small>{p.monthly ? `S/ ${p.monthly.toFixed(2)} / mes` : '14 días gratis'}</small>
                </button>
              ))}
            </div>
            <label>
              Estado inicial
              <select
                value={proposalStatus}
                onChange={(e) => setProposalStatus(e.target.value as ProposalStatus)}
              >
                {['Borrador', 'Preparada', 'Entregada', 'Pendiente de respuesta'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setModal('')}>
                Cancelar
              </button>
              <button className="button primary" onClick={makeProposal}>
                Vista previa <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === 'preview' && (
        <Modal title="Vista previa de propuesta" onClose={() => setModal('')}>
          <div className="proposal-paper">
            <div className="paper-top">
              <div className="brand-mark">
                <Sparkles size={17} />
              </div>
              <span>LAPREDIGITAL · PROPUESTA</span>
              <Pill tone="blue">{proposalStatus}</Pill>
            </div>
            <p className="paper-kicker">PREPARADA PARA</p>
            <h2>{leads.find((x: Lead) => x.id === selected)?.name}</h2>
            <p className="muted">Preparación para ingresar a la Universidad Nacional de Trujillo</p>
            <div className="paper-plan">
              <span>PLAN RECOMENDADO</span>
              <h3>{chosenPlan}</h3>
              <p>{catalog.find((x) => x.name === chosenPlan)?.audience}</p>
              <strong>
                {catalog.find((x) => x.name === chosenPlan)?.monthly
                  ? `S/ ${catalog.find((x) => x.name === chosenPlan)?.monthly.toFixed(2)} / mes`
                  : '14 días gratuitos'}
              </strong>
            </div>
            <div className="feature-list">
              {catalog
                .find((x) => x.name === chosenPlan)
                ?.features.map((x) => (
                  <div key={x}>
                    <Check size={15} />
                    {x}
                  </div>
                ))}
            </div>
            <div className="hint-box">
              <CircleHelp size={16} />
              <span>
                Propuesta aceptada no significa pago confirmado. Los precios de referencia deben
                validarse con el catálogo vigente.
              </span>
            </div>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => {
                setModal('');
                setPage('proposals');
              }}
            >
              Guardar como borrador
            </button>
            <button
              className="button primary"
              onClick={() => {
                setModal('');
                setPage('proposals');
                notify('Propuesta registrada localmente');
              }}
            >
              <Check size={15} /> Registrar propuesta
            </button>
          </div>
        </Modal>
      )}
      {modal === 'newlead' && (
        <Modal title="Nuevo contacto demostrativo" onClose={() => setModal('')}>
          <NewLead
            onSave={(l) => {
              const next = [l, ...leads];
              setLeads(next);
              localStorage.setItem('lp-leads', JSON.stringify(next));
              setSelected(l.id);
              setModal('');
              notify('Contacto agregado');
            }}
            onCancel={() => setModal('')}
          />
        </Modal>
      )}
      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
