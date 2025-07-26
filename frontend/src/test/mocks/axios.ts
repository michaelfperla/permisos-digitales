import { vi } from 'vitest';

import { mockCsrfToken } from './authService';

// Create a mock axios instance
const createAxiosInstance = (config: any = {}) => {
  return {
    defaults: {
      ...axiosMock.defaults,
      ...config,
    },
    get: axiosMock.get,
    post: axiosMock.post,
    put: axiosMock.put,
    delete: axiosMock.delete,
    interceptors: {
      request: {
        use: vi.fn(),
        eject: vi.fn(),
        clear: vi.fn(),
      },
      response: {
        use: vi.fn(),
        eject: vi.fn(),
        clear: vi.fn(),
      },
    },
  };
};

// Create a mock axios implementation
const axiosMock = {
  defaults: {
    headers: {
      common: {},
      post: {},
      get: {},
      delete: {},
      patch: {},
      put: {},
    },
    withCredentials: true,
  },

  get: vi.fn().mockImplementation((url: string) => {
    if (url === '/auth/csrf-token') {
      return Promise.resolve({
        data: { csrfToken: mockCsrfToken },
      });
    }

    return Promise.reject(new Error(`GET ${url} not mocked`));
  }),

  post: vi.fn().mockImplementation((url: string, data: any, config: any) => {
    // Check if CSRF token is included in the headers
    if (config?.headers && !config.headers['X-CSRF-Token']) {
      console.warn(`CSRF token missing in POST request to ${url}`);
    }

    return Promise.reject(new Error(`POST ${url} not mocked`));
  }),

  put: vi.fn().mockImplementation((url: string, data: any, config: any) => {
    // Check if CSRF token is included in the headers
    if (config?.headers && !config.headers['X-CSRF-Token']) {
      console.warn(`CSRF token missing in PUT request to ${url}`);
    }

    return Promise.reject(new Error(`PUT ${url} not mocked`));
  }),

  delete: vi.fn().mockImplementation((url: string, config: any) => {
    // Check if CSRF token is included in the headers
    if (config?.headers && !config.headers['X-CSRF-Token']) {
      console.warn(`CSRF token missing in DELETE request to ${url}`);
    }

    return Promise.reject(new Error(`DELETE ${url} not mocked`));
  }),

  // Create method for axios.create
  create: vi.fn().mockImplementation(createAxiosInstance),

  // Helper method to reset all mocks
  resetMocks: () => {
    axiosMock.get.mockClear();
    axiosMock.post.mockClear();
    axiosMock.put.mockClear();
    axiosMock.delete.mockClear();
    axiosMock.create.mockClear();
  },
};

// Add default export
export default axiosMock;
