import { createHmac, timingSafeEqual } from 'node:crypto';
import { confirmStripeCheckout } from './service.mjs';

export function verifyStripeEvent(payload, signature, secret, now = Date.now()) {
  if (!secret?.startsWith('whsec_') || !signature) throw new Error('Webhook no configurado.');
  const values = Object.fromEntries(signature.split(',').map((part) => part.split('=')));
  const time = Number(values.t);
  if (!Number.isSafeInteger(time) || Math.abs(now / 1000 - time) > 300)
    throw new Error('Firma Stripe vencida.');
  const expected = createHmac('sha256', secret).update(`${time}.${payload}`).digest('hex');
  const received = values.v1 || '';
  if (
    expected.length !== received.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  )
    throw new Error('Firma Stripe inválida.');
  return JSON.parse(payload);
}

export async function handleStripeEvent(event) {
  if (
    !['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
  )
    return;
  const session = event.data?.object;
  if (event.livemode || session?.livemode || !session?.id?.startsWith('cs_test_')) return;
  const caseId = Number(session.metadata?.caseId);
  if (!Number.isSafeInteger(caseId) || caseId < 1) throw new Error('Caso Stripe inválido.');
  await confirmStripeCheckout(caseId, session.id);
}
