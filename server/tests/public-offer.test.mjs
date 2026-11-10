import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { close, pool, query, rollbackTest } from '../db.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { confirmExternalDelivery } from '../messages/delivery.mjs';
import { prepareProposal } from '../proposals/service.mjs';
import { acceptOffer, createOfferLink, requestPlan, viewOffer } from '../public/service.mjs';
import { verifyStripeEvent } from '../contracts/webhook.mjs';

test('oferta pública: enlace, aceptación web y condiciones sin atribuirlas al operador', async () => {
  try {
    await rollbackTest(async (db) => {
      const lead = await createLead({
        name: 'Estudiante portal',
        email: `portal-${Date.now()}@example.test`,
        phone: '',
        role: 1,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      });
      const incoming = await recordIncoming(lead.id, {
        text: 'Quiero conocer Ruta UNT',
        channel: 2,
        level: 2,
      });
      const tariff = (
        await query(
          db,
          'SELECT TOP 1 idPlanTarifa id FROM dbo.PlanTarifa WHERE precio>0 ORDER BY idPlanTarifa',
        )
      ).recordset[0];
      const proposal = await prepareProposal(lead.id, {
        tariff: tariff.id,
        replyTo: incoming.id,
        channel: 2,
        justification: 'Interés declarado por el plan.',
      });
      await confirmExternalDelivery(proposal.messageId, {
        reference: 'entrega externa verificada',
      });
      const link = await createOfferLink(proposal.id, 'http://127.0.0.1:3001');
      const token = link.url.split('/').at(-1);
      assert.equal((await viewOffer(token)).accepted, false);
      await acceptOffer(token);
      assert.equal((await viewOffer(token)).termsAccepted, true);
      await acceptOffer(token);
      const evidence = (
        await query(
          db,
          "SELECT TOP 1 idOperador FROM dbo.App_OperationEvidence WHERE operation='terms-accepted' ORDER BY id DESC",
        )
      ).recordset[0];
      assert.equal(evidence.idOperador, null);
    });
  } finally {
    await close();
  }
});

test('webhook Stripe: verifica firma y antigüedad', () => {
  const payload = JSON.stringify({ type: 'checkout.session.completed' });
  const time = Math.floor(Date.now() / 1000);
  const secret = 'whsec_test';
  const signature = `t=${time},v1=${createHmac('sha256', secret).update(`${time}.${payload}`).digest('hex')}`;
  assert.equal(verifyStripeEvent(payload, signature, secret).type, 'checkout.session.completed');
  assert.throws(() => verifyStripeEvent(payload + ' ', signature, secret), /Firma Stripe inválida/);
  assert.throws(
    () => verifyStripeEvent(payload, signature, secret, Date.now() + 600000),
    /vencida/,
  );
});

test('solicitud pública se guarda para revisión sin crear un contacto ni exponer IDs', async () => {
  const email = `interest-${Date.now()}@example.test`;
  try {
    await rollbackTest(async (db) => {
      await requestPlan({
        name: 'Persona interesada',
        email,
        beneficiary: 'Estudiante nuevo',
        isStudent: false,
        plan: 'Explora UNT',
        consent: true,
      });
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.App_PublicInquiry WHERE correo=@email', {
            email,
          })
        ).recordset[0].n,
        1,
      );
      assert.equal(
        (await query(db, 'SELECT COUNT(*) n FROM dbo.Contacto WHERE correo=@email', { email }))
          .recordset[0].n,
        0,
      );
    });
  } finally {
    await close();
  }
});
