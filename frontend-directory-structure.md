# Frontend Directory Structure

## Project Overview
This document provides a comprehensive overview of the frontend project structure for the Permisos Digitales application. The application is built using React, TypeScript, and Vite, with a focus on mobile-first design and responsive UI components.

## Directory Tree

```
frontend/
├── public/                      # Static assets served directly by the web server
│   ├── favicon.svg             # Site favicon
│   ├── offline.html            # Offline fallback page
│   └── service-worker.js       # Service worker for PWA functionality
│
├── src/                         # Source code for the application
│   ├── admin/                  # Admin panel specific code
│   │   ├── components/         # Admin-specific UI components
│   │   ├── contexts/           # Admin-specific context providers
│   │   ├── hooks/              # Admin-specific custom hooks
│   │   ├── layouts/            # Admin-specific layout components
│   │   ├── pages/              # Admin panel pages
│   │   ├── services/           # Admin-specific API services
│   │   ├── App.tsx             # Admin application entry point
│   │   └── main.tsx            # Admin application bootstrap
│   │
│   ├── components/             # Shared UI components
│   │   ├── auth/               # Authentication-related components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   ├── forms/              # Form-related components
│   │   ├── layout/             # Layout components (headers, footers, etc.)
│   │   ├── mobile/             # Mobile-specific components
│   │   ├── navigation/         # Navigation components (breadcrumbs, menus)
│   │   ├── payment/            # Payment-related components
│   │   ├── permit/             # Permit-related components
│   │   ├── permit-form/        # Permit form components
│   │   └── ui/                 # Core UI components (buttons, inputs, etc.)
│   │
│   ├── constants/              # Application constants and enums
│   │
│   ├── contexts/               # React context providers
│   │   ├── AuthContext.tsx     # Authentication context
│   │   └── ToastContext.tsx    # Toast notification context
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts          # Authentication hook
│   │   ├── useBreadcrumbs.ts   # Breadcrumbs navigation hook
│   │   ├── useMediaQuery.ts    # Responsive design media query hook
│   │   └── useResponsive.ts    # Responsive design utilities
│   │
│   ├── layouts/                # Page layout components
│   │   ├── AuthLayout.tsx      # Layout for authentication pages
│   │   ├── HomeLayout.tsx      # Layout for the home page
│   │   ├── MainLayout.tsx      # Main application layout
│   │   └── VerificationLayout.tsx # Layout for verification pages
│   │
│   ├── pages/                  # Application pages
│   │   ├── HomePage.tsx        # Landing page
│   │   ├── LoginPage.tsx       # Login page
│   │   ├── RegisterPage.tsx    # Registration page
│   │   ├── DashboardPage.tsx   # User dashboard
│   │   └── ...                 # Other application pages
│   │
│   ├── services/               # API services
│   │   ├── api.ts              # Base API configuration
│   │   ├── authService.ts      # Authentication service
│   │   ├── applicationService.ts # Permit application service
│   │   └── userService.ts      # User management service
│   │
│   ├── styles/                 # Global styles and CSS variables
│   │   ├── variables.css       # CSS variables for design tokens
│   │   ├── global.css          # Global styles
│   │   ├── reset.css           # CSS reset
│   │   ├── button-styles.css   # Global button styles
│   │   └── ...                 # Other global style files
│   │
│   ├── test/                   # Test utilities and mocks
│   │   ├── mocks/              # Mock data and services for testing
│   │   ├── setup.ts            # Test setup configuration
│   │   └── test-utils.tsx      # Test utility functions
│   │
│   ├── types/                  # TypeScript type definitions
│   │   ├── application.types.ts # Application-related types
│   │   └── permisos.ts         # Permit-related types
│   │
│   ├── utils/                  # Utility functions
│   │   ├── validation.ts       # Form validation utilities
│   │   ├── permit-validation.ts # Permit-specific validation
│   │   └── ...                 # Other utility functions
│   │
│   ├── App.tsx                 # Main application component
│   └── main.tsx                # Application entry point
│
├── .env.local                  # Local environment variables
├── .gitignore                  # Git ignore file
├── admin.html                  # Admin panel HTML entry
├── eslint.config.js            # ESLint configuration
├── index.html                  # Main HTML entry
├── package.json                # Project dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration
└── vitest.config.ts            # Vitest test configuration
```

## Directory Descriptions

### `/public`
Contains static assets that are served directly by the web server. Includes the favicon, offline page for PWA support, and service worker for offline functionality.

### `/src/admin`
Contains all code specific to the admin panel. This is a separate application within the project with its own components, contexts, and services tailored for administrative functions.

### `/src/components`
Houses all reusable UI components organized by functionality. Contains both shared components used throughout the application and specialized components for specific features.

### `/src/constants`
Defines application-wide constants, enums, and configuration values to maintain consistency across the codebase.

### `/src/contexts`
Contains React context providers that manage global state across the application, such as authentication state and toast notifications.

### `/src/hooks`
Custom React hooks that encapsulate reusable logic, including authentication, responsive design, and form validation.

### `/src/layouts`
Page layout components that define the structure of different sections of the application, providing consistent UI containers for pages.

### `/src/pages`
Individual page components that represent the different routes in the application, from the landing page to user dashboard and permit management screens.

### `/src/services`
API service modules that handle communication with the backend, organized by domain (auth, applications, users, etc.).

### `/src/styles`
Global CSS files including variables (design tokens), reset styles, and global component styles. Follows a mobile-first approach with min-width media queries.

### `/src/test`
Testing utilities, mocks, and configuration to support the application's test suite, primarily using Vitest and React Testing Library.

### `/src/types`
TypeScript type definitions and interfaces used throughout the application to ensure type safety and improve developer experience.

### `/src/utils`
Utility functions and helpers that provide common functionality across the application, such as validation, data formatting, and other shared logic.
