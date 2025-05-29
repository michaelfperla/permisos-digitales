import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Admin-specific Vite configuration
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
    port: 3003, // Use different port for admin development
    proxy: {
      // Industry standard: proxy all API calls to backend (clean subdomain routing in dev)
      '/auth': {
        target: 'http://localhost:3001', // Backend server is running on port 3001
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('Admin proxy error:', err);
          });
        },
      },
      '/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
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
      '/status': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist-admin', // Separate output directory for admin build
    rollupOptions: {
      input: {
        admin: resolve(__dirname, 'admin.html')
      },
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'admin': ['./src/admin/main.tsx']
        }
      }
    }
  }
})
