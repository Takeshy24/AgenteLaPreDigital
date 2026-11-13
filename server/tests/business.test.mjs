import assert from 'node:assert/strict';
import test from 'node:test';
import { closeInactiveCase, withdraw } from '../cases/service.mjs';
import { saveConsent } from '../consents/service.mjs';
import { evaluatePriority } from '../priorities/service.mjs';
import { getParticipation, insert } from '../shared/repository.mjs';
import {
  activateService,
  acceptTerms,
  activateScholarship,
  authorizeScholarship,
  paymentIncident,
  recordPayment,
  validateContract,
} from '../contracts/service.mjs';
import { close, query, rollbackTest } from '../db.mjs';
import { reviewFollowup } from '../followup/service.mjs';
import { createLead } from '../leads/service.mjs';
import { listPending } from '../pending/service.mjs';
import { getDetails } from '../workspace/repository.mjs';
import { acceptGuardian, inviteGuardian } from '../links/service.mjs';
import { confirmExternalDelivery } from '../messages/delivery.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { prepareProposal, recordProposalResponse } from '../proposals/service.mjs';
import { activateTrial, offerTrial } from '../trials/service.mjs';
const payload = (suffix) => ({
  name: 'Estudiante ' + suffix,
  email: suffix + '@example.test',
  phone: '+51987654321',
  role: 1,
  channel: 1,
  communicationChannel: 2,
  consent: true,
});
test('Nula solo se reactiva por respuesta; una autorización nueva conserva suspensión por falta de respuesta', async () => {
  try {
    await rollbackTest(async (db) => {
      const participant = await createLead(payload('nula-' + Date.now()));
      const context = await getParticipation(db, participant.id);
      const authorization = (
        await query(
          db,
          'SELECT TOP 1 idAutorizacion id FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idEstadoAutorizacion=1',
          { contact: context.idContacto },
        )
      ).recordset[0];
      for (let index = 1; index <= 7; index++) {
        const message = await insert(
          db,
          "INSERT dbo.Mensaje(idContacto,idLead,idLeadCaso,idDireccion,idCanal,idOrigenMensaje,idAutorizacionAlEnvio,esAutomatico,textoMensaje,idEstadoEntrega,fechaEntrega,fechaHora) VALUES(@contact,@lead,@id,2,2,1,@authorization,0,N'Intento de prueba',2,DATEADD(DAY,-100+@index,DATEADD(HOUR,-5,SYSUTCDATETIME())),DATEADD(DAY,-100+@index,DATEADD(HOUR,-5,SYSUTCDATETIME())))",
          {
            contact: context.idContacto,
            lead: context.idLead,
            id: participant.id,
            authorization: authorization.id,
            index,
          },
        );
        await query(
          db,
          'UPDATE dbo.IntentoContacto SET idMensajeEnvio=@message,fechaProgramada=DATEADD(DAY,-100+@index,DATEADD(HOUR,-5,SYSUTCDATETIME())) WHERE idLeadCaso=@id AND numeroIntento=@index',
          { id: participant.id, index, message },
        );
      }
      await evaluatePriority(db, context, 1, null, 4, 2);
      assert.equal((await state(db, participant.id)).idPrioridadActual, 5);
      await saveConsent(participant.id, { channel: 2, granted: false, version: 'test' });
      await saveConsent(participant.id, { channel: 2, granted: true, version: 'test' });
      assert.equal((await state(db, participant.id)).idMotivoSuspension, 1);
      await recordIncoming(participant.id, {
        text: '¿Cuánto cuesta el plan?',
        channel: 2,
        level: 2,
      });
      assert.equal((await state(db, participant.id)).idPrioridadActual, 3);
      assert.equal((await state(db, participant.id)).idEstadoParticipacion, 1);
    });
  } finally {
    await close();
  }
});
async function state(db, id) {
  return (await query(db, 'SELECT * FROM dbo.LeadCaso WHERE idLeadCaso=@id', { id })).recordset[0];
}
async function contracted(db, suffix) {
  const participant = await createLead(payload(suffix));
  const incoming = await recordIncoming(participant.id, {
    text: 'Quiero contratar Ruta UNT',
    channel: 2,
    level: 3,
  });
  const tariff = (await query(db, 'SELECT TOP 1 * FROM dbo.PlanTarifa ORDER BY idPlanTarifa'))
    .recordset[0];
  const proposal = await prepareProposal(participant.id, {
    tariff: tariff.idPlanTarifa,
    replyTo: incoming.id,
    channel: 2,
    justification: 'Plan elegido expresamente por el interesado.',
  });
  await confirmExternalDelivery(proposal.messageId, { reference: 'recibo-envio-' + suffix });
  const acceptance = await recordIncoming(participant.id, {
    text: 'Acepto esta propuesta y sus condiciones',
    channel: 2,
    level: 3,
  });
  await recordProposalResponse(proposal.id, { messageId: acceptance.id, result: 1 });
  const caseId = (await state(db, participant.id)).idCaso;
  await acceptTerms(caseId, {
    proposalId: proposal.id,
    reference: 'Aceptación expresa en mensaje #' + acceptance.id,
  });
  return { participant, proposal, caseId, tariff };
}
test('contratación: entrega, aceptación, pago externo, validación, refund sin abrir caso', async () => {
  try {
    await rollbackTest(async (db) => {
      const flow = await contracted(db, 'contract-' + Date.now());
      await assert.rejects(() => validateContract(flow.caseId), /pago positivo/);
      await recordPayment(flow.caseId, {
        amount: Number(flow.tariff.precio),
        reference: 'gateway-test-' + Date.now(),
      });
      await validateContract(flow.caseId);
      assert.equal((await state(db, flow.participant.id)).idEstadoParticipacion, 4);
      assert.equal((await getDetails(flow.participant.id)).contracts[0].invalidated, false);
      assert.ok(
        (await listPending()).some(
          (item) => item.type === 'activation' && item.caseId === flow.caseId,
        ),
      );
      await paymentIncident(flow.caseId, {
        type: 'refund',
        reference: 'Confirmación externa de devolución total.',
      });
      assert.equal((await getDetails(flow.participant.id)).contracts[0].invalidated, true);
      assert.equal(
        (await listPending()).some(
          (item) => item.type === 'activation' && item.caseId === flow.caseId,
        ),
        false,
      );
      const current = (
        await query(
          db,
          'SELECT b.idEtapa FROM dbo.Beneficiario b JOIN dbo.Caso c ON c.idBeneficiario=b.idBeneficiario WHERE c.idCaso=@id',
          { id: flow.caseId },
        )
      ).recordset[0];
      assert.equal(current.idEtapa, 1);
      await assert.rejects(() => activateService(flow.caseId), /invalidada/);
      const thanks = await recordIncoming(flow.participant.id, {
        text: 'Gracias',
        channel: 2,
        level: 1,
      });
      assert.equal(thanks.participationId, flow.participant.id);
      assert.equal((await state(db, flow.participant.id)).idEstadoParticipacion, 4);
      const next = await recordIncoming(flow.participant.id, {
        text: '¿Cuánto cuesta otro plan?',
        channel: 2,
        level: 2,
      });
      assert.notEqual(next.participationId, flow.participant.id);
      assert.equal((await state(db, next.participationId)).idPrioridadActual, 3);
    });
  } finally {
    await close();
  }
});
test('interés se conserva, prueba una sola vez y reabre sin reiniciar agenda', async () => {
  try {
    await rollbackTest(async (db) => {
      const participant = await createLead(payload('trial-' + Date.now()));
      await recordIncoming(participant.id, { text: 'Quiero contratar', channel: 2, level: 3 });
      const thanks = await recordIncoming(participant.id, {
        text: 'Gracias',
        channel: 2,
        level: 1,
      });
      assert.equal((await state(db, participant.id)).idNivelInteres, 3);
      const offer = await offerTrial(participant.id);
      await activateTrial(offer.token);
      await assert.rejects(() => offerTrial(participant.id), /ya utilizó/);
      await withdraw(participant.id, {
        messageId: thanks.id,
        reason: 'Desistimiento expreso documentado por operador.',
      });
      await recordIncoming(participant.id, {
        text: 'Quiero volver a contratar',
        channel: 2,
        level: 3,
      });
      assert.equal((await state(db, participant.id)).idEstadoParticipacion, 1);
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.IntentoContacto WHERE idLeadCaso=@id', {
            id: participant.id,
          })
        ).recordset[0].n,
        7,
      );
    });
  } finally {
    await close();
  }
});
test('responsable con dos autorizaciones; teléfono compartido no fusiona contactos', async () => {
  try {
    await rollbackTest(async (db) => {
      const suffix = Date.now();
      const student = await createLead(payload('student-' + suffix));
      const message = await recordIncoming(student.id, {
        text: 'Mi mamá decide el pago',
        channel: 2,
        level: 2,
      });
      const invitation = await inviteGuardian(student.id, {
        messageId: message.id,
        name: 'Responsable ' + suffix,
        phone: '+51987654321',
        role: 3,
      });
      await assert.rejects(
        () =>
          acceptGuardian(invitation.code, {
            name: 'Madre',
            email: 'mother-' + suffix + '@example.test',
            phone: '+51987654321',
            channel: 2,
            contactConsent: true,
            linkConsent: false,
          }),
        /ambas autorizaciones/,
      );
      const guardian = await acceptGuardian(invitation.code, {
        name: 'Responsable ' + suffix,
        email: 'mother-' + suffix + '@example.test',
        phone: '+51987654321',
        channel: 2,
        contactConsent: true,
        linkConsent: true,
      });
      const original = await state(db, student.id),
        linked = await state(db, guardian.id);
      assert.equal(original.idCaso, linked.idCaso);
      assert.notEqual(original.idLead, linked.idLead);
      assert.equal(linked.idPrioridadActual, 1);
    });
  } finally {
    await close();
  }
});
test('seguimiento: intento suspendido se omite; revocar no reinicia agenda; inactividad conserva eventos', async () => {
  try {
    await rollbackTest(async (db) => {
      const participant = await createLead(payload('followup-' + Date.now()));
      await query(
        db,
        'UPDATE dbo.IntentoContacto SET fechaProgramada=DATEADD(MINUTE,-1,DATEADD(HOUR,-5,SYSUTCDATETIME())) WHERE idLeadCaso=@id AND numeroIntento=1',
        { id: participant.id },
      );
      await saveConsent(participant.id, { channel: 2, granted: false, version: 'test' });
      await reviewFollowup();
      assert.equal(
        (
          await query(
            db,
            'SELECT omitido FROM dbo.IntentoContacto WHERE idLeadCaso=@id AND numeroIntento=1',
            { id: participant.id },
          )
        ).recordset[0].omitido,
        true,
      );
      await saveConsent(participant.id, { channel: 2, granted: true, version: 'test' });
      await query(db, 'UPDATE dbo.IntentoContacto SET omitido=1 WHERE idLeadCaso=@id', {
        id: participant.id,
      });
      const caseId = (await state(db, participant.id)).idCaso;
      assert.equal(
        await closeInactiveCase(db, caseId, new Date(Date.now() + 100 * 86400000)),
        true,
      );
      assert.equal((await state(db, participant.id)).idEstadoParticipacion, 3);
    });
  } finally {
    await close();
  }
});
test('beca habilitada pasa a CUSTOMER sin contratación pagada', async () => {
  try {
    await rollbackTest(async (db) => {
      const participant = await createLead(payload('scholar-' + Date.now()));
      const caseId = (await state(db, participant.id)).idCaso;
      await authorizeScholarship(caseId, {
        plan: 2,
        endDate: '2030-12-31',
        reference: 'Autorización documentada del operador.',
      });
      await activateScholarship(caseId);
      assert.equal((await state(db, participant.id)).idEstadoParticipacion, 3);
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.Contratacion WHERE idCaso=@id', {
            id: caseId,
          })
        ).recordset[0].n,
        0,
      );
    });
  } finally {
    await close();
  }
});
test('el bloqueo por disputa sigue con mensajes del contacto hasta registrar su resolución', async () => {
  try {
    await rollbackTest(async (db) => {
      const flow = await contracted(db, 'dispute-' + Date.now());
      await recordPayment(flow.caseId, {
        amount: Number(flow.tariff.precio),
        reference: 'gateway-dispute-' + Date.now(),
      });
      await validateContract(flow.caseId);
      await paymentIncident(flow.caseId, { type: 'dispute', reference: 'Contracargo notificado.' });
      const activeDispute = async () =>
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.BloqueoPromocional b JOIN dbo.Caso c ON c.idBeneficiario=b.idBeneficiario WHERE c.idCaso=@id AND b.idMotivoBloqueo=2 AND b.fechaFin IS NULL',
            { id: flow.caseId },
          )
        ).recordset[0].n;
      await recordIncoming(flow.participant.id, { text: 'Gracias', channel: 2, level: 1 });
      assert.equal(await activeDispute(), 1);
      await paymentIncident(flow.caseId, { type: 'resolution', reference: 'Disputa resuelta.' });
      assert.equal(await activeDispute(), 1);
      await recordIncoming(flow.participant.id, { text: 'Hola de nuevo', channel: 2, level: 1 });
      assert.equal(await activeDispute(), 0);
    });
  } finally {
    await close();
  }
});
test('«no le escriban a mi mamá» revoca a la mamá registrada y no al estudiante', async () => {
  const { actOnAnalysis } = await import('../agent/service.mjs');
  try {
    await rollbackTest(async (db) => {
      const suffix = 'familia-' + Date.now();
      const student = await createLead(payload(suffix));
      const context = await getParticipation(db, student.id);
      const mother = await createLead(
        {
          ...payload('mama-' + suffix),
          role: 3,
          beneficiaryId: context.idBeneficiario,
          channel: null,
        },
        { channels: [2] },
      );
      const motherContact = (await getParticipation(db, mother.id)).idContacto;
      const active = async (contact) =>
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idEstadoAutorizacion=1',
            { contact },
          )
        ).recordset[0].n;
      const text = 'No le escriban a mi mamá';
      const message = await recordIncoming(student.id, { text, channel: 2, level: 1 });
      await actOnAnalysis(student.id, message.id, text, {
        level: 1,
        action: 'ask',
        fields: [],
        understood: true,
      });
      assert.equal(await active(motherContact), 0);
      assert.ok((await active(context.idContacto)) > 0);
    });
  } finally {
    await close();
  }
});
