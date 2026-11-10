import { useEffect, useState } from 'react';
import { request } from '../api';
import './Public.css';

type Plan = { id: number; plan: string; modalidad: string; precio: number };
export function PublicPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    beneficiary: '',
    isStudent: true,
    consent: false,
  });
  useEffect(() => {
    request<Plan[]>('/public/plans')
      .then(setPlans)
      .catch((e: Error) => setError(e.message));
  }, []);
  const groups = Array.from(new Set(plans.map((item) => item.plan)));
  return (
    <main className="public-page">
      <header className="public-header">
        <b>LaPreDigital</b>
        <span>Preparación UNT</span>
      </header>
      <section className="public-hero">
        <span className="eyebrow">ELIGE TU CAMINO</span>
        <h1>Un plan para avanzar a tu ritmo.</h1>
        <p>
          Compara las opciones vigentes y cuéntanos cuál te interesa. Confirmaremos contigo los
          detalles antes de cualquier pago.
        </p>
      </section>
      {error && (
        <p role="alert" className="public-error">
          {error}
        </p>
      )}
      <div className="public-grid">
        <article className="public-plan">
          <span>PRUEBA GRATUITA</span>
          <h2>Explora UNT</h2>
          <strong>14 días gratis</strong>
          <p>Una vez por beneficiario identificado.</p>
          <button onClick={() => setChosen('Explora UNT')}>Solicitar prueba</button>
        </article>
        {groups.map((name) => {
          const options = plans.filter((item) => item.plan === name);
          return (
            <article className="public-plan" key={name}>
              <span>PLAN DE ESTUDIO</span>
              <h2>{name}</h2>
              <strong>Desde S/ {Math.min(...options.map((item) => item.precio)).toFixed(2)}</strong>
              <p>
                {options
                  .map((item) => `${item.modalidad}: S/ ${Number(item.precio).toFixed(2)}`)
                  .join(' · ')}
              </p>
              <p>Consulta el alcance y las condiciones antes de aceptar una propuesta.</p>
              <button onClick={() => setChosen(name)}>Me interesa este plan</button>
            </article>
          );
        })}
      </div>
      {chosen && (
        <section className="public-form">
          <h2>Hablemos de {chosen}</h2>
          {done ? (
            <p role="status">
              Solicitud recibida. Un asesor revisará tu caso antes de enviarte una propuesta.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await request('/public/interest', 'POST', {
                    ...form,
                    beneficiary: form.isStudent ? form.name : form.beneficiary,
                    plan: chosen,
                  });
                  setDone(true);
                } catch (failure) {
                  setError((failure as Error).message);
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
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Correo electrónico
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="public-check">
                <input
                  type="checkbox"
                  checked={form.isStudent}
                  onChange={(e) => setForm({ ...form, isStudent: e.target.checked })}
                />
                Yo soy el estudiante
              </label>
              {!form.isStudent && (
                <label>
                  Nombre del estudiante
                  <input
                    required
                    minLength={2}
                    value={form.beneficiary}
                    onChange={(e) => setForm({ ...form, beneficiary: e.target.value })}
                  />
                </label>
              )}
              <label className="public-check">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                />
                Autorizo que me contacten por correo sobre esta solicitud.
              </label>
              <button disabled={busy || !form.consent}>
                {busy ? 'Enviando…' : 'Solicitar información'}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
