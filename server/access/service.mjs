import { integrationConfig } from '../integrations/config.mjs';
import { insideServiceWindow } from '../integrations/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { createPassword, hashPassword, sealMessage } from './crypto.mjs';
import * as repository from './repository.mjs';

export async function requireDelivery(db, target) {
  if (!target || ![1, 2, 3].includes(target.channel))
    throw new BusinessError(
      'La propuesta no identifica un canal de contacto para las credenciales.',
    );
  const authorization = await repository.getAuthorization(db, target.idContacto, target.channel);
  if (!authorization)
    throw new BusinessError(
      'El contacto debe autorizar el canal de la contratación para recibir su acceso.',
    );
  const config = integrationConfig();
  if (
    target.channel === 3 &&
    (!config.telegram.enabled || !config.telegram.token || !target.chatId)
  )
    throw new BusinessError(
      'Telegram debe estar configurado y vinculado al contacto antes de habilitar.',
    );
  if (target.channel === 2 && (!config.smtp.user || !config.smtp.password || !target.correo))
    throw new BusinessError(
      'Configura el correo SMTP antes de enviar las credenciales por correo.',
    );
  if (target.channel === 1) {
    if (
      !config.whatsapp.enabled ||
      !config.whatsapp.token ||
      !config.whatsapp.phoneNumberId ||
      !target.telefono
    )
      throw new BusinessError('Configura WhatsApp antes de enviar las credenciales por ese canal.');
    if (
      !(await insideServiceWindow(db, target.idContacto)) &&
      (!config.whatsapp.credentialsTemplateName ||
        config.whatsapp.credentialsTemplateName === 'hello_world')
    )
      throw new BusinessError(
        'WhatsApp requiere una conversación reciente o una plantilla de credenciales aprobada.',
      );
  }
  return authorization;
}

export async function prepareAccess(db, { caseId, contractId, operator }) {
  const existing = await repository.getAccess(db, contractId);
  if (existing) return { username: existing.username, messageId: existing.idMensajeCredenciales };
  const target = await repository.getTarget(db, caseId);
  const authorization = await requireDelivery(db, target);
  let user = await repository.getUser(db, target.idBeneficiario);
  let password;
  if (!user) {
    password = createPassword();
    const username = `estudiante.${target.idBeneficiario}`;
    const userId = await repository.createUser(
      db,
      target.idBeneficiario,
      username,
      await hashPassword(password),
    );
    user = { idUsuario: userId, nombreUsuario: username, activo: true };
  }
  if (!user.activo)
    throw new BusinessError('La cuenta del beneficiario está desactivada; revisa su acceso.');
  const text = [
    `LaPreDigital · Datos de acceso para ${target.beneficiary}`,
    `Usuario: ${user.nombreUsuario}`,
    password
      ? `Clave provisional: ${password}`
      : 'Tu cuenta ya existe. Conserva tu contraseña actual.',
    'Guarda estos datos de forma privada. No los compartas con terceros.',
  ].join('\n');
  const payload = sealMessage(text, contractId);
  const messageId = await repository.insertMessage(db, target, authorization, operator);
  await repository.insertAccess(db, {
    contractId,
    userId: user.idUsuario,
    contact: target.idContacto,
    channel: target.channel,
    messageId,
    payload,
  });
  return { username: user.nombreUsuario, messageId };
}

export async function retryDelivery(db, { caseId, contractId, operator }) {
  const access = await repository.getAccess(db, contractId);
  if (!access) throw new BusinessError('Este caso no tiene credenciales preparadas.');
  if (access.idEstadoEntrega === 2) return { queued: false, delivered: true };
  if (access.dispatchState === 'unknown')
    throw new BusinessError(
      'La entrega es incierta. Comprueba el canal antes de solicitar otro envío.',
    );
  if (access.idEstadoEntrega !== 3) return { queued: true };
  if (!access.mensajeCifrado)
    throw new BusinessError('El contenido confidencial ya no está disponible.');
  const target = await repository.getTarget(db, caseId);
  if (
    !target ||
    target.idContacto !== access.idContactoEntrega ||
    target.channel !== access.idCanalEntrega
  )
    throw new BusinessError(
      'El destinatario de la contratación cambió; revisa el caso antes de reenviar.',
    );
  const authorization = await requireDelivery(db, target);
  const messageId = await repository.insertMessage(db, target, authorization, operator);
  await repository.replaceDelivery(db, contractId, messageId);
  return { queued: true };
}
