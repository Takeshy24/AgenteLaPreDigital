import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const { PORT } = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', proxy: { '/api': `http://127.0.0.1:${PORT || 3067}` } },
  };
});
