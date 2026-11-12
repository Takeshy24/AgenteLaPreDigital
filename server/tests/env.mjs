// Las pruebas automáticas nunca llaman a OpenAI: usan Ollama local o dobles de prueba.
process.env.OPENAI_ENABLED = 'false';
