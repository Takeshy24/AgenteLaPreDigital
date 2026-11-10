import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rollbackTest, query, close } from '../db.mjs';
import { registerInquiry } from '../public/intake.mjs';
import { processUpdate } from '../integrations/telegram.mjs';
import { acceptUpdate, pendingUpdates } from '../integrations/repository.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { actOnAnalysis } from '../agent/service.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import { viewOffer, acceptOffer } from '../public/service.mjs';
import { activateTrial } from '../trials/service.mjs';
import { acceptPublicInvitation } from '../public/invitations.mjs';
import { reviewMaintenance } from '../followup/service.mjs';

const form = () => ({
  name: `Captación ${randomUUID()}`,
  email: `${randomUUID()}@example.test`,
  phone: '+51912345678',
  role: 1,
  beneficiary: '',
  isStudent: true,
  plan: 'Ruta UNT',
  consent: true,
  requestKey: randomUUID(),
});

test('agente invita al responsable sin escribirle y el portal exige dos autorizaciones', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = form();
      const lead = await createLead({ ...data, channel: 1, communicationChannel: 2 });
      const text = 'Mi padre Carlos Pérez paga. Su teléfono es +51912345678.';
      const incoming = await recordIncoming(lead.id, { text, channel: 3, level: 2 });
      const analysis = {
        fields: [],
        action: 'ask',
        tariffId: null,
        guardian: { name: 'Carlos Pérez', phone: '+51912345678', role: 2, quote: text },
      };
      await actOnAnalysis(lead.id, incoming.id, text, analysis);
      await actOnAnalysis(lead.id, incoming.id, text, analysis);
      const invitations = (
        await query(
          db,
          'SELECT i.codigoEnlace code FROM dbo.InvitacionVinculacion i JOIN dbo.NecesidadVinculacion n ON n.idNecesidad=i.idNecesidad WHERE n.idLeadCasoDeclara=@id',
          { id: lead.id },
        )
      ).recordset;
      assert.equal(invitations.length, 1);
      await assert.rejects(
        () =>
          acceptPublicInvitation(invitations[0].code, {
            name: 'Carlos Pérez',
            email: `${randomUUID()}@example.test`,
            phone: '+51912345678',
            contactConsent: true,
            linkConsent: false,
          }),
        /ambas autorizaciones/,
      );
      const email = `${randomUUID()}@example.test`;
      await acceptPublicInvitation(invitations[0].code, {
        name: 'Carlos Pérez',
        email,
        phone: '+51912345678',
        contactConsent: true,
        linkConsent: true,
      });
      const linked = (
        await query(
          db,
          'SELECT l.idCanalCaptacion FROM dbo.Lead l JOIN dbo.Contacto c ON c.idContacto=l.idContacto WHERE c.correo=@email',
          { email },
        )
      ).recordset[0];
      assert.equal(linked.idCanalCaptacion, null);
    });
  } finally {
    await close();
  }
});

test('dos mensajes no interpretables derivan, el perfil sigue registrándose y la retoma avisa una vez', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnabled = process.env.OLLAMA_ENABLED;
  process.env.OLLAMA_ENABLED = 'true';
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      message: {
        content: JSON.stringify({
          level: 1,
          retraction: false,
          action: 'ask',
          tariffId: null,
          fields: [],
          understood: false,
          needsGuardian: false,
          guardian: null,
        }),
      },
    }),
  });
  try {
    await rollbackTest(async (db) => {
      const data = form();
      const lead = await createLead({ ...data, channel: 1, communicationChannel: 2 });
      const contact = (
        await query(db, 'SELECT idContacto FROM dbo.Contacto WHERE correo=@email', {
          email: data.email,
        })
      ).recordset[0].idContacto;
      const chat = String(Date.now());
      await query(db, 'INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat)', {
        contact,
        chat,
      });
      for (let index = 0; index < 2; index++) {
        const update = {
          update_id: Date.now() + index,
          message: {
            from: { is_bot: false },
            chat: { id: chat, type: 'private' },
            text: 'qzx' + index,
          },
        };
        await acceptUpdate(db, update);
        await processUpdate(
          (await pendingUpdates(db)).find((row) => row.updateId === update.update_id),
          {
            call: async () => {
              throw new Error('No debe enviar fuera del despachador');
            },
          },
        );
      }
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.Derivacion WHERE idContacto=@contact AND fechaAtencion IS NULL',
            { contact },
          )
        ).recordset[0].n,
        1,
      );
      const incoming = await recordIncoming(lead.id, {
        text: 'Quiero estudiar Medicina',
        channel: 3,
        level: 2,
      });
      const before = (
        await query(
          db,
          'SELECT COUNT(*) n FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2',
          { contact },
        )
      ).recordset[0].n;
      await actOnAnalysis(lead.id, incoming.id, 'Quiero estudiar Medicina', {
        fields: [{ field: 'career', value: 'Medicina', quote: 'Medicina' }],
        action: 'ask',
        tariffId: null,
      });
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2',
            { contact },
          )
        ).recordset[0].n,
        before,
      );
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.CambioPerfil WHERE idLeadCaso=@id', {
            id: lead.id,
          })
        ).recordset[0].n,
        1,
      );
      await query(
        db,
        'UPDATE dbo.Derivacion SET fechaInicio=DATEADD(HOUR,-25,DATEADD(HOUR,-5,SYSUTCDATETIME())) WHERE idContacto=@contact',
        { contact },
      );
      await reviewMaintenance();
      await reviewMaintenance();
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2',
            { contact },
          )
        ).recordset[0].n,
        before + 1,
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnabled === undefined) delete process.env.OLLAMA_ENABLED;
    else process.env.OLLAMA_ENABLED = originalEnabled;
    await close();
  }
});

test('agente prepara y entrega propuesta con enlace, evita duplicarla y registra prueba sin pago', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = form();
      const lead = await createLead({ ...data, channel: 1, communicationChannel: 2 });
      const contact = (
        await query(db, 'SELECT idContacto FROM dbo.Contacto WHERE correo=@email', {
          email: data.email,
        })
      ).recordset[0].idContacto;
      await query(db, 'INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat)', {
        contact,
        chat: `agent-${Date.now()}`,
      });
      const tariff = (
        await query(
          db,
          'SELECT TOP 1 idPlanTarifa id FROM dbo.PlanTarifa WHERE precio>0 ORDER BY idPlanTarifa',
        )
      ).recordset[0].id;
      const incoming = await recordIncoming(lead.id, {
        text: 'Quiero contratar Ruta UNT mensual',
        channel: 3,
        level: 3,
      });
      await actOnAnalysis(lead.id, incoming.id, 'Quiero contratar Ruta UNT mensual', {
        fields: [],
        action: 'proposal',
        tariffId: tariff,
      });
      const proposal = (
        await query(
          db,
          'SELECT TOP 1 p.idPropuesta,m.idMensaje,m.textoMensaje FROM dbo.PropuestaComercial p JOIN dbo.Mensaje m ON m.idMensaje=p.idMensajeEntrega WHERE p.idLeadCasoEntrega=@id',
          { id: lead.id },
        )
      ).recordset[0];
      const token = proposal.textoMensaje.match(/\/oferta\/([A-Za-z0-9_-]+)/)[1];
      await assert.rejects(() => acceptOffer(token), /no está disponible/);
      const client = { call: async () => ({ message_id: 123 }) };
      await dispatchMessage(proposal.idMensaje, client);
      assert.equal((await viewOffer(token)).accepted, false);
      const next = await recordIncoming(lead.id, {
        text: 'Quiero contratar Ruta UNT mensual',
        channel: 3,
        level: 3,
      });
      await actOnAnalysis(lead.id, next.id, 'Quiero contratar Ruta UNT mensual', {
        fields: [],
        action: 'proposal',
        tariffId: tariff,
      });
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.PropuestaComercial WHERE idLeadCasoEntrega=@id',
            { id: lead.id },
          )
        ).recordset[0].n,
        1,
      );
      const trialMessage = await recordIncoming(lead.id, {
        text: 'Quiero activar Explora UNT',
        channel: 3,
        level: 3,
      });
      await actOnAnalysis(lead.id, trialMessage.id, 'Quiero activar Explora UNT', {
        fields: [],
        action: 'trial',
        tariffId: null,
      });
      const reply = (
        await query(
          db,
          'SELECT TOP 1 textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 ORDER BY idMensaje DESC',
          { id: lead.id },
        )
      ).recordset[0].text;
      const trialToken = reply.match(/\/prueba\/([A-Za-z0-9_-]+)/)[1];
      await activateTrial(trialToken);
      await assert.rejects(() => activateTrial(trialToken), /válido|utilizado/);
    });
  } finally {
    await close();
  }
});
test('captación completa crea participación y agenda una sola vez; correo existente no expone vinculación', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = form();
      const first = await registerInquiry(data);
      assert.equal(first.status, 'Vinculada');
      await registerInquiry(data);
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.App_PublicInquiry WHERE requestKey=@key', {
            key: data.requestKey,
          })
        ).recordset[0].n,
        1,
      );
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.IntentoContacto i JOIN dbo.App_PublicInquiry p ON p.idLeadCaso=i.idLeadCaso WHERE p.requestKey=@key',
            { key: data.requestKey },
          )
        ).recordset[0].n,
        7,
      );
      const repeat = await registerInquiry({ ...data, requestKey: randomUUID() });
      assert.equal(repeat.status, 'Revisar identidad');
      assert.equal(repeat.telegramUrl, undefined);
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.Contacto WHERE correo=@email', {
            email: data.email,
          })
        ).recordset[0].n,
        1,
      );
    });
  } finally {
    await close();
  }
});
test('beneficiario desconocido conserva solicitud provisional sin caso ni autorización Telegram', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = { ...form(), role: 2, isStudent: false };
      const result = await registerInquiry(data);
      assert.equal(result.status, 'Completar datos');
      const row = (
        await query(
          db,
          'SELECT p.idSolicitud inquiryId,s.idSolicitud provisionalId,p.idLeadCaso,s.idEstadoSolicitud,c.idContacto FROM dbo.App_PublicInquiry p JOIN dbo.Contacto c ON c.idContacto=p.idContacto JOIN dbo.SolicitudProvisional s ON s.idSolicitud=p.idSolicitudProvisional WHERE p.requestKey=@key',
          { key: data.requestKey },
        )
      ).recordset[0];
      assert.equal(row.idLeadCaso, null);
      assert.equal(row.idEstadoSolicitud, 1);
      const completed = await registerInquiry(
        { ...data, beneficiary: `Beneficiario ${randomUUID()}` },
        { operator: true, inquiryId: row.inquiryId },
      );
      assert.ok(completed.participationId);
      assert.equal(
        (
          await query(
            db,
            'SELECT idEstadoSolicitud FROM dbo.SolicitudProvisional WHERE idSolicitud=@id',
            { id: row.provisionalId },
          )
        ).recordset[0].idEstadoSolicitud,
        2,
      );
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.App_Onboarding WHERE idContacto=@contact', {
            contact: row.idContacto,
          })
        ).recordset[0].n,
        0,
      );
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idCanal=3',
            { contact: row.idContacto },
          )
        ).recordset[0].n,
        0,
      );
    });
  } finally {
    await close();
  }
});
test('Telegram nuevo completa datos con validación, registra evidencia y respeta no autorización', async () => {
  try {
    await rollbackTest(async (db) => {
      const chat = String(Date.now());
      let sequence = Date.now();
      const replies = [];
      const client = {
        call: async (method, data) => {
          replies.push(data.text);
          return { message_id: replies.length };
        },
      };
      async function send(text) {
        const update = {
          update_id: ++sequence,
          message: {
            message_id: sequence,
            from: { id: 123, is_bot: false },
            chat: { id: chat, type: 'private' },
            text,
          },
        };
        await acceptUpdate(db, update);
        const item = (await pendingUpdates(db)).find((row) => row.updateId === update.update_id);
        await processUpdate(item, client);
        await processUpdate(item, client);
      }
      await send('/start');
      await send(`Alumno ${randomUUID()}`);
      await send('correo inválido');
      assert.match(replies.at(-1), /correo/);
      const email = `${randomUUID()}@example.test`;
      await send(email);
      await send('+51912345678');
      await send('1');
      await send('NO AUTORIZO');
      assert.match(replies.at(-1), /No se habilitó/);
      const row = (
        await query(
          db,
          "SELECT o.idContacto FROM dbo.App_Onboarding o WHERE JSON_VALUE(o.payload,'$.email')=@email",
          { email },
        )
      ).recordset[0];
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.Lead WHERE idContacto=@contact', {
            contact: row.idContacto,
          })
        ).recordset[0].n,
        0,
      );
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idEstadoAutorizacion=1',
            { contact: row.idContacto },
          )
        ).recordset[0].n,
        0,
      );
      await send('/autorizar');
      assert.match(replies.at(-1), /Registro completado/);
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.IntentoContacto i JOIN dbo.LeadCaso lc ON lc.idLeadCaso=i.idLeadCaso JOIN dbo.Lead l ON l.idLead=lc.idLead WHERE l.idContacto=@contact',
            { contact: row.idContacto },
          )
        ).recordset[0].n,
        7,
      );
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2 AND idMensajeRespondido IS NULL',
            { contact: row.idContacto },
          )
        ).recordset[0].n,
        0,
      );
    });
  } finally {
    await close();
  }
});
