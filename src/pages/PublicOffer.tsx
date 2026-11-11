import { useEffect, useState } from 'react';
import { request } from '../api';
import './Public.css';

type Offer = {
  plan: string;
  modalidad: string;
  precio: number;
  beneficiario: string;
  contacto: string;
  accepted: boolean;
  termsAccepted: boolean;
  paid: boolean;
  validated: boolean;
  demoPayments?: boolean;
};
export function PublicOffer() {
  const token = window.location.pathname.split('/').at(-1) || '';
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState('');
  const load = () =>
    request<Offer>(`/public/offers/${token}`)
      .then(setOffer)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('stripe_session_id');
    if (sessionId) {
      request(`/public/offers/${token}/confirm`, 'POST', { sessionId })
        .then(() => {
          setNotice('Pago de prueba confirmado en Stripe.');
          load();
          window.history.replaceState(null, '', window.location.pathname);
        })
        .catch((e: Error) => setError(e.message));
    } else if (query.has('stripe_cancelled')) {
      setNotice('Pago cancelado. Puedes volver a intentarlo.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [token]);
  async function act(path: string) {
    setBusy(true);
    setError('');
    try {
      const result = await request<{ url?: string }>(`/public/offers/${token}/${path}`, 'POST', {});
      if (result.url) window.location.assign(result.url);
      else {
        setNotice(
          path === 'demo-payment'
            ? 'Pago simulado registrado (solo demostración).'
            : 'Condiciones aceptadas. Ya puedes realizar el pago de prueba.',
        );
        await load();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="public-page">
      <header className="public-header">
        <b>LaPreDigital</b>
        <a href="/planes">Ver planes</a>
      </header>
      <section className="public-hero">
        <span className="eyebrow">OFERTA PERSONAL</span>
        <h1>Tu siguiente paso hacia la UNT.</h1>
      </section>
      {error && (
        <p className="public-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!offer && !error && <p>Cargando propuesta…</p>}
      {offer && (
        <section className="public-form">
          <span>Para {offer.beneficiario}</span>
          <h2>{offer.plan}</h2>
          <p>
            {offer.modalidad} · S/ {Number(offer.precio).toFixed(2)} por periodo contratado
          </p>
          <p>Contacto: {offer.contacto}</p>
          {offer.paid ? (
            <p role="status">
              Pago registrado.{' '}
              {offer.validated
                ? 'Contratación validada.'
                : 'Tu contratación está pendiente de validación.'}
            </p>
          ) : (
            <>
              {!offer.termsAccepted && (
                <>
                  <label className="public-check">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    Acepto expresamente esta propuesta, el plan, periodo e importe mostrados.
                  </label>
                  <button disabled={!accepted || busy} onClick={() => act('accept')}>
                    Aceptar propuesta y condiciones
                  </button>
                </>
              )}
              {offer.termsAccepted && (
                <button disabled={busy} onClick={() => act('checkout')}>
                  {busy ? 'Abriendo Stripe…' : 'Pagar con Stripe de prueba'}
                </button>
              )}
              {offer.termsAccepted && offer.demoPayments && (
                <button className="public-demo" disabled={busy} onClick={() => act('demo-payment')}>
                  Simular pago (demo)
                </button>
              )}
            </>
          )}
          <p className="public-small">
            El cobro se realiza en Stripe Checkout. Nunca ingreses datos de tarjeta en esta página.
          </p>
        </section>
      )}
    </main>
  );
}
