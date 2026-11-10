import { ArrowUpRight, CircleHelp, Clock, Target } from 'lucide-react';
import { Lead, Priority } from '../data';
import { initials } from './initials';
import { Pill } from './Pill';
import { PriorityPill } from './PriorityPill';
export function PriorityView({
  leads,
  openLead,
  setSelected,
}: {
  leads: Lead[];
  openLead: (id: string) => void;
  setSelected: (s: string) => void;
}) {
  const groups: [string, string, string][] = [
    ['Alta', 'Requieren atención prioritaria', 'red'],
    ['Media', 'Interés activo en evaluación', 'blue'],
    ['Baja', 'Interés inicial o sin respuesta reciente', 'amber'],
    ['Nula', 'Seguimiento proactivo suspendido', 'gray'],
  ];
  return (
    <>
      <div className="priority-intro">
        <Target size={20} />
        <div>
          <b>Clasificación con evidencia observable</b>
          <span>
            Las categorías siguen los criterios definidos para L-5. Sin puntuaciones de conversión
            ni predicciones ficticias.
          </span>
        </div>
        <Pill tone="blue">L-5</Pill>
      </div>
      <div className="priority-summary">
        {groups.map(([g, label, tone]) => (
          <div key={g} className={`priority-summary-item ${tone}`}>
            <span>
              <i />
              {g}
            </span>
            <b>{leads.filter((x) => x.priority === g).length}</b>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <div className="priority-contact-grid">
        {groups.map(([g, label]) => (
          <section className="panel priority-group" key={g}>
            <div className="priority-group-head">
              <div>
                <PriorityPill value={g as Priority} />
                <h3>{label}</h3>
              </div>
              <span>{leads.filter((x) => x.priority === g).length}</span>
            </div>
            {leads
              .filter((x) => x.priority === g)
              .map((l) => (
                <button
                  className="priority-lead"
                  key={l.id}
                  onClick={() => {
                    setSelected(l.id);
                    openLead(l.id);
                  }}
                >
                  <div className="avatar">{initials(l.name)}</div>
                  <div className="priority-lead-main">
                    <b>{l.name}</b>
                    <span>{l.activity}</span>
                    <small>
                      <Clock size={12} />
                      {l.last} <i>·</i> {l.status}
                    </small>
                  </div>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            {!leads.some((x) => x.priority === g) && (
              <div className="empty-compact">No hay contactos en esta categoría.</div>
            )}
          </section>
        ))}
      </div>
      <div className="priority-rule-note">
        <CircleHelp size={16} />
        <div>
          <b>Reglas de clasificación</b>
          <p>
            Alta: intención explícita de contratar o consulta concreta de adquisición. Media:
            preguntas sobre características o condiciones. Baja: interés limitado o entre 3 y 6
            intentos sin respuesta. Nula: 7 intentos sin respuesta o suspensión por reembolso,
            reversión, disputa o solicitud de no contacto.
          </p>
        </div>
      </div>
    </>
  );
}
