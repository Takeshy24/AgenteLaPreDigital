import test from 'node:test';
import assert from 'node:assert/strict';
import { rollbackTest, query, close } from '../db.mjs';
import { createLead } from '../leads/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { saveConsent } from '../consents/service.mjs';
import { reviewFollowup } from '../followup/service.mjs';
import { acceptUpdate, pendingUpdates } from '../integrations/repository.mjs';
import { processUpdate } from '../integrations/telegram.mjs';
test('seguimiento usa Telegram si es el primer canal autorizado con conector disponible', async () => {
  try {
    await rollbackTest(async (db) => {
      const suffix = Date.now();
      const lead = await createLead({
        name: 'Canal ' + suffix,
        email: 'channel-' + suffix + '@example.test',
        phone: '+51912345678',
        role: 1,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      });
      const participant = await getParticipation(db, lead.id);
      await query(
        db,
        "UPDATE dbo.Contacto SET inicioBotTelegram=1,usuarioTelegram=N'test' WHERE idContacto=@contact; INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat); UPDATE dbo.IntentoContacto SET fechaProgramada=DATEADD(MINUTE,-1,DATEADD(HOUR,-5,SYSUTCDATETIME())) WHERE idLeadCaso=@id AND numeroIntento=1",
        { id: lead.id, contact: participant.idContacto, chat: 'channel-' + suffix },
      );
      await saveConsent(lead.id, { channel: 3, granted: true, version: 'test' });
      await reviewFollowup({ canSend: (channel) => channel === 3 });
      const sent = (
        await query(
          db,
          'SELECT m.idCanal FROM dbo.IntentoContacto i JOIN dbo.Mensaje m ON m.idMensaje=i.idMensajeEnvio WHERE i.idLeadCaso=@id AND i.numeroIntento=1',
          { id: lead.id },
        )
      ).recordset[0];
      assert.equal(sent.idCanal, 3);
    });
  } finally {
    await close();
  }
});
test('Telegram respeta no contacto sin seleccionar beneficiario entre varios casos', async () => {
  try {
    await rollbackTest(async (db) => {
      const suffix = Date.now();
      const identity = {
        name: 'Responsable ' + suffix,
        email: 'consent-' + suffix + '@example.test',
        phone: '+51912345678',
        role: 3,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      };
      const first = await createLead({ ...identity, beneficiaryName: 'Hijo A ' + suffix });
      await createLead({ ...identity, beneficiaryName: 'Hijo B ' + suffix });
      const participant = await getParticipation(db, first.id);
      const chatId = 'consent-' + suffix;
      await query(
        db,
        "UPDATE dbo.Contacto SET inicioBotTelegram=1,usuarioTelegram=N'test' WHERE idContacto=@contact; INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat)",
        { contact: participant.idContacto, chat: chatId },
      );
      await saveConsent(first.id, { channel: 3, granted: true, version: 'test' });
      const update = {
        update_id: 100000000000 + (suffix % 1000000000),
        message: {
          message_id: 1,
          from: { id: 1, is_bot: false },
          chat: { id: chatId, type: 'private' },
          text: 'ya no quiero que me contacten, no los quiero',
        },
      };
      await acceptUpdate(db, update);
      const item = (await pendingUpdates(db)).find((item) => item.updateId === update.update_id);
      let notifications = 0;
      await processUpdate(item, {
        call: async () => {
          notifications++;
          return { message_id: 2 };
        },
      });
      assert.equal(notifications, 1);
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idEstadoAutorizacion=1',
            { contact: participant.idContacto },
          )
        ).recordset[0].n,
        0,
      );
      const processed = (
        await query(db, 'SELECT processedAt FROM dbo.App_TelegramInbox WHERE updateId=@id', {
          id: update.update_id,
        })
      ).recordset[0];
      assert.ok(processed.processedAt);
      const participations = (
        await query(
          db,
          `SELECT lc.idEstadoParticipacion state, lc.idMotivoSuspension reason, c.idEstadoCaso caseState
          FROM dbo.LeadCaso lc INNER JOIN dbo.Lead l ON l.idLead=lc.idLead
          INNER JOIN dbo.Caso c ON c.idCaso=lc.idCaso WHERE l.idContacto=@contact`,
          { contact: participant.idContacto },
        )
      ).recordset;
      assert.equal(participations.length, 2);
      assert.ok(
        participations.every((row) => row.state === 2 && row.reason === 2 && row.caseState === 1),
      );
    });
  } finally {
    await close();
  }
});
