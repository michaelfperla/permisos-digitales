import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Configure testing library
configure({
  asyncUtilTimeout: 5000, // Default is 1000ms
});

// Mock axios for all tests
vi.mock('axios');

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
window.scrollTo = vi.fn();

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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
