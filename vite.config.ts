import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2020' },

  /**
   * El fondo animado se carga con `import()` diferido, así que el escaneo
   * inicial de Vite no ve React y lo pre-optimiza más tarde, en caliente. Eso
   * deja dos instancias de React conviviendo y cualquier hook falla con
   * «Invalid hook call». Declararlas por adelantado fuerza una sola.
   */
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-runtime', '@paper-design/shaders-react'],
  },

  test: { environment: 'jsdom' },
});
