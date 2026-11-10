import { transaction } from '../db.mjs';
import { saveLead } from '../leads/service.mjs';

const LANDING_CAPTURE_CHANNEL = 1;

// Acepta 987654321 (se asume Perú) o un número internacional con +. Devuelve null si no es válido.
export function normalizePhone(value) {
  const digits = String(value).replace(/[\s\-().]/g, '');
  if (/^9\d{8}$/.test(digits)) return '+51' + digits;
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  return null;
}

export async function registerLanding(data) {
  if (data.website) return { registered: true };
  await transaction((db) =>
    saveLead(
      db,
      {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        channel: LANDING_CAPTURE_CHANNEL,
        communicationChannel: data.channels[0],
        consent: true,
        beneficiaryName: data.beneficiaryName,
      },
      { channels: [...new Set(data.channels)], reviewNameMatches: true },
    ),
  );
  return { registered: true };
}
