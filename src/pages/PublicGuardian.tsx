import { useEffect, useState } from 'react';
import { request } from '../api';
import './Public.css';
export function PublicGuardian() {
  const code = window.location.pathname.split('/').at(-1) || '';
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [telegram, setTelegram] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    contactConsent: false,
    linkConsent: false,
  });
  useEffect(() => {
    request<{ name: string; accepted: boolean }>(`/public/invitations/${code}`)
      .then((result) => {
        setForm((form) => ({ ...form, name: result.name }));
        setDone(result.accepted);
        setLoaded(true);
      })
      .catch((error) => setError(error.message));
  }, [code]);
  return (
    <main className="public-page">
      <header className="public-header">
        <b>LaPreDigital</b>
        <a href="/planes">Ver planes</a>
      </header>
      <section className="public-form">
        <span className="plans-overline">INVITACIÓN PERSONAL</span>
        <h1>Participa en la negociación</h1>
        {error && (
          <p className="public-error" role="alert">
            {error}
          </p>
        )}
        {done ? (
          <div role="status">
            <p>Vinculación registrada. Puedes continuar la conversación con el agente.</p>
            {telegram && (
              <a
                href={telegram}
                className="plans-public-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Continuar en Telegram
              </a>
            )}
          </div>
        ) : loaded ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              try {
                const result = await request<{ telegramUrl?: string }>(
                  `/public/invitations/${code}`,
                  'POST',
                  form,
                );
                setTelegram(result.telegramUrl || '');
                setDone(true);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Tu nombre completo
              <input
                required
                minLength={2}
                maxLength={150}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              Tu correo electrónico
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label>
              Tu teléfono internacional
              <input
                required
                type="tel"
                pattern="\+[0-9 ]{7,19}"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label className="public-check">
              <input
                type="checkbox"
                required
                checked={form.linkConsent}
                onChange={(event) => setForm({ ...form, linkConsent: event.target.checked })}
              />
              Acepto que me vinculen a este caso como responsable económico.
            </label>
            <label className="public-check">
              <input
                type="checkbox"
                required
                checked={form.contactConsent}
                onChange={(event) => setForm({ ...form, contactConsent: event.target.checked })}
              />
              Autorizo que me contacten por correo sobre esta negociación.
            </label>
            <button disabled={busy || !form.linkConsent || !form.contactConsent}>
              {busy ? 'Guardando…' : 'Aceptar invitación'}
            </button>
          </form>
        ) : (
          !error && <p role="status">Consultando invitación…</p>
        )}
      </section>
    </main>
  );
}
