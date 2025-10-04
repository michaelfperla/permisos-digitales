import { resolve } from 'path'
import { existsSync, renameSync } from 'fs'

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
    base: '/admin/',
    appType: 'spa', // Ensure SPA routing works
    css: {
      modules: {
        // Enable CSS modules for all .module.css files
        localsConvention: 'camelCase',
        generateScopedName: '[local]_[hash:base64:5]',
      },
    },
    plugins: [
      react(),
      // Custom plugin to rename admin.html to index.html for clean URLs
      {
        name: 'rename-admin-html',
        writeBundle(options, bundle) {
          // This runs after files are written - rename the actual file
          const outDir = options.dir || 'dist-admin';
          const adminHtmlPath = resolve(outDir, 'admin.html');
          const indexHtmlPath = resolve(outDir, 'index.html');
          
          if (existsSync(adminHtmlPath)) {
            renameSync(adminHtmlPath, indexHtmlPath);
            console.log('✅ Renamed admin.html to index.html');
          } else {
            console.log('⚠️ admin.html not found at:', adminHtmlPath);
          }
        }
      }
    ],
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
          // Keep console.* statements for debugging
          drop_console: false,
          drop_debugger: false,
          pure_funcs: []
        },
        mangle: {
          // Don't mangle properties to preserve displayName
          properties: false
        },
        format: {
          // Keep comments for debugging
          comments: true
        }
      },
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'admin.html')
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
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