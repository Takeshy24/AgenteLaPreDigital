import { BusinessError } from '../shared/errors.mjs';

function key() {
  const secret = process.env.STRIPE_SECRET_KEY || '';
  if (!secret.startsWith('sk_test_'))
    throw new BusinessError('Configura STRIPE_SECRET_KEY de prueba en .env.');
  return secret;
}

async function call(path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${key()}`, ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new BusinessError(
      `Stripe rechazó la operación: ${result.error?.message || response.status}`,
      502,
    );
  return result;
}

export function stripeConfigured() {
  return (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
}

export async function createSession({
  caseId,
  contractId,
  amount,
  plan,
  origin,
  returnPath = '/',
}) {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1)
    throw new BusinessError('Importe de propuesta inválido.');
  const data = new URLSearchParams({
    mode: 'payment',
    'payment_method_types[0]': 'card',
    'line_items[0][price_data][currency]': 'pen',
    'line_items[0][price_data][unit_amount]': String(cents),
    'line_items[0][price_data][product_data][name]': plan,
    'line_items[0][quantity]': '1',
    'metadata[caseId]': String(caseId),
    'metadata[contractId]': String(contractId),
    success_url: `${origin}${returnPath}?stripe_case=${caseId}&stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${returnPath}?stripe_cancelled=1`,
  });
  const session = await call('checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data,
  });
  if (session.livemode || !session.url)
    throw new BusinessError('Stripe no devolvió Checkout de prueba.');
  return { url: session.url };
}

export async function getSession(id) {
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(id)) throw new BusinessError('Sesión Stripe inválida.');
  return call(`checkout/sessions/${encodeURIComponent(id)}`);
}
