import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base: './'` keeps the build portable (served by the API, or from a GitHub Pages sub-path).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': process.env.VITE_DEV_API ?? 'http://localhost:8080' },
  },
});
