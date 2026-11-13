export interface LandingReceipt {
  registered: true;
  recorded: true;
  telegramUrl: string;
  whatsappUrl: string;
  telegramLinkExpires: boolean;
  emailed: boolean;
  telegramEmail: 'sent' | 'pending' | 'failed' | '';
}
export function confirmedReceipt(payload: unknown): LandingReceipt {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('registered' in payload) ||
    payload.registered !== true ||
    !('recorded' in payload) ||
    payload.recorded !== true
  )
    throw new Error(
      'El servidor no confirmó el registro. No se mostrará un comprobante hasta que la solicitud quede guardada.',
    );
  const value = payload as Record<string, unknown>;
  const telegramUrl =
    typeof value.telegramUrl === 'string' &&
    /^https:\/\/t\.me\/[A-Za-z0-9_]+(\?start=[A-Za-z0-9_-]+)?$/.test(value.telegramUrl)
      ? value.telegramUrl
      : '';
  const whatsappUrl =
    typeof value.whatsappUrl === 'string' &&
    /^https:\/\/wa\.me\/[0-9]{8,15}(\?text=[A-Za-z0-9%._~-]*)?$/.test(value.whatsappUrl)
      ? value.whatsappUrl
      : '';
  return {
    registered: true,
    recorded: true,
    telegramUrl,
    whatsappUrl,
    telegramLinkExpires: value.telegramLinkExpires === true && telegramUrl.includes('?start='),
    emailed: value.emailed === true,
    telegramEmail:
      value.telegramEmail === 'sent' ||
      value.telegramEmail === 'pending' ||
      value.telegramEmail === 'failed'
        ? value.telegramEmail
        : '',
  };
}
