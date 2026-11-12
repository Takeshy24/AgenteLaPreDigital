export function integrationConfig() {
  return {
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      username: process.env.TELEGRAM_BOT_USERNAME || '',
      enabled: process.env.TELEGRAM_ENABLED === 'true',
    },
    // Proveedor principal del agente: API de OpenAI (ChatGPT). Si falta la clave o la llamada falla,
    // el agente usa Ollama local como respaldo.
    openai: {
      apiKey: (process.env.OPENAI_API_KEY || '').trim(),
      model: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
        .trim()
        .replace(/[/]+$/, ''),
      timeout: Number(process.env.OPENAI_TIMEOUT_MS || 20000),
      enabled:
        process.env.OPENAI_ENABLED !== 'false' && !!(process.env.OPENAI_API_KEY || '').trim(),
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
      credentialsTemplateName: (process.env.WHATSAPP_CREDENTIALS_TEMPLATE_NAME || '').trim(),
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
