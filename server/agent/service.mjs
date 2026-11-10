import { transaction } from '../db.mjs';
import { getOpenHandoff } from '../handoffs/repository.mjs';
import { openHandoff } from '../handoffs/service.mjs';
import { createReply } from '../integrations/repository.mjs';
import { saveProfile } from '../profiles/service.mjs';
import { prepareProposal } from '../proposals/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { getWorkspace } from '../workspace/repository.mjs';
export function handoffReason(text) {
  const value = text.toLowerCase();
  if (/reembolso|devoluci[oó]n/.test(value)) return 3;
  if (/disputa|contracargo/.test(value)) return 4;
  if (/descuento|beca/.test(value)) return 6;
  if (/hablar.*(persona|asesor|humano)|atienda.*persona/.test(value)) return 1;
  if (/reclamo|queja/.test(value)) return 2;
  if (/pag[ué]|ya pag|pago no/.test(value)) return 5;
  return null;
}
export async function actOnAnalysis(participationId, messageId, text, analysis) {
  const workspace = await getWorkspace();
  const contact = workspace.leads.find((lead) => lead.id === participationId);
  if (!contact) return;
  const reason = handoffReason(text) || (analysis.action === 'handoff' ? 7 : null);
  if (reason) {
    await openHandoff(participationId, { reason, messageId });
    return;
  }
  return transaction(async (db) => {
    const participation = await getParticipation(db, participationId);
    const handoff = await getOpenHandoff(db, participation.idContacto);
    if (handoff && !handoff.fechaRetomaAgente) return;
    if (participation.idEstadoCaso === 1 && analysis.fields.length) {
      const fields = Object.fromEntries(
        analysis.fields.map((item) => [
          item.field,
          item.field === 'budget' ? Number(item.value) : item.value,
        ]),
      );
      await saveProfile(participationId, { fields, channel: 3 }, { messageId });
    }
    if (participation.idEstadoCaso === 1 && analysis.action === 'proposal' && analysis.tariffId) {
      return prepareProposal(
        participationId,
        {
          tariff: analysis.tariffId,
          replyTo: messageId,
          channel: 3,
          justification: `Preparación según el contexto declarado por ${contact.name}. Carrera: ${contact.career || 'pendiente de confirmar'}.`,
        },
        { agent: true },
      );
    }
    let response =
      'Gracias por escribir. ¿Qué carrera deseas preparar para la UNT y qué cursos te gustaría reforzar?';
    if (analysis.action === 'catalog')
      response =
        'Estas son las tarifas vigentes por periodo contratado:\n' +
        workspace.tariffs
          .map(
            (tariff) =>
              `${tariff.plan} · ${tariff.modalidad}: S/ ${Number(tariff.precio).toFixed(2)}`,
          )
          .join('\n') +
        '\n¿Sobre qué alternativa necesitas más información?';
    if (analysis.action === 'trial')
      response =
        'Explora UNT ofrece una prueba gratuita de 14 días, una sola vez por beneficiario identificado. Solicita el enlace de activación a tu asesor.';
    await createReply(db, participation, response, messageId);
  });
}
