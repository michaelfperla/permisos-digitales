import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// WSL-aware proxy configuration for development
const getProxyTarget = () => {
  // Check if running in WSL environment
  const isWSL = process.env.WSL_ENVIRONMENT === 'true' || 
                process.env.WSL_DISTRO_NAME ||
                (process.platform === 'linux' && require('fs').existsSync('/proc/version') && 
                 require('fs').readFileSync('/proc/version', 'utf8').includes('microsoft'));
  
  // Use explicit API URL if provided, otherwise default to localhost
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔗 Proxy target: ${apiUrl} ${isWSL ? '(WSL detected)' : '(Native)'}`);  
  }
  return apiUrl;
};

// Proxy configuration for development only
const developmentProxy = {
  '/auth': {
    target: getProxyTarget(),
    changeOrigin: true,
    secure: false,
    configure: (proxy: any, _options: any) => {
      proxy.on('error', (err: any, _req: any, _res: any) => {
        if (process.env.NODE_ENV === 'development') console.error('Proxy error:', err);
      });

      const DEBUG_PROXY = process.env.VITE_DEBUG_PROXY === 'true' || process.env.DEBUG_PROXY === 'true';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- import.meta typing is complex in Vite config context
      if (DEBUG_PROXY && (import.meta as any).env?.DEV !== false) {
        proxy.on('proxyReq', (_proxyReq: any, req: any, _res: any) => {
          console.log(`[Proxy Req]: ${req.method} ${req.url}`);
        });
        proxy.on('proxyRes', (proxyRes: any, req: any, _res: any) => {
          console.log(`[Proxy Res]: ${proxyRes.statusCode} ${req.url}`);
        });
      }
    },
  },
  '/applications': {
    target: getProxyTarget(),
    changeOrigin: true,
    secure: false,
  },
  '/user': {
    target: getProxyTarget(),
    changeOrigin: true,
    secure: false,
  },
  '/admin': {
    target: getProxyTarget(),
    changeOrigin: true,
    secure: false,
  },
  '/payments': {
    target: getProxyTarget(),
    changeOrigin: true,
    secure: false,
  },
  '/notifications': {
    target: getProxyTarget(),
    changeOrigin: true,
    secure: false,
  },
  '/status': {
    target: getProxyTarget(),
    changeOrigin: true,
    secure: false,
  }
};

export default defineConfig(({ command, mode }) => {
  const isDevelopment = mode === 'development';
  const isProduction = mode === 'production';
  
  if (isDevelopment) {
    console.log(`🚀 Vite config - Command: ${command}, Mode: ${mode}`);
    console.log(`🔗 API Proxies: ${isDevelopment ? 'ENABLED' : 'DISABLED'}`);
  }
  
  return {
    css: {
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: '[local]_[hash:base64:5]',
      },
    },
    plugins: [react()],
    server: {
      port: parseInt(process.env.VITE_PORT || '3002'),
      host: process.env.VITE_HOST || '0.0.0.0', // Always bind to 0.0.0.0 for WSL/Windows access
      // Only enable proxy in development mode
      proxy: isDevelopment ? developmentProxy : undefined,
      // WSL-specific server options
      strictPort: false, // Allow port fallback if 3002 is taken
      cors: true, // Enable CORS for cross-origin requests
    },
    build: {
    // Enable source maps for production debugging
    sourcemap: isProduction ? 'hidden' : true,
    // Production minification - use esbuild for safer minification
    minify: isProduction ? 'esbuild' : false,
    // Remove console logs and debugger statements in production
    esbuildOptions: isProduction ? {
      drop: ['console', 'debugger'],
    } : {},
    // ESBuild is faster and less aggressive than Terser, avoiding initialization issues
    rollupOptions: {
      external: isProduction ? [
        /\.test\.(ts|tsx|js|jsx)$/,
        /\.spec\.(ts|tsx|js|jsx)$/,
        /__tests__/,
        /__mocks__/,
        /vitest/,
        /playwright/,
        /axiosMock/
      ] : [],
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: (id) => {
          // Exclude design system and test files in production
          if (isProduction && (
            id.includes('DesignSystemDemo') || 
            id.includes('DesignSystemV2') || 
            id.includes('DesignSystemV3') ||
            id.includes('/pages/DesignSystemV3/') ||
            id.includes('.test.') ||
            id.includes('.spec.') ||
            id.includes('__tests__') ||
            id.includes('__mocks__') ||
            id.includes('/test/') ||
            id.includes('/tests/') ||
            id.includes('vitest') ||
            id.includes('playwright') ||
            id.includes('Mock') ||
            id.includes('mock')
          )) {
            return; // Don't include in any chunk
          }

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

          // Put utilities and shared modules first to prevent circular dependencies
          if (id.includes('/utils/') || id.includes('/shared/')) {
            return 'shared-utils';
          }
          
          // Services should come before components to ensure proper initialization
          if (id.includes('/services/')) {
            return 'services';
          }
          if (id.includes('/components/')) {
            return 'components';
          }
          if (id.includes('/pages/')) {
            return 'pages';
          }
        }
      }
    },
      chunkSizeWarningLimit: 600
    }
  };
});
