import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for library mode — produces a single IIFE bundle
// that can be loaded via a <script> tag on any website
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'MapleWidget',
      fileName: () => 'maple-widget.js',
      formats: ['iife'],
    },
    rollupOptions: {
      // Bundle everything — no external deps for the standalone script
    },
    cssCodeSplit: false, // Inline CSS into the JS bundle
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging in v1
      },
    },
    // Target: small bundle (< 150KB gzipped per spec)
    target: 'es2020',
    outDir: 'dist',
  },
  // Dev server for testing
  server: {
    port: 5173,
    open: '/test.html',
  },
});
