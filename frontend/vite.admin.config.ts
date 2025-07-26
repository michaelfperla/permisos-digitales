import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Proxy configuration for admin development only
const adminDevelopmentProxy = {
  '/auth': {
    target: 'http://localhost:3001', // Backend server is running on port 3001
    changeOrigin: true,
    secure: false,
    configure: (proxy: any, _options: any) => {
      proxy.on('error', (err: any, _req: any, _res: any) => {
        if (process.env.NODE_ENV === 'development') console.error('Admin proxy error:', err);
      });
    },
  },
  '/admin/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    secure: false,
    rewrite: (path: string) => path.replace(/^\/admin\/api/, '/admin'),
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
};

// Admin-specific Vite configuration
export default defineConfig(({ command, mode }) => {
  const isDevelopment = mode === 'development';
  // const isProduction = mode === 'production';
  
  if (isDevelopment) {
    console.log(`🚀 Admin Vite config - Command: ${command}, Mode: ${mode}`);
    console.log(`🔗 Admin API Proxies: ${isDevelopment ? 'ENABLED' : 'DISABLED'}`);
  }
  
  return {
    base: '/admin/', // Set base path for admin assets
    appType: 'spa', // Ensure SPA routing works
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
      // Only enable proxy in development mode
      proxy: isDevelopment ? adminDevelopmentProxy : undefined,
    },
    root: '.', // Set root to current directory
    publicDir: 'public', // Public assets directory
    build: {
      outDir: 'dist-admin', // Separate output directory for admin build
      // Production minification with Terser
      minify: 'terser',
      terserOptions: {
        compress: {
          // Remove console.* statements in production
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
        },
        mangle: {
          // Mangle property names for better compression
          properties: {
            regex: /^_/
          }
        },
        format: {
          // Remove comments in production
          comments: false
        }
      },
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'admin.html')
        },
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
            'admin': ['./src/admin/main.tsx']
          }
        }
      },
      chunkSizeWarningLimit: 600
    }
  };
});