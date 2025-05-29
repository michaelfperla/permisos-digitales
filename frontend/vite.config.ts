import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  css: {
    modules: {
      // Enable CSS modules for all .module.css files
      localsConvention: 'camelCase',
      generateScopedName: '[local]_[hash:base64:5]',
    },
  },
  plugins: [react()],
  server: {
    port: 3002, // Use port 3002 for the frontend to avoid conflicts
    proxy: {
      // Industry standard: proxy all API calls to backend (clean subdomain routing in dev)
      '/auth': {
        target: 'http://localhost:3001', // Backend server is running on port 3001
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          // Always log proxy errors (critical information)
          proxy.on('error', (err, _req, _res) => {
            console.error('Proxy error:', err);
          });

          // Conditional logging for request/response details (development only)
          // To enable, run your dev server like: DEBUG_PROXY=true npm run dev
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
        // Remove admin from main build - it should be deployed separately
        // admin: resolve(__dirname, 'admin.html')
      },
      output: {
        manualChunks: (id) => {
          // Vendor dependencies - split into smaller chunks
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

          // Split by feature areas
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
    // Increase chunk size warning limit since we're splitting more
    chunkSizeWarningLimit: 600
  }
})
