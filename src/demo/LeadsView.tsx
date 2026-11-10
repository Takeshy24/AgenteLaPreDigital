import {
  ArrowUpRight,
  ChevronDown,
  Download,
  Filter,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { catalog, initialLeads, Lead } from '../data';
import { initials } from './initials';
import { PriorityPill } from './PriorityPill';
export function LeadsView({
  leads,
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
  clearFilters,
  openLead,
  setModal,
  showFilters,
  setShowFilters,
}: {
  leads: Lead[];
  query: string;
  setQuery: (s: string) => void;
  priorityFilter: string;
  setPriorityFilter: (s: string) => void;
  planFilter: string;
  setPlanFilter: (s: string) => void;
  channelFilter: string;
  setChannelFilter: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  clearFilters: () => void;
  openLead: (id: string) => void;
  setModal: (s: string) => void;
  showFilters: boolean;
  setShowFilters: (b: boolean) => void;
}) {
  return (
    <>
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            placeholder="Buscar por nombre, correo o teléfono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          className={`button secondary ${showFilters ? 'selected' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={15} /> Filtros <ChevronDown size={14} />
        </button>
        <button className="button secondary" onClick={() => setModal('newlead')}>
          <Plus size={15} /> Añadir contacto
        </button>
        <button className="icon-btn" onClick={clearFilters} title="Restablecer filtros">
          <RefreshCw size={16} />
        </button>
      </div>
      {showFilters && (
        <div className="filter-row">
          <label>
            Prioridad
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              {['Todas', 'Alta', 'Media', 'Baja', 'Nula', 'Pendiente'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Plan de interés
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              {['Todos', ...catalog.map((x) => x.name)].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Canal
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option>Todos los canales</option>
              {['Instagram', 'Landing page', 'TikTok', 'Referido', 'Facebook'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>Todos los estados</option>
              {[...new Set(initialLeads.map((x) => x.status))].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button className="text-link" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      )}
      <div className="list-summary">
        <div>
          <b>{leads.length}</b> contactos <span>· Fase LEADS</span>
        </div>
        <button className="text-link" onClick={() => window.print()}>
          <Download size={14} /> Imprimir vista
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>CONTACTO</th>
              <th>CANAL</th>
              <th>PLAN DE INTERÉS</th>
              <th>PRIORIDAD</th>
              <th>ÚLTIMA INTERACCIÓN</th>
              <th>SEGUIMIENTO</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {leads.map((x) => (
              <tr key={x.id} onClick={() => openLead(x.id)}>
                <td>
                  <div className="contact-cell">
                    <div className="avatar">{initials(x.name)}</div>
                    <div>
                      <b>{x.name}</b>
                      <small>
                        {x.role} · {x.email}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="channel-dot">{x.channel}</span>
                </td>
                <td>
                  <b className="plan-name">{x.plan}</b>
                </td>
                <td>
                  <PriorityPill value={x.priority} />
                </td>
                <td>{x.last}</td>
                <td>
                  <span className={`status-dot ${x.priority === 'Nula' ? 'suspended' : ''}`} />
                  {x.status}
                </td>
                <td>
                  <button
                    className="icon-btn small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLead(x.id);
                    }}
                    aria-label={`Abrir ${x.name}`}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <div className="empty">
            <Search size={24} />
            <b>Sin resultados</b>
            <span>Prueba con otra búsqueda o ajusta los filtros.</span>
          </div>
        )}
      </div>
      <div className="table-foot">
        <span>Mostrando {leads.length} contactos</span>
        <span>Selecciona un contacto para abrir su expediente.</span>
      </div>
    </>
  );
}
