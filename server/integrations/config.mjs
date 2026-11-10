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
  };
}
