import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleHelp,
  Clock,
  FlaskConical,
  HeartHandshake,
  MoreHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { Lead } from '../data';
import { initials } from './initials';
import { Pill } from './Pill';
export function Rules({
  leads,
  setLeads,
  notify,
}: {
  leads: Lead[];
  setLeads: (x: Lead[]) => void;
  notify: (x: string) => void;
}) {
  const days = [0, 1, 2, 5, 10, 17, 27];
  const [tab, setTab] = useState<'L-1' | 'L-3'>('L-1');
  return (
    <>
      <div className="tabs">
        <button className={tab === 'L-1' ? 'active' : ''} onClick={() => setTab('L-1')}>
          L-1 · Seguimiento por reglas
        </button>
        <button className={tab === 'L-3' ? 'active' : ''} onClick={() => setTab('L-3')}>
          L-3 · Responsable económico
        </button>
      </div>
      {tab === 'L-1' ? (
        <>
          <div className="schedule-banner">
            <div className="schedule-icon">
              <CalendarDays size={20} />
            </div>
            <div>
              <b>Cadencia programada de seguimiento</b>
              <p>
                Los intentos se programan según los días desde el inicio. Una respuesta reinicia el
                contador.
              </p>
            </div>
            <Pill tone="blue">DEMO</Pill>
          </div>
          <div className="schedule-track">
            {days.map((d, i) => (
              <div className={`schedule-step ${i < 3 ? 'done' : ''}`} key={d}>
                <span className="step-dot">
                  {i < 3 ? <Check size={13} /> : i === 3 ? <Clock size={13} /> : null}
                </span>
                <b>Día {d}</b>
                <small>
                  {i === 0
                    ? 'Contacto inicial'
                    : i < 3
                      ? `Intento ${i + 1}`
                      : i === 3
                        ? 'Próximo intento'
                        : 'Seguimiento'}
                </small>
                <span className={`step-status ${i < 3 ? 'completed' : ''}`}>
                  {i < 3 ? 'Completado' : i === 3 ? 'Próximo' : 'Programado'}
                </span>
              </div>
            ))}
          </div>
          <section className="panel schedule-table">
            <div className="panel-head">
              <div>
                <span className="eyebrow">ESTADO ACTUAL</span>
                <h3>Autorización y próximos pasos</h3>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CONTACTO</th>
                    <th>INTENTOS SIN RESPUESTA</th>
                    <th>AUTORIZACIÓN</th>
                    <th>PRÓXIMA ACCIÓN</th>
                    <th>CONDICIÓN</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 6).map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="contact-cell">
                          <div className="avatar">{initials(l.name)}</div>
                          <b>{l.name}</b>
                        </div>
                      </td>
                      <td>
                        <span className="attempt-count">
                          {l.noReply} <small>intentos</small>
                        </span>
                      </td>
                      <td>
                        <Pill tone={l.authorized ? 'green' : 'gray'}>
                          {l.authorized ? 'Autorizado' : 'No contactar'}
                        </Pill>
                      </td>
                      <td>
                        {l.priority === 'Nula'
                          ? 'Suspendida'
                          : l.noReply >= 7
                            ? 'Sin próxima acción'
                            : 'Día ' + days[Math.min(l.noReply + 1, 6)]}
                      </td>
                      <td>
                        {l.priority === 'Nula'
                          ? 'Seguimiento suspendido'
                          : l.noReply >= 7
                            ? '7 intentos consecutivos'
                            : l.authorized
                              ? 'Seguimiento habilitado'
                              : 'Autorización requerida'}
                      </td>
                      <td>
                        <button
                          className="button subtle small-button"
                          onClick={() => {
                            const next = leads.map((x) =>
                              x.id === l.id
                                ? {
                                    ...x,
                                    noReply: 0,
                                    priority: x.priority === 'Nula' ? 'Media' : x.priority,
                                    authorized: true,
                                    status: 'Respuesta registrada',
                                    activity: 'Respuesta simulada; contador reiniciado.',
                                  }
                                : x,
                            );
                            setLeads(next);
                            localStorage.setItem('lp-leads', JSON.stringify(next));
                            notify('Respuesta registrada y contador reiniciado');
                          }}
                        >
                          Simular respuesta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="rule-footnote">
            <CircleHelp size={15} /> Las solicitudes de no contacto, la salida de LEADS y la
            prioridad nula suspenden las comunicaciones. No se envía ningún mensaje real.
          </div>
        </>
      ) : (
        <>
          <div className="schedule-banner">
            <div className="schedule-icon amber-bg">
              <HeartHandshake size={20} />
            </div>
            <div>
              <b>Participación del responsable económico</b>
              <p>
                La vinculación requiere autorización vigente antes de cualquier contacto con el
                responsable.
              </p>
            </div>
            <Pill tone="blue">DEMO</Pill>
          </div>
          <div className="guardian-grid">
            {leads
              .filter((x) => x.guardian !== 'No requiere')
              .slice(0, 5)
              .map((l) => (
                <div className="panel guardian-card" key={l.id}>
                  <div className="guardian-head">
                    <div className="avatar">{initials(l.name)}</div>
                    <div>
                      <b>{l.name}</b>
                      <span>Beneficiario · {l.id}</span>
                    </div>
                    <button className="icon-btn">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <div className="guardian-data">
                    <span>Responsable económico</span>
                    <b>{l.guardian === 'Pendiente' ? 'Por identificar' : l.guardian}</b>
                    <span>Autorización de contacto</span>
                    <Pill tone={l.authorized ? 'green' : 'gray'}>
                      {l.authorized ? 'Vigente' : 'Pendiente'}
                    </Pill>
                    <span>Estado de vinculación</span>
                    <b>
                      {l.guardian.includes('invitación') ? 'Invitación pendiente' : 'Por confirmar'}
                    </b>
                  </div>
                  <button
                    className="button secondary full"
                    onClick={() => notify('Estado de invitación actualizado en la demo')}
                  >
                    Simular invitación <ArrowRight size={14} />
                  </button>
                  <small className="catalog-note">
                    <FlaskConical size={12} /> Sin invitaciones externas
                  </small>
                </div>
              ))}
          </div>
        </>
      )}
    </>
  );
}
