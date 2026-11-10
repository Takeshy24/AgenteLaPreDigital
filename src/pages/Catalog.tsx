import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Minus,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { useSurfaceLight } from '../shared/useSurfaceLight';
import type { Tariff } from '../api';
import { Button, Empty } from '../components/ui';
import { AnimatedPrice, useReveal } from '../features/catalog/motion';
import { PlanBenefits } from '../features/catalog/PlanBenefits';
import { planFeatures, reportFeatures, reportPlanNames } from '../shared/reportCatalog';
import { useWorkspace } from '../state/Workspace';
import './Catalog.css';

const planIcons = { 'Ruta UNT': Compass, 'Meta UNT': Target, 'Meta UNT Plus': Sparkles };

function PlanCard({
  tariffs,
  period,
  index,
  onChoose,
}: {
  tariffs: Tariff[];
  period: string;
  index: number;
  onChoose: () => void;
}) {
  const tariff = tariffs.find((item) => item.modalidad === period) || tariffs[0];
  const featured = tariff.plan === 'Meta UNT';
  const Icon = planIcons[tariff.plan as keyof typeof planIcons] || BookOpen;
  const features = planFeatures(tariff.plan).filter(
    (feature) => feature.value !== '—' && feature.value !== 'No',
  );
  const light = useSurfaceLight(true);
  return (
    <div
      className={`plans-card-frame${featured ? ' is-featured' : ''}`}
      data-reveal
      style={{ '--entry-delay': `${index * 85}ms` } as CSSProperties}
    >
      <section {...light} className="plans-card" aria-label={`Plan ${tariff.plan}`}>
        <div className="plans-card-light" aria-hidden="true" />
        <div className="plans-card-head">
          <span className="plans-icon">
            <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
          </span>
          {featured && (
            <span className="plans-badge">
              <span />
              Plan destacado
            </span>
          )}
        </div>
        <span className="plans-overline">PLAN DE ESTUDIO</span>
        <h2>{tariff.plan}</h2>
        <div className="plans-period-label">
          <span>{tariff.modalidad}</span>
          {period !== tariff.modalidad && (
            <small>Solo {tariff.modalidad.toLocaleLowerCase('es-PE')}</small>
          )}
        </div>
        <div className="plans-price" aria-live="polite" aria-atomic="true">
          <span aria-hidden="true">S/</span>
          <AnimatedPrice value={tariff.precio} />
          <span className="plans-price-period" aria-hidden="true">
            / {tariff.modalidad.toLocaleLowerCase('es-PE')}
          </span>
        </div>
        <p className="plans-price-note">
          Importe total del periodo {tariff.modalidad.toLocaleLowerCase('es-PE')}
        </p>
        <Button className="plans-cta" onClick={onChoose}>
          Seleccionar contacto <ArrowUpRight size={18} aria-hidden="true" />
        </Button>
        <PlanBenefits plan={tariff.plan} />
        {!features.length && (
          <p className="plans-price-note">
            Este plan no tiene características documentadas en la tabla 4 del informe.
          </p>
        )}
        <div className="plans-card-footer">
          <span>Catálogo {tariff.versionCatalogo}</span>
          <span>Tarifa #{tariff.idPlanTarifa}</span>
        </div>
      </section>
    </div>
  );
}

function TrialPlanCard({ onChoose }: { onChoose: () => void }) {
  const light = useSurfaceLight(true);
  return (
    <div className="plans-card-frame" data-reveal>
      <section {...light} className="plans-card" aria-label="Plan Explora UNT">
        <div className="plans-card-light" aria-hidden="true" />
        <div className="plans-card-head">
          <span className="plans-icon">
            <BookOpen size={23} strokeWidth={1.6} aria-hidden="true" />
          </span>
        </div>
        <span className="plans-overline">PRUEBA GRATUITA</span>
        <h2>Explora UNT</h2>
        <div className="plans-period-label">
          <span>Una vez por beneficiario</span>
        </div>
        <div className="plans-price">
          <strong>Gratis</strong>
          <span className="plans-price-period">14 días de prueba</span>
        </div>
        <p className="plans-price-note">La activación no cambia la etapa comercial.</p>
        <Button className="plans-cta plans-cta-secondary" variant="secondary" onClick={onChoose}>
          Abrir contactos <ArrowUpRight size={18} aria-hidden="true" />
        </Button>
        <PlanBenefits plan="Explora UNT" />
        <div className="plans-card-footer">
          <span>Beneficiario identificado</span>
          <span>Informe §2.4</span>
        </div>
      </section>
    </div>
  );
}

export function Catalog() {
  const { data, navigate } = useWorkspace();
  const [period, setPeriod] = useState('Mensual');
  const revealRef = useReveal();
  const plans = new Map<string, Tariff[]>();
  for (const tariff of data?.tariffs || []) {
    const items = plans.get(tariff.plan) || [];
    items.push(tariff);
    plans.set(tariff.plan, items);
  }
  const periods = Array.from(new Set(data?.tariffs.map((tariff) => tariff.modalidad) || []));
  return (
    <div className="plans" ref={revealRef}>
      <header className="plans-hero">
        <div className="plans-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="plans-hero-top">
          <span className="plans-wordmark">
            LaPreDigital<span> / PLANES</span>
          </span>
          <span className="plans-live">
            <span />
            Tarifas vigentes
          </span>
        </div>
        <div className="plans-hero-copy">
          <span className="plans-overline">PREPARACIÓN PREUNIVERSITARIA · UNT</span>
          <h1>
            La preparación empieza
            <br />
            <em>con un buen plan.</em>
          </h1>
          <p>
            Compara las opciones, elige una modalidad y prepara
            <br className="plans-desktop-break" /> la propuesta para tu próximo estudiante.
          </p>
          <a href="/planes" target="_blank" rel="noopener noreferrer" className="plans-public-link">
            Abrir catálogo para leads <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="plans-toolbar">
          <div className="plans-trust">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              Explora UNT · <b>14 días gratis</b>
            </span>
          </div>
          <div className="plans-toggle" role="group" aria-label="Periodo de contratación">
            {periods.map((value) => (
              <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>
                {value}
              </button>
            ))}
          </div>
          <span className="plans-toolbar-note">Planes de estudio</span>
        </div>
      </header>
      {plans.size ? (
        <div className="plans-grid">
          <TrialPlanCard onChoose={() => navigate('leads')} />
          {Array.from(plans.entries()).map(([plan, tariffs], index) => (
            <PlanCard
              key={plan}
              tariffs={tariffs}
              period={period}
              index={index + 1}
              onChoose={() => navigate('leads')}
            />
          ))}
        </div>
      ) : (
        <Empty>No hay planes con tarifas vigentes para mostrar.</Empty>
      )}
      <details className="plans-comparison">
        <summary>
          Comparar todas las características <span>Tabla 4 del informe</span>
        </summary>
        <div className="plans-table">
          <table>
            <caption>Oferta descrita en el informe · sección 2.4</caption>
            <thead>
              <tr>
                <th scope="col">Característica</th>
                {reportPlanNames.map((name) => (
                  <th scope="col" key={name}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportFeatures.map((feature) => (
                <tr key={feature.label}>
                  <th scope="row">{feature.label}</th>
                  {feature.values.map((value, index) => (
                    <td key={index}>
                      {value === '—' ? (
                        <>
                          <Minus size={14} aria-hidden="true" />
                          <span className="sr-only">No incluido</span>
                        </>
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="plans-bottom">
        <p>
          Oferta y condiciones: informe §2.4, tabla 4. Precios y modalidades: catálogo vigente del
          sistema. Cobro por periodo contratado, sin cuotas pendientes. Soporte: plazo máximo de
          primera respuesta, no de resolución. Los accesos educativos requieren integración con la
          plataforma.
        </p>
        <aside className="plans-motion">
          <span>DETALLES DE MOVIMIENTO</span>
          <p>
            Hover y brillo · 300 ms
            <br />
            Entrada escalonada · 500 ms
            <br />
            Precios · 420 ms, ease-out
            <br />
            Borde · 10 s, linear
          </p>
          <small>Respeta movimiento reducido.</small>
        </aside>
      </div>
      <aside className="plans-note">
        <BookOpen size={18} aria-hidden="true" />
        <p>
          <strong>Primero el plan. Después, la propuesta.</strong> Selecciona un contacto para
          continuar la negociación desde su expediente.
        </p>
      </aside>
    </div>
  );
}
