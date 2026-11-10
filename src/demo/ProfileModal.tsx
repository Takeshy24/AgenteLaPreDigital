import {
  Activity,
  BookOpen,
  Check,
  ChevronLeft,
  CircleHelp,
  Clock,
  MessageCircle,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { catalog, Lead } from '../data';
import { initials } from './initials';
import { Modal } from './Modal';
import { Pill } from './Pill';
import { PriorityPill } from './PriorityPill';
export function ProfileModal({
  lead,
  close,
  openConversation,
  save,
}: {
  lead: Lead;
  close: () => void;
  openConversation: () => void;
  save: (p: Partial<Lead>) => void;
}) {
  const [form, setForm] = useState({ ...lead });
  const set = (k: keyof Lead, v: string | boolean) => setForm({ ...form, [k]: v });
  return (
    <Modal title="Expediente de negociación" onClose={close} className="profile-modal">
      <div className="profile-banner">
        <button className="text-link" onClick={close}>
          <ChevronLeft size={14} /> Volver a LEADS
        </button>
        <div className="profile-identity">
          <div className="avatar large">{initials(lead.name)}</div>
          <div>
            <h3>{lead.name}</h3>
            <span>
              {lead.career} · {lead.university}
            </span>
          </div>
          <PriorityPill value={form.priority} />
          <button className="button primary" onClick={openConversation}>
            <Sparkles size={15} /> Abrir conversación
          </button>
        </div>
      </div>
      <div className="profile-workspace">
        <div className="profile-main-column">
          <section className="profile-info-card">
            <div className="profile-card-heading">
              <div>
                <span className="eyebrow">PERFIL DEL CONTACTO · L-2</span>
                <h3>Información del contacto</h3>
              </div>
              <Pill tone="slate">{lead.id}</Pill>
            </div>
            <div className="profile-facts">
              <div>
                <span>Correo</span>
                <b>{form.email}</b>
              </div>
              <div>
                <span>Teléfono</span>
                <b>{form.phone}</b>
              </div>
              <div>
                <span>Canal de origen</span>
                <b>{form.channel}</b>
              </div>
              <div>
                <span>Plan de interés</span>
                <b>{form.plan}</b>
              </div>
              <div>
                <span>Estado de autorización</span>
                <b>{form.authorized ? 'Vigente' : 'Revocada'}</b>
              </div>
              <div>
                <span>Última actividad</span>
                <b>{lead.last}</b>
              </div>
              <div>
                <span>Disponibilidad</span>
                <b>{form.availability}</b>
              </div>
              <div>
                <span>Presupuesto mensual</span>
                <b>{form.budget}</b>
              </div>
              <div>
                <span>Responsable económico</span>
                <b>{form.guardian}</b>
              </div>
            </div>
            <div className="profile-completion">
              <div>
                <span>Perfil conocido</span>
                <b>
                  {
                    [
                      form.email,
                      form.phone,
                      form.university,
                      form.career,
                      form.availability,
                      form.budget,
                    ].filter((v) => v && v !== 'Pendiente').length
                  }{' '}
                  de 6 campos clave
                </b>
              </div>
              <div className="bar-track">
                <i
                  style={{
                    width: `${Math.round(([form.email, form.phone, form.university, form.career, form.availability, form.budget].filter((v) => v && v !== 'Pendiente').length / 6) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </section>
          <section className="profile-findings">
            <div className="profile-card-heading">
              <div>
                <span className="eyebrow">CONTEXTO DE NEGOCIACIÓN</span>
                <h3>Información declarada</h3>
              </div>
              <Pill tone="amber">Prioridad {form.priority.toLowerCase()}</Pill>
            </div>
            <p>
              Resumen demostrativo construido con los datos disponibles del perfil. No es una
              evaluación generada por IA.
            </p>
            <div className="finding-row">
              <BookOpen size={15} />
              <span>
                <b>Objetivo académico</b>
                {form.career} · {form.university}
              </span>
            </div>
            <div className="finding-row">
              <Wallet size={15} />
              <span>
                <b>Condición económica</b>
                {form.budget}
              </span>
            </div>
            <div className="finding-row">
              <CircleHelp size={15} />
              <span>
                <b>Objeción registrada</b>
                {lead.objections.length
                  ? lead.objections.join(' · ')
                  : 'No se han registrado objeciones'}
              </span>
            </div>
            <div className="finding-row">
              <Activity size={15} />
              <span>
                <b>Motivación declarada</b>
                {form.motivation}
              </span>
            </div>
          </section>
          <section className="profile-edit-card">
            <div className="profile-card-heading">
              <div>
                <span className="eyebrow">ACTUALIZACIÓN AUDITABLE</span>
                <h3>Editar datos del perfil</h3>
              </div>
              <Pill tone="blue">Demo local</Pill>
            </div>
            <div className="profile-edit-grid">
              <label>
                Correo
                <input value={form.email} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label>
                Teléfono
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </label>
              <label>
                Universidad
                <input
                  value={form.university}
                  onChange={(e) => set('university', e.target.value)}
                />
              </label>
              <label>
                Carrera
                <input value={form.career} onChange={(e) => set('career', e.target.value)} />
              </label>
              <label>
                Disponibilidad
                <input
                  value={form.availability}
                  onChange={(e) => set('availability', e.target.value)}
                />
              </label>
              <label>
                Presupuesto
                <input value={form.budget} onChange={(e) => set('budget', e.target.value)} />
              </label>
              <label>
                Plan de interés
                <select value={form.plan} onChange={(e) => set('plan', e.target.value)}>
                  {catalog.map((x) => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Prioridad
                <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  {['Alta', 'Media', 'Baja', 'Nula', 'Pendiente'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="authorization-toggle">
              <input
                type="checkbox"
                checked={form.authorized}
                onChange={(e) => set('authorized', e.target.checked)}
              />{' '}
              Autorización de contacto vigente
            </label>
            <div className="audit-line">
              <Clock size={13} />
              <span>Último cambio: {lead.activity}</span>
              <small>Historial demostrativo</small>
            </div>
          </section>
        </div>
        <aside className="profile-side-column">
          <section className="next-step-card">
            <span className="eyebrow">SIGUIENTE PASO SUGERIDO</span>
            <h3>
              {form.priority === 'Nula'
                ? 'Seguimiento suspendido'
                : form.priority === 'Alta'
                  ? 'Atender intención de compra'
                  : 'Ampliar el perfil'}
            </h3>
            <p>
              {form.priority === 'Nula'
                ? 'No iniciar mensajes proactivos. Esperar una nueva comunicación del contacto.'
                : form.priority === 'Alta'
                  ? 'Revisar sus dudas y preparar una propuesta del catálogo vigente.'
                  : 'Confirmar necesidades académicas y condiciones de estudio antes de recomendar un plan.'}
            </p>
            <button className="button secondary full" onClick={openConversation}>
              <MessageCircle size={14} /> Ir a conversación
            </button>
          </section>
          <section className="profile-side-card">
            <span className="eyebrow">PRIORIDAD L-5</span>
            <div className="priority-explain">
              <PriorityPill value={form.priority} />
            </div>
            <p>{lead.activity}</p>
            <small>Motivo basado en señal registrada · clasificación demostrativa</small>
          </section>
          <section className="profile-side-card">
            <span className="eyebrow">RESPONSABLE ECONÓMICO · L-3</span>
            <h3>{form.guardian}</h3>
            <p>
              Autorización de contacto: <b>{form.authorized ? 'vigente' : 'no vigente'}</b>
            </p>
            <small>Vinculación e invitación no se envían desde esta demo.</small>
          </section>
          <section className="profile-side-card">
            <span className="eyebrow">ACTIVIDAD RECIENTE</span>
            <div className="profile-timeline">
              <i />
              <div>
                <b>{lead.activity}</b>
                <small>{lead.last} · Registro de demostración</small>
              </div>
            </div>
            <div className="profile-timeline">
              <i />
              <div>
                <b>Ingreso a LEADS</b>
                <small>
                  {lead.joined} · {lead.channel}
                </small>
              </div>
            </div>
          </section>
        </aside>
      </div>
      <div className="modal-actions sticky-actions">
        <button className="button secondary" onClick={close}>
          Cancelar
        </button>
        <button
          className="button primary"
          onClick={() =>
            save({
              email: form.email,
              phone: form.phone,
              university: form.university,
              career: form.career,
              availability: form.availability,
              budget: form.budget,
              plan: form.plan,
              priority: form.priority,
              authorized: form.authorized,
              activity: 'Perfil de negociación actualizado localmente.',
            })
          }
        >
          <Check size={15} /> Guardar cambios
        </button>
      </div>
    </Modal>
  );
}
