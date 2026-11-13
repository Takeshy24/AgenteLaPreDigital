import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { close, query, rollbackTest } from '../db.mjs';
import { createLead } from '../leads/service.mjs';
import { inviteGuardian } from '../links/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { acceptPublicInvitation, viewInvitation } from '../public/invitations.mjs';
import { askChannelConsent } from '../agent/consent-prompt.mjs';
import { getParticipation } from '../shared/repository.mjs';

process.env.SMTP_PASSWORD = '';
process.env.WHATSAPP_PUBLIC_NUMBER = '987654321';
process.env.TELEGRAM_BOT_USERNAME = 'bot_prueba';

async function invitation() {
  const suffix = randomUUID();
  const lead = await createLead({
    name: `Alumno ${suffix}`,
    email: `${suffix}@example.test`,
    phone: '+51912345678',
    role: 1,
    channel: 5,
    communicationChannel: 1,
    consent: true,
  });
  const message = await recordIncoming(lead.id, { text: 'Mi tío paga', channel: 1, level: 1 });
  return inviteGuardian(lead.id, {
    name: 'Carlos Ruiz',
    phone: '+51976543210',
    role: 4,
    messageId: message.id,
  });
}

for (const channels of [[1, 3], [2]]) {
  test(`la invitación ofrece ambos chats al aceptar y al recargar; respeta los canales ${channels}`, async () => {
    try {
      await rollbackTest(async (db) => {
        const { code } = await invitation();
        const before = await viewInvitation(code);
        assert.match(before.whatsappUrl, /^https:\/\/wa.me\/51987654321\?/);
        assert.equal(before.telegramUrl, 'https://t.me/bot_prueba');
        const email = `${randomUUID()}@example.test`;
        const data = {
          name: 'Carlos Ruiz',
          email,
          phone: '+51976543210',
          channels,
          contactConsent: true,
          linkConsent: true,
        };
        for (const denied of [{ contactConsent: false }, { linkConsent: false }]) {
          await assert.rejects(
            () => acceptPublicInvitation(code, { ...data, ...denied }),
            /ambas autorizaciones/,
          );
          assert.equal((await viewInvitation(code)).accepted, false);
          assert.equal(
            (await query(db, 'SELECT COUNT(*) n FROM dbo.Contacto WHERE correo=@email', { email }))
              .recordset[0].n,
            0,
          );
        }
        const accepted = await acceptPublicInvitation(code, data);
        assert.equal(accepted.accepted, true);
        assert.equal(accepted.whatsappUrl, before.whatsappUrl);
        assert.ok(accepted.telegramUrl.startsWith('https://t.me/bot_prueba'));
        if (channels.includes(3)) assert.match(accepted.telegramUrl, /\?start=/);
        else assert.equal(accepted.telegramUrl, before.telegramUrl);
        const after = await viewInvitation(code);
        assert.equal(after.accepted, true);
        assert.equal(after.whatsappUrl, before.whatsappUrl);
        assert.equal(after.telegramUrl, before.telegramUrl);
        const grants = (
          await query(
            db,
            `SELECT a.idCanal, a.idOrigenAutorizacion origin, a.versionTexto version FROM dbo.AutorizacionContacto a
JOIN dbo.Contacto c ON c.idContacto=a.idContacto
WHERE c.correo=@email AND a.idEstadoAutorizacion=1 ORDER BY a.idCanal`,
            { email },
          )
        ).recordset;
        assert.deepEqual(
          grants.map((row) => row.idCanal),
          channels,
        );
        assert.ok(grants.every((grant) => grant.origin === 2 && grant.version === 'invitacion-v1'));
        const participant = (
          await query(
            db,
            `SELECT lc.idLeadCaso id FROM dbo.Contacto c
          INNER JOIN dbo.Lead l ON l.idContacto=c.idContacto
          INNER JOIN dbo.LeadCaso lc ON lc.idLead=l.idLead WHERE c.correo=@email`,
            { email },
          )
        ).recordset[0];
        const incoming = await recordIncoming(participant.id, {
          text: 'Hola',
          channel: 1,
          level: 1,
        });
        const asked = await askChannelConsent(
          db,
          await getParticipation(db, participant.id),
          1,
          incoming.id,
        );
        // La autorización del invitante no se transfiere al familiar; basta la suya si la dio en el enlace.
        assert.equal(asked, !channels.includes(1));
      });
    } finally {
      await close();
    }
  });
}
