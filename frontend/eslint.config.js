// frontend/eslint.config.js
/* eslint-disable import/order */
import js from '@eslint/js';

import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import vitestPlugin from 'eslint-plugin-vitest';
/* eslint-enable import/order */

export default tseslint.config(
  // ---- Global Ignores ----
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.DS_Store',
      'coverage/**',
      '*.log',
      'pnpm-lock.yaml', // Or package-lock.json, yarn.lock
    ],
  },

  // ---- 1. Configuration for Root-Level Config Files (.js, .ts, .cjs) ----
  {
    files: [
      '*.config.js',
      '*.config.ts',
      '*.config.cjs',
      'eslint.config.js', 
      '.prettierrc.cjs',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }, 
      parser: tseslint.parser,    
      parserOptions: {
        project: false,
        ecmaFeatures: { jsx: false },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'import': importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'off', 
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_', 
        varsIgnorePattern: '^_', 
        caughtErrorsIgnorePattern: '^ignore',
        destructuredArrayIgnorePattern: '^_', 
      }],
      '@typescript-eslint/no-var-requires': 'off',
      'import/no-extraneous-dependencies': ['error', { 
        'devDependencies': true,
        'optionalDependencies': true,
        'peerDependencies': true,
      }],
      'import/order': ['warn', { 
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always', 
        alphabetize: { order: 'asc', caseInsensitive: true },
      }], // This rule here still applies to vite.config.ts etc.
      'no-console': 'off',
      'eqeqeq': ['error', 'always'],
      'prefer-const': 'warn',
    },
    settings: {
      'import/resolver': {
        node: true,
        typescript: { project: ['./tsconfig.json'], alwaysTryTypes: true },
      },
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
    },
  },

  // ---- 2. Main Application Code Configuration (src/**/*.{ts,tsx}) ----
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser }, 
      parser: tseslint.parser,      
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: ['./tsconfig.app.json'], 
        tsconfigRootDir: import.meta.dirname,
        noWarnOnMultipleProjects: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'import': importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.eslintRecommended.rules,
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs.recommendedTypeChecked.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,

      'no-unused-vars': 'off', 
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_', 
        varsIgnorePattern: '^_', 
        caughtErrorsIgnorePattern: '^ignore',
        destructuredArrayIgnorePattern: '^_',
      }],

      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'import/order': ['warn', {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'object', 'type'],
        pathGroups: [{ pattern: '@/**', group: 'internal', position: 'before' }],
        pathGroupsExcludedImportTypes: ['builtin', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],
      'import/no-duplicates': 'error', 
      'import/first': 'error',         
      'import/newline-after-import': 'warn',
      'import/no-useless-path-segments': 'warn',
      'import/no-extraneous-dependencies': ['error', { 'devDependencies': false }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'eqeqeq': ['error', 'always'],
      'prefer-const': 'warn',
    },
    settings: {
      react: { version: 'detect' },
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: ['./tsconfig.app.json'] },
        node: true,
      },
    },
  },

  // ---- 3. Configuration for Test Files ----
  {
    files: [
      'src/**/*.test.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
      'src/test/**/*.{ts,tsx}',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...vitestPlugin.environments.env.globals }, 
      parser: tseslint.parser,                               
      parserOptions: {
        project: false, 
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'vitest': vitestPlugin,
      'import': importPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.eslintRecommended.rules,
      ...tseslint.configs.recommended.rules, 
      ...vitestPlugin.configs.recommended.rules,

      'no-unused-vars': 'off', 
      '@typescript-eslint/no-unused-vars': ['warn', { 
        varsIgnorePattern: '^_', 
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^ignore',
        destructuredArrayIgnorePattern: '^_',
      }],

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'import/no-extraneous-dependencies': ['error', { 'devDependencies': true }],
    },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: ['./tsconfig.json'] }, 
        node: true,
      },
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
    },
  },

  // ---- Prettier Configuration (MUST BE LAST) ----
  prettierConfig, 
);