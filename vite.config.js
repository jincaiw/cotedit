import { defineConfig } from 'vite';

const exposedHost = process.env.COTEDIT_PREVIEW_HOST;
const hostAllowlist = exposedHost ? { allowedHosts: [exposedHost] } : {};

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', strictPort: true, ...hostAllowlist },
  preview: { host: '0.0.0.0', strictPort: true, ...hostAllowlist },
  build: { target: 'es2022', sourcemap: false }
});
