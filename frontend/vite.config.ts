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
      '/api': {
        target: 'http://localhost:3001', // Backend server is running on port 3001
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          // Always log proxy errors (critical information)
          proxy.on('error', (err, _req, _res) => {
            console.error('Proxy error:', err); // Use console.error for errors
          });

          // Conditional logging for request/response details
          // To enable, run your dev server like: DEBUG_PROXY=true npm run dev
          const DEBUG_PROXY = process.env.VITE_DEBUG_PROXY === 'true' || process.env.DEBUG_PROXY === 'true';

          if (DEBUG_PROXY) {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log(`[Proxy Req]: ${req.method} ${req.url}`);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log(`[Proxy Res]: ${proxyRes.statusCode} ${req.url}`);
            });
          }
        },
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      },
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'admin': ['./src/admin/main.tsx'],
          'client': ['./src/main.tsx']
        }
      }
    }
  }
})
