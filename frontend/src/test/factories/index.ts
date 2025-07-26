// Test data factories for consistent test data generation
import { v4 as uuidv4 } from 'uuid';
import { vi } from 'vitest';

// User factory
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: uuidv4(),
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  accountType: 'citizen',
  isEmailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Admin user factory
export const createMockAdminUser = (overrides: Partial<any> = {}) => ({
  id: uuidv4(),
  email: 'admin@example.com',
  first_name: 'Admin',
  last_name: 'User',
  accountType: 'admin',
  role: 'administrator',
  permissions: ['read', 'write', 'delete'],
  isEmailVerified: true,
  is_admin_portal: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Application factory
export const createMockApplication = (overrides: Partial<any> = {}) => ({
  id: uuidv4(),
  userId: uuidv4(),
  status: 'DRAFT',
  permitType: 'CONSTRUCTION',
  applicationData: {
    projectName: 'Test Project',
    projectDescription: 'Test Description',
    location: 'Test Location',
    estimatedCost: 100000,
  },
  submittedAt: null,
  reviewedAt: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Application with different statuses
export const createDraftApplication = (overrides: Partial<any> = {}) =>
  createMockApplication({ status: 'DRAFT', ...overrides });

export const createSubmittedApplication = (overrides: Partial<any> = {}) =>
  createMockApplication({ 
    status: 'SUBMITTED', 
    submittedAt: new Date().toISOString(),
    ...overrides 
  });

export const createApprovedApplication = (overrides: Partial<any> = {}) =>
  createMockApplication({ 
    status: 'PERMIT_READY', 
    submittedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    ...overrides 
  });

export const createRejectedApplication = (overrides: Partial<any> = {}) =>
  createMockApplication({ 
    status: 'REJECTED', 
    submittedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
    rejectedAt: new Date().toISOString(),
    rejectionReason: 'Test rejection reason',
    ...overrides 
  });

// API Response factories
export const createSuccessResponse = <T>(data: T) => ({
  success: true,
  data,
  message: 'Operation successful',
});

export const createErrorResponse = (message: string = 'An error occurred', code?: string) => ({
  success: false,
  message,
  code,
});

// Form data factories
export const createValidLoginData = (overrides: Partial<any> = {}) => ({
  email: 'test@example.com',
  password: 'password123',
  ...overrides,
});

export const createValidRegisterData = (overrides: Partial<any> = {}) => ({
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  password: 'password123',
  confirmPassword: 'password123',
  ...overrides,
});

// Permit form data factory
export const createValidPermitFormData = (overrides: Partial<any> = {}) => ({
  projectName: 'Test Construction Project',
  projectDescription: 'A test construction project for testing purposes',
  location: 'Test City, Test State',
  estimatedCost: 150000,
  startDate: '2024-02-01',
  endDate: '2024-12-31',
  contractorName: 'Test Contractor LLC',
  contractorLicense: 'TC123456',
  ...overrides,
});

// Query result factories for React Query
export const createQueryResult = <T>(data: T, overrides: Partial<any> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  isSuccess: true,
  refetch: vi.fn(),
  ...overrides,
});

export const createLoadingQueryResult = () => ({
  data: undefined,
  isLoading: true,
  isError: false,
  error: null,
  isSuccess: false,
  refetch: vi.fn(),
});

export const createErrorQueryResult = (error: Error = new Error('Test error')) => ({
  data: undefined,
  isLoading: false,
  isError: true,
  error,
  isSuccess: false,
  refetch: vi.fn(),
});

// Array factories for list data
export const createMockApplicationsList = (count: number = 3) => 
  Array.from({ length: count }, (_, index) => 
    createMockApplication({ 
      id: `app-${index + 1}`,
      applicationData: {
        ...createMockApplication().applicationData,
        projectName: `Test Project ${index + 1}`,
      }
    })
  );

export const createMockUsersList = (count: number = 3) => 
  Array.from({ length: count }, (_, index) => 
    createMockUser({ 
      id: `user-${index + 1}`,
      email: `user${index + 1}@example.com`,
      first_name: `User${index + 1}`,
    })
  );
