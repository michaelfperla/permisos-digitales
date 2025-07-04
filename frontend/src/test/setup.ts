import '@testing-library/jest-dom';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Configure testing library
configure({
  asyncUtilTimeout: 5000, // Default is 1000ms
  testIdAttribute: 'data-testid',
});

// Create a proper axios mock that matches the real axios structure
const createAxiosInstance = () => ({
  interceptors: {
    request: {
      use: vi.fn(),
      eject: vi.fn(),
    },
    response: {
      use: vi.fn(),
      eject: vi.fn(),
    },
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  defaults: {
    headers: {
      common: {},
      get: {},
      post: {},
      put: {},
      patch: {},
      delete: {},
    },
  },
});

// Mock axios for all tests
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => createAxiosInstance()),
    ...createAxiosInstance(),
    isAxiosError: vi.fn((error: any) => !!error?.isAxiosError),
  },
}));

// Mock the API service specifically
vi.mock('../services/api', () => ({
  api: createAxiosInstance(),
  default: createAxiosInstance(),
}));

// Mock CSRF utilities
vi.mock('../utils/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('mock-csrf-token'),
  addCsrfTokenInterceptor: vi.fn(),
}));

// Setup before each test
beforeEach(() => {
  // Clear all mocks
  vi.clearAllMocks();

  // Clear session storage
  sessionStorage.clear();
});

// Automatically clean up after each test
afterEach(() => {
  cleanup();

  // Clear session storage after each test
  sessionStorage.clear();
});

// Mock window.scrollTo
window.scrollTo = vi.fn() as any;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  callback: IntersectionObserverCallback;

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'mock-url');
