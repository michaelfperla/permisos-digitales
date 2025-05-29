import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[local]_[hash:base64:5]',
    },
  },
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('Proxy error:', err);
          });

          const DEBUG_PROXY = process.env.VITE_DEBUG_PROXY === 'true' || process.env.DEBUG_PROXY === 'true';

          if (DEBUG_PROXY && (import.meta as any).env?.DEV !== false) {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log(`[Proxy Req]: ${req.method} ${req.url}`);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log(`[Proxy Res]: ${proxyRes.statusCode} ${req.url}`);
            });
          }
        },
      },
      '/applications': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/user': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/payments': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/notifications': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/status': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('axios')) {
              return 'vendor-http';
            }
            if (id.includes('zod') || id.includes('react-hook-form')) {
              return 'vendor-forms';
            }
            if (id.includes('react-icons')) {
              return 'vendor-icons';
            }
            return 'vendor-other';
          }

          if (id.includes('/pages/')) {
            return 'pages';
          }
          if (id.includes('/components/')) {
            return 'components';
          }
          if (id.includes('/services/')) {
            return 'services';
          }
          if (id.includes('/shared/')) {
            return 'shared';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
