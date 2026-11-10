import { ArrowUpRight, BookOpen, Compass, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { request } from '../api';
import { PlanBenefits } from '../features/catalog/PlanBenefits';
import { AnimatedPrice, useReveal } from '../features/catalog/motion';
import { useSurfaceLight } from '../shared/useSurfaceLight';
import './Catalog.css';
import './Public.css';

type Plan = { id: number; plan: string; modalidad: string; precio: number };
const planIcons = { 'Ruta UNT': Compass, 'Meta UNT': Target, 'Meta UNT Plus': Sparkles };

function PublicPlanCard({
  tariffs,
  period,
  index,
  onChoose,
}: {
  tariffs: Plan[];
  period: string;
  index: number;
  onChoose: (plan: string) => void;
}) {
  const tariff = tariffs.find((item) => item.modalidad === period) || tariffs[0];
  const featured = tariff.plan === 'Meta UNT';
  const Icon = planIcons[tariff.plan as keyof typeof planIcons] || BookOpen;
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
          <AnimatedPrice value={Number(tariff.precio)} />
          <span className="plans-price-period" aria-hidden="true">
            / {tariff.modalidad.toLocaleLowerCase('es-PE')}
          </span>
        </div>
        <p className="plans-price-note">
          Importe total del periodo {tariff.modalidad.toLocaleLowerCase('es-PE')}
        </p>
        <button className="plans-cta" onClick={() => onChoose(tariff.plan)}>
          Me interesa este plan <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <PlanBenefits plan={tariff.plan} />
        <div className="plans-card-footer">
          <span>Precio vigente del catálogo</span>
          <span>Tarifa #{tariff.id}</span>
        </div>
      </section>
    </div>
  );
}

function PublicTrialCard({ onChoose }: { onChoose: (plan: string) => void }) {
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
        <p className="plans-price-note">Solicita información para activar tu prueba.</p>
        <button className="plans-cta plans-cta-secondary" onClick={() => onChoose('Explora UNT')}>
          Solicitar prueba <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <PlanBenefits plan="Explora UNT" />
        <div className="plans-card-footer">
          <span>Una vez por beneficiario identificado</span>
        </div>
      </section>
    </div>
  );
}

export function PublicPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [period, setPeriod] = useState('Mensual');
  const [chosen, setChosen] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ status: string; telegramUrl?: string } | null>(null);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const revealRef = useReveal();
  const [form, setForm] = useState({
    name: '',
    email: '',
    beneficiary: '',
    isStudent: true,
    consent: false,
    phone: '',
    role: 1,
  });
  useEffect(() => {
    request<Plan[]>('/public/plans')
      .then(setPlans)
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setLoading(false));
  }, []);
  const groups = Array.from(new Set(plans.map((item) => item.plan)));
  const periods = Array.from(new Set(plans.map((item) => item.modalidad)));
  function choose(plan: string) {
    setChosen(plan);
    setDone(false);
    setReceipt(null);
    setRequestKey(crypto.randomUUID());
    setFormError('');
    requestAnimationFrame(() =>
      document.getElementById('solicitud')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      }),
    );
  }
  return (
    <main className="public-page">
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
              Compara las opciones, elige un plan y cuéntanos cuál te interesa.
              <br className="plans-desktop-break" /> Confirmaremos contigo los detalles antes de
              cualquier pago.
            </p>
          </div>
          <div className="plans-toolbar">
            <div className="plans-trust">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                Explora UNT · <b>14 días gratis</b>
              </span>
            </div>
            {periods.length > 1 && (
              <div className="plans-toggle" role="group" aria-label="Periodo de contratación">
                {periods.map((value) => (
                  <button
                    key={value}
                    aria-pressed={period === value}
                    onClick={() => setPeriod(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            )}
            <span className="plans-toolbar-note">Planes de estudio</span>
          </div>
        </header>
        {error && (
          <p role="alert" className="public-error">
            {error}
          </p>
        )}
        {loading ? (
          <p className="public-loading" role="status">
            Consultando tarifas vigentes…
          </p>
        ) : !error ? (
          <div className="plans-grid">
            <PublicTrialCard onChoose={choose} />
            {groups.map((name, index) => (
              <PublicPlanCard
                key={name}
                tariffs={plans.filter((item) => item.plan === name)}
                period={period}
                index={index + 1}
                onChoose={choose}
              />
            ))}
          </div>
        ) : null}
        {chosen && (
          <section className="public-form" id="solicitud">
            <span className="plans-overline">SIGUIENTE PASO</span>
            <h2>
              Hablemos de <em>{chosen}</em>
            </h2>
            {done ? (
              <div role="status">
                <p>
                  {receipt?.status === 'Vinculada'
                    ? 'Tu registro está listo. Continúa en Telegram para conversar con el agente sobre tu plan.'
                    : receipt?.status === 'Completar datos'
                      ? 'Solicitud guardada. Continúa en Telegram para identificar al estudiante y completar tu registro.'
                      : 'Solicitud recibida. El personal comercial revisará tus datos antes de vincular tu negociación.'}
                </p>
                {receipt?.telegramUrl && (
                  <a
                    className="plans-public-link"
                    href={receipt.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Continuar en Telegram <ArrowUpRight size={18} aria-hidden="true" />
                  </a>
                )}
                {receipt?.telegramUrl && (
                  <p className="public-small">
                    Pulsa Iniciar en el bot. El enlace vence en 10 minutos.
                  </p>
                )}
              </div>
            ) : (
              <>
                {formError && (
                  <p role="alert" className="public-error">
                    {formError}
                  </p>
                )}
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setFormError('');
                    try {
                      const result = await request<{ status: string; telegramUrl?: string }>(
                        '/public/interest',
                        'POST',
                        {
                          ...form,
                          beneficiary: form.isStudent ? form.name : form.beneficiary,
                          plan: chosen,
                          requestKey,
                          tariff: plans.find(
                            (item) => item.plan === chosen && item.modalidad === period,
                          )?.id,
                        },
                      );
                      setReceipt(result);
                      setDone(true);
                    } catch (failure) {
                      setFormError((failure as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Tu nombre
                    <input
                      required
                      minLength={2}
                      maxLength={150}
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                    />
                  </label>
                  <label>
                    Correo electrónico
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                    />
                  </label>
                  <label className="public-check">
                    <input
                      type="checkbox"
                      checked={form.isStudent}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          isStudent: event.target.checked,
                          role: event.target.checked ? 1 : 2,
                        })
                      }
                    />
                    Yo soy el estudiante
                  </label>
                  <label>
                    Teléfono internacional
                    <input
                      required
                      type="tel"
                      placeholder="+51912345678"
                      pattern="\+[0-9 ]{7,19}"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    />
                  </label>
                  {!form.isStudent && (
                    <label>
                      Tu relación con el estudiante
                      <select
                        value={form.role}
                        onChange={(event) => setForm({ ...form, role: Number(event.target.value) })}
                      >
                        <option value={2}>Padre</option>
                        <option value={3}>Madre</option>
                        <option value={4}>Apoderado</option>
                      </select>
                    </label>
                  )}
                  {!form.isStudent && (
                    <label>
                      Nombre del estudiante
                      <input
                        minLength={2}
                        placeholder="Puedes completarlo conversando con el agente"
                        value={form.beneficiary}
                        onChange={(event) => setForm({ ...form, beneficiary: event.target.value })}
                      />
                    </label>
                  )}
                  <label className="public-check">
                    <input
                      type="checkbox"
                      checked={form.consent}
                      onChange={(event) => setForm({ ...form, consent: event.target.checked })}
                    />
                    Autorizo que me contacten por correo sobre esta solicitud.
                  </label>
                  <button disabled={busy || !form.consent}>
                    {busy ? 'Enviando…' : 'Solicitar información'}
                  </button>
                </form>
              </>
            )}
          </section>
        )}
        <p className="public-disclaimer">
          Los precios corresponden al catálogo vigente. La solicitud no confirma una contratación ni
          realiza un cobro.
        </p>
      </div>
    </main>
  );
}
