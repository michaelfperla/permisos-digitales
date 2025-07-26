import { vi } from 'vitest';

// Create mock functions
export const mockGet = vi.fn();
export const mockPost = vi.fn();
export const mockDelete = vi.fn();
export const mockPut = vi.fn();
export const mockIsAxiosError = vi.fn();

// Mock axios module
vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
      delete: mockDelete,
      put: mockPut,
      defaults: {
        headers: {
          common: {},
        },
      },
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
    }),
    isAxiosError: mockIsAxiosError,
  },
}));
