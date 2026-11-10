import { ArrowRight, BookOpen, Check, Filter, MoreHorizontal, ShieldCheck } from 'lucide-react';
import { catalog, Lead } from '../data';
import { Pill } from './Pill';
import { ProposalPill } from './ProposalPill';
import type { DemoProposal } from './types';
export function Proposals({
  leads,
  proposals,
  setSelected,
  setModal,
  setChosenPlan,
}: {
  leads: Lead[];
  proposals: DemoProposal[];
  setSelected: (s: string) => void;
  setModal: (s: string) => void;
  setChosenPlan: (s: string) => void;
}) {
  return (
    <>
      <div className="proposal-intro">
        <div className="proposal-intro-icon">
          <BookOpen size={21} />
        </div>
        <div>
          <b>Propuestas basadas en catálogo autorizado</b>
          <p>
            Prepara alternativas con precios de referencia y una justificación vinculada al perfil
            del LEAD.
          </p>
        </div>
        <Pill tone="blue">Versión 7.1</Pill>
      </div>
      <div className="plan-grid">
        {catalog.map((p, i) => (
          <div className={`catalog-card ${i === 2 ? 'featured' : ''}`} key={p.name}>
            {i === 2 && <span className="recommended">RECOMENDADO PARA PERFIL COMPLETO</span>}
            <div className="catalog-card-top">
              <div className={`plan-icon plan-${i}`}>
                <BookOpen size={17} />
              </div>
              <span>{p.period}</span>
            </div>
            <h3>{p.name}</h3>
            <p>{p.audience}</p>
            <div className="catalog-price">
              {p.monthly ? `S/ ${p.monthly.toFixed(2)}` : 'Gratis'}
              <small>{p.monthly ? ' / mes' : ' · 14 días'}</small>
            </div>
            {p.six && <small className="six-month">S/ {p.six.toFixed(2)} por seis meses</small>}
            <div className="catalog-features">
              {p.features.map((f) => (
                <div key={f}>
                  <Check size={14} />
                  {f}
                </div>
              ))}
            </div>
            <button
              className={`button ${i === 2 ? 'primary' : 'secondary'} full`}
              onClick={() => {
                setChosenPlan(p.name);
                setModal('newproposal');
              }}
            >
              Elegir este plan <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="panel proposal-table-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">ACTIVIDAD COMERCIAL</span>
            <h3>Historial de propuestas</h3>
          </div>
          <button className="text-link">
            <Filter size={14} /> Filtrar
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>REFERENCIA</th>
                <th>LEAD</th>
                <th>PLAN</th>
                <th>FECHA</th>
                <th>VALOR REFERENCIAL</th>
                <th>ESTADO</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.id}</b>
                  </td>
                  <td>{leads.find((x) => x.id === p.lead)?.name || p.lead}</td>
                  <td>{p.plan}</td>
                  <td>{p.date}</td>
                  <td>{p.price}</td>
                  <td>
                    <ProposalPill value={p.status} />
                  </td>
                  <td>
                    <button className="icon-btn small">
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="payment-note">
          <ShieldCheck size={15} />
          <span>
            Aceptar una propuesta no confirma una contratación. El paso a PAYER requiere un primer
            pago verificado.
          </span>
        </div>
      </div>
    </>
  );
}
