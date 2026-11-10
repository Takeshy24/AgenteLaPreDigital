import assert from 'node:assert/strict';
import test from 'node:test';
import { close, pool, query, rollbackTest } from './db.mjs';
import { createLead } from './leads/service.mjs';
import { recordIncoming } from './messages/service.mjs';
import { saveProfile as updateProfile } from './profiles/service.mjs';
import {
  prepareProposal,
  recordProposalResponse as proposalResponse,
} from './proposals/service.mjs';
import { saveConsent as consent } from './consents/service.mjs';
test('SQL Server: captación, idempotencia, perfil auditado, reglas y propuesta; rollback obligatorio', async () => {
  const email = `integration-${Date.now()}@example.test`;
  try {
    await rollbackTest(async (db) => {
      const payload = {
        name: 'Prueba integración',
        email,
        phone: '',
        role: 1,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      };
      const first = await createLead(payload);
      assert.ok(first.id > 0);
      assert.equal((await createLead(payload)).id, first.id);
      assert.equal(
        (await query(db, 'SELECT COUNT(*) n FROM dbo.IntentoContacto WHERE idLeadCaso=@id', first))
          .recordset[0].n,
        7,
      );
      const message = await recordIncoming(first.id, {
        text: '¿Cuánto cuesta Meta UNT?',
        channel: 2,
        level: 2,
      });
      assert.equal(
        (
          await query(
            db,
            'SELECT idPrioridadActual p FROM dbo.LeadCaso WHERE idLeadCaso=@id',
            first,
          )
        ).recordset[0].p,
        3,
      );
      await updateProfile(first.id, { fields: { career: 'Medicina', budget: 80 }, channel: 2 });
      assert.equal(
        (await query(db, 'SELECT COUNT(*) n FROM dbo.CambioPerfil WHERE idLeadCaso=@id', first))
          .recordset[0].n,
        2,
      );
      const tariff = (
        await query(
          db,
          'SELECT TOP 1 idPlanTarifa id,precio FROM dbo.PlanTarifa ORDER BY idPlanTarifa',
        )
      ).recordset[0];
      const proposal = await prepareProposal(first.id, {
        tariff: tariff.id,
        replyTo: message.id,
        channel: 2,
        justification: 'Perfil actualizado y presupuesto declarado.',
      });
      const persisted = (
        await query(
          db,
          'SELECT precioAutorizado price FROM dbo.PropuestaComercial WHERE idPropuesta=@id',
          proposal,
        )
      ).recordset[0];
      assert.equal(persisted.price, tariff.precio);
      await assert.rejects(
        () => proposalResponse(proposal.id, { messageId: message.id, result: 1 }),
        /entrega confirmada/,
      );
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.Contratacion WHERE idCaso=(SELECT idCaso FROM dbo.LeadCaso WHERE idLeadCaso=@id)',
            first,
          )
        ).recordset[0].n,
        0,
      );
      await consent(first.id, { channel: 2, granted: false, version: 'test' });
      assert.equal(
        (
          await query(
            db,
            'SELECT idEstadoParticipacion s FROM dbo.LeadCaso WHERE idLeadCaso=@id',
            first,
          )
        ).recordset[0].s,
        2,
      );
      await consent(first.id, { channel: 2, granted: true, version: 'test' });
      assert.equal(
        (await query(db, 'SELECT COUNT(*) n FROM dbo.IntentoContacto WHERE idLeadCaso=@id', first))
          .recordset[0].n,
        7,
      );
    });
    assert.equal(
      (
        await query(await pool(), 'SELECT COUNT(*) n FROM dbo.Contacto WHERE correo=@email', {
          email,
        })
      ).recordset[0].n,
      0,
    );
  } finally {
    await close();
  }
});
