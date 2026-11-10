import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Clock,
  Inbox,
  MessageCircle,
  Sparkles,
  Target,
  UserRound,
  Users,
} from 'lucide-react';
import { Lead } from '../data';
import { initials } from './initials';
import { Metric } from './Metric';
import type { DemoProposal, Page } from './types';
export function Dashboard({
  leads,
  proposals,
  go,
  openLead,
}: {
  leads: Lead[];
  proposals: DemoProposal[];
  go: (p: Page) => void;
  openLead: (id: string) => void;
}) {
  const high = leads.filter((x) => x.priority === 'Alta');
  return (
    <>
      <div className="hero-row">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-overline">
              <span /> OPERACIÓN EN VIVO <span className="soft">· DEMO</span>
            </span>
            <h2>
              La próxima conversación
              <br />
              empieza con contexto.
            </h2>
            <p>
              Revisa las señales recientes y acompaña cada negociación con la información que el
              contacto ya compartió.
            </p>
            <button className="hero-link" onClick={() => go('priority')}>
              Ver prioridades <ArrowRight size={15} />
            </button>
          </div>
          <div className="hero-art">
            <div className="orb orb1" />
            <div className="orb orb2" />
            <div className="orbit orbit1" />
            <div className="orbit orbit2" />
            <div className="hero-center">
              <Sparkles size={27} />
            </div>
            <div className="float-chip chip-a">
              <MessageCircle size={14} /> Conversación <i />
            </div>
            <div className="float-chip chip-b">
              <UserRound size={14} /> Perfil actualizado <Check size={12} />
            </div>
            <div className="float-chip chip-c">
              <Target size={14} /> Prioridad alta
            </div>
          </div>
        </section>
        <section className="attention">
          <div className="card-title">
            <div>
              <span className="eyebrow">PARA HOY</span>
              <h3>Atención prioritaria</h3>
            </div>
            <button className="text-link" onClick={() => go('priority')}>
              Ver todo <ArrowRight size={14} />
            </button>
          </div>
          <div className="attention-list">
            {high.slice(0, 3).map((x) => (
              <button className="attention-item" key={x.id} onClick={() => openLead(x.id)}>
                <div className="avatar">{initials(x.name)}</div>
                <div className="attention-main">
                  <b>{x.name}</b>
                  <span>{x.activity}</span>
                </div>
                <span className="attention-arrow">
                  <ArrowUpRight size={15} />
                </span>
              </button>
            ))}
          </div>
          <div className="attention-foot">
            <span>
              <i /> {high.length} contactos con prioridad alta
            </span>
          </div>
        </section>
      </div>
      <div className="metric-strip">
        <Metric
          label="Contactos activos"
          value="128"
          delta="12 esta semana"
          icon={<Users size={18} />}
          tone="blue"
        />
        <Metric
          label="Evaluación pendiente"
          value={leads
            .filter((x) => x.priority === 'Pendiente')
            .length.toString()
            .padStart(2, '0')}
          delta="Dentro de ventana 24 h"
          icon={<Clock size={18} />}
          tone="amber"
        />
        <Metric
          label="Propuestas entregadas"
          value={proposals
            .filter((x) => x.status === 'Entregada')
            .length.toString()
            .padStart(2, '0')}
          delta="En espera de respuesta"
          icon={<Inbox size={18} />}
          tone="violet"
        />
        <Metric
          label="Seguimientos de hoy"
          value="07"
          delta="Según reglas L-1"
          icon={<CalendarDays size={18} />}
          tone="green"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel trend-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ACTIVIDAD COMERCIAL</span>
              <h3>Conversaciones a lo largo del tiempo</h3>
            </div>
            <div className="legend">
              <span>
                <i className="legend-blue" /> Contactos
              </span>
              <span>
                <i className="legend-orange" /> Respuestas
              </span>
              <select defaultValue="Últimos 7 días">
                <option>Últimos 7 días</option>
                <option>Este mes</option>
              </select>
            </div>
          </div>
          <div className="chart-area">
            <div className="chart-y">
              <span>80</span>
              <span>60</span>
              <span>40</span>
              <span>20</span>
              <span>0</span>
            </div>
            <div className="chart">
              <div className="grid-lines">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <svg viewBox="0 0 720 190" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#2f6fe5" stopOpacity=".14" />
                    <stop offset="1" stopColor="#2f6fe5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 145 C50 137 55 112 103 120 S164 87 206 105 S270 78 308 88 S365 52 413 69 S465 45 515 58 S570 31 618 47 S683 20 720 24 L720 190 L0 190 Z"
                  fill="url(#area)"
                />
                <path
                  d="M0 145 C50 137 55 112 103 120 S164 87 206 105 S270 78 308 88 S365 52 413 69 S465 45 515 58 S570 31 618 47 S683 20 720 24"
                  fill="none"
                  stroke="#356de0"
                  strokeWidth="2.5"
                />
                <path
                  d="M0 169 C50 161 55 151 103 158 S164 133 206 145 S270 124 308 139 S365 108 413 120 S465 105 515 115 S570 95 618 107 S683 82 720 87"
                  fill="none"
                  stroke="#e99b24"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
              </svg>
              <div className="chart-x">
                <span>30 oct</span>
                <span>31 oct</span>
                <span>01 nov</span>
                <span>02 nov</span>
                <span>03 nov</span>
                <span>04 nov</span>
                <span>05 nov</span>
              </div>
            </div>
          </div>
          <div className="chart-foot">
            <span>Actividad simulada · No representa rendimiento histórico</span>
            <button className="text-link" onClick={() => go('reports')}>
              Explorar indicadores <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <section className="panel priority-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">CLASIFICACIÓN</span>
              <h3>Prioridad de seguimiento</h3>
            </div>
            <button className="icon-btn" onClick={() => go('priority')}>
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="priority-bars">
            {[
              ['Alta', 31, 'high'],
              ['Media', 52, 'medium'],
              ['Baja', 34, 'low'],
              ['Nula', 11, 'none'],
            ].map(([n, v, c]) => (
              <div className="priority-bar" key={String(n)}>
                <div>
                  <span>{n}</span>
                  <b>{v}</b>
                </div>
                <div className="bar-track">
                  <i className={String(c)} style={{ width: `${Number(v)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="priority-note">
            <Target size={15} />
            <span>Clasificación basada en señales observables. Sin puntajes predictivos.</span>
          </div>
        </section>
      </div>
      <div className="bottom-grid">
        <section className="panel recent-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">MOVIMIENTO RECIENTE</span>
              <h3>Últimas interacciones</h3>
            </div>
            <button className="text-link" onClick={() => go('leads')}>
              Ver LEADS <ArrowRight size={14} />
            </button>
          </div>
          <div className="activity-list">
            {leads.slice(0, 4).map((x, i) => (
              <button key={x.id} onClick={() => openLead(x.id)} className="activity-row">
                <div className={`activity-symbol tone-${i}`}>
                  <MessageCircle size={15} />
                </div>
                <div>
                  <b>{x.name}</b>
                  <span>{x.activity}</span>
                </div>
                <time>{x.last}</time>
              </button>
            ))}
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ACCESOS RÁPIDOS</span>
              <h3>Continuar trabajo</h3>
            </div>
          </div>
          <button onClick={() => go('conversation')}>
            <div className="quick-icon blue-bg">
              <MessageCircle size={17} />
            </div>
            <span>
              <b>Abrir agente negociador</b>
              <small>Explorar escenarios de conversación</small>
            </span>
            <ArrowRight size={16} />
          </button>
          <button onClick={() => go('proposals')}>
            <div className="quick-icon amber-bg">
              <BookOpen size={17} />
            </div>
            <span>
              <b>Preparar una propuesta</b>
              <small>Usar el catálogo autorizado</small>
            </span>
            <ArrowRight size={16} />
          </button>
          <button onClick={() => go('reports')}>
            <div className="quick-icon violet-bg">
              <BarChart3 size={17} />
            </div>
            <span>
              <b>Consultar indicadores</b>
              <small>Revisar los seis KPI de la fase</small>
            </span>
            <ArrowRight size={16} />
          </button>
        </section>
      </div>
    </>
  );
}
