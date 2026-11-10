import { useEffect, useState } from 'react';
import { request } from '../api';
import './Public.css';
export function PublicTrial() {
  const token = window.location.pathname.split('/').at(-1) || '';
  const [days, setDays] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    request<{ days: number }>(`/public/trials/${token}`)
      .then((result) => setDays(result.days))
      .catch((error) => setError(error.message));
  }, [token]);
  return (
    <main className="public-page">
      <header className="public-header">
        <b>LaPreDigital</b>
        <a href="/planes">Ver planes</a>
      </header>
      <section className="public-form">
        <h1>Explora UNT</h1>
        {error && (
          <p role="alert" className="public-error">
            {error}
          </p>
        )}
        {done ? (
          <p role="status">
            Activación registrada por {days} días. El acceso a cursos se habilitará al conectar la
            plataforma educativa.
          </p>
        ) : days ? (
          <>
            <p>
              Prueba gratuita de {days} días, una vez por beneficiario identificado. No requiere un
              pago.
            </p>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await request(`/public/trials/${token}`, 'POST', { activate: true });
                  setDone(true);
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Registrando…' : 'Activar prueba gratuita'}
            </button>
          </>
        ) : (
          !error && <p role="status">Consultando prueba…</p>
        )}
      </section>
    </main>
  );
}
