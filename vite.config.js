import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const webAppUrl = env.VITE_WEB_APP_URL || env.WEB_APP_URL || '';

  return {
    base: './',
    plugins: [react()],
    define: {
      __WEB_APP_URL__: JSON.stringify(webAppUrl),
    },
    server: {
      port: 3000,
      open: true,
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
  };
});
