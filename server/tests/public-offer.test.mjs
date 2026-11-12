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
      const link = await createOfferLink(proposal.id, 'http://127.0.0.1:3067');
      const token = link.url.split('/').at(-1);
      const shown = await viewOffer(token);
      assert.equal(shown.accepted, false);
      assert.ok(shown.conditions.some((item) => /no confirma el pago/.test(item)));
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

test('descuento: solo el operador lo aprueba, menor al catálogo; abrir el pago es Intento de compra y queda en pendientes', async () => {
  const { simulateOfferPayment } = await import('../public/service.mjs');
  const { listPending } = await import('../pending/service.mjs');
  const previous = process.env.DEMO_PAYMENTS;
  process.env.DEMO_PAYMENTS = '1';
  try {
    await rollbackTest(async (db) => {
      const lead = await createLead({
        name: 'Estudiante descuento',
        email: `descuento-${Date.now()}@example.test`,
        phone: '',
        role: 1,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      });
      const incoming = await recordIncoming(lead.id, {
        text: 'Quiero solicitar un descuento para Ruta UNT',
        channel: 2,
        level: 3,
      });
      const tariff = (
        await query(
          db,
          "SELECT TOP 1 t.idPlanTarifa id,t.precio FROM dbo.PlanTarifa t JOIN dbo.PlanComercial p ON p.idPlan=t.idPlan WHERE p.nombre=N'Ruta UNT'",
        )
      ).recordset[0];
      const data = {
        tariff: tariff.id,
        replyTo: incoming.id,
        channel: 2,
        justification: 'Descuento aprobado por el área comercial.',
      };
      await assert.rejects(
        () => prepareProposal(lead.id, { ...data, price: Number(tariff.precio) + 1 }),
        /menor al del catálogo/,
      );
      await assert.rejects(
        () => prepareProposal(lead.id, { ...data, price: 30 }, { agent: true }),
        /no puede aplicar descuentos/,
      );
      const plain = await prepareProposal(lead.id, data);
      const discounted = await prepareProposal(lead.id, { ...data, price: 30 });
      const rows = (
        await query(
          db,
          'SELECT idPropuesta id,precioAutorizado price,idOperadorAprueba op FROM dbo.PropuestaComercial WHERE idPropuesta IN (@a,@b) ORDER BY idPropuesta',
          { a: plain.id, b: discounted.id },
        )
      ).recordset;
      assert.equal(rows[0].op, null);
      assert.equal(Number(rows[1].price), 30);
      assert.ok(rows[1].op);
      await confirmExternalDelivery(discounted.messageId, {
        reference: 'entrega externa verificada',
      });
      const token = (await createOfferLink(discounted.id, 'http://127.0.0.1:3067')).url
        .split('/')
        .at(-1);
      await acceptOffer(token);
      await simulateOfferPayment(token);
      const participation = (
        await query(
          db,
          'SELECT idNivelInteres level,idPrioridadActual priority FROM dbo.LeadCaso WHERE idLeadCaso=@id',
          {
            id: lead.id,
          },
        )
      ).recordset[0];
      assert.deepEqual([participation.level, participation.priority], [4, 2]);
      const pending = (await listPending()).filter((item) => item.participationId === lead.id);
      assert.ok(pending.some((item) => item.type === 'payment' && /S\/ 30/.test(item.detail)));
    });
  } finally {
    process.env.DEMO_PAYMENTS = previous;
    await close();
  }
});

test('la oferta muestra las condiciones de contratación de la sección 2.4', async () => {
  const { offerConditions } = await import('../public/conditions.mjs');
  const conditions = offerConditions({
    plan: 'Meta UNT',
    modalidad: 'Semestral',
    precioAutorizado: 350,
    precioCatalogo: 399.9,
    expiresAt: '2026-11-20T10:00:00',
  });
  assert.match(conditions[0], /S\/ 350\.00 por cada semestre contratado .*sin cuotas pendientes/);
  assert.match(conditions[1], /descuento aprobado .* S\/ 399\.90/);
  assert.ok(conditions.some((item) => /primera respuesta de soporte: 12 horas/.test(item)));
  assert.ok(conditions.some((item) => /no confirma el pago/.test(item)));
  assert.ok(conditions.some((item) => /vence el 20 de noviembre de 2026/.test(item)));
  const plain = offerConditions({
    plan: 'Ruta UNT',
    modalidad: 'Mensual',
    precioAutorizado: 39.9,
    precioCatalogo: 39.9,
  });
  assert.ok(!plain.some((item) => /descuento/.test(item)));
  assert.match(plain[0], /por cada mes contratado/);
});
