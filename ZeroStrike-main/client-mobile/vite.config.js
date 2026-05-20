import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  base: '/mobile/',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html')
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/mobile': { target: 'http://localhost:3000' },
      '/map': { target: 'http://localhost:3000' }
    }
  }
});
