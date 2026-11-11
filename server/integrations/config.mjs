export function integrationConfig() {
  return {
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      username: process.env.TELEGRAM_BOT_USERNAME || '',
      enabled: process.env.TELEGRAM_ENABLED === 'true',
    },
    ollama: {
      url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
      enabled: process.env.OLLAMA_ENABLED === 'true',
    },
    followup: {
      enabled: process.env.FOLLOWUP_ENABLED === 'true',
      interval: Number(process.env.FOLLOWUP_INTERVAL_MS || 60000),
    },
    whatsapp: {
      enabled: process.env.WHATSAPP_ENABLED === 'true',
      token: (process.env.WHATSAPP_TOKEN || '').trim(),
      phoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
      appSecret: (process.env.WHATSAPP_APP_SECRET || '').trim(),
      verifyToken: (process.env.WHATSAPP_VERIFY_TOKEN || '').trim(),
      apiVersion: (process.env.WHATSAPP_API_VERSION || 'v21.0').trim(),
      templateName: (process.env.WHATSAPP_TEMPLATE_NAME || 'hello_world').trim(),
      templateLanguage: (process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US').trim(),
    },
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      user: (process.env.SMTP_USER || '').trim(),
      password: (process.env.SMTP_PASSWORD || '').replace(/\s/g, ''),
      from: (process.env.SMTP_FROM || '').trim(),
    },
  };
}
