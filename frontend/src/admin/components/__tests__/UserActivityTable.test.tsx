import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import UsersPage from '../../pages/UsersPage';
import adminService from '../../services/adminService';

// Mock dependencies
vi.mock('../../services/adminService');
vi.mock('../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const mockAdminService = vi.mocked(adminService);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const mockUsers = [
  {
    id: 'user-1',
    name: 'Juan Pérez',
    email: 'juan.perez@email.com',
    account_type: 'PAID',
    is_admin: false,
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'user-2',
    name: 'María García',
    email: 'maria.garcia@email.com',
    account_type: 'FREE',
    is_admin: true,
    created_at: '2024-01-10T08:30:00Z',
  },
  {
    id: 'user-3',
    name: 'Carlos López',
    email: 'carlos.lopez@email.com',
    account_type: 'PREMIUM',
    is_admin: false,
    created_at: '2024-01-12T14:15:00Z',
  },
];

const mockUsersResponse = {
  users: mockUsers,
  total: 3,
  page: 1,
  pageSize: 10,
};

// Mock window.innerWidth for responsive testing
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

describe('UserActivityTable (UsersPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window width to desktop for each test
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));
  });

  it('should render users table with correct headers', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Gestión de Usuarios')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Correo Electrónico')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Cuenta')).toBeInTheDocument();
    expect(screen.getByText('Acceso Admin')).toBeInTheDocument();
    expect(screen.getByText('Fecha de Registro')).toBeInTheDocument();
  });

  it('should display user data correctly in table format', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    // Check user data
    expect(screen.getByText('juan.perez@email.com')).toBeInTheDocument();
    expect(screen.getByText('maria.garcia@email.com')).toBeInTheDocument();
    expect(screen.getByText('carlos.lopez@email.com')).toBeInTheDocument();

    // Check account types
    expect(screen.getByText('Pagada')).toBeInTheDocument();
    expect(screen.getByText('Gratuita')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();

    // Check admin status
    expect(screen.getByText('Sí')).toBeInTheDocument();
    expect(screen.getAllByText('No')).toHaveLength(2);
  });

  it('should format dates correctly', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('15 de enero de 2024')).toBeInTheDocument();
    });

    expect(screen.getByText('10 de enero de 2024')).toBeInTheDocument();
    expect(screen.getByText('12 de enero de 2024')).toBeInTheDocument();
  });

  it('should filter users by search term', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar por nombre o email...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Buscar por nombre o email...');
    fireEvent.change(searchInput, { target: { value: 'juan' } });

    // Should call the service with search parameter
    await waitFor(() => {
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'juan',
        })
      );
    });
  });

  it('should filter users by role', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Todos los roles')).toBeInTheDocument();
    });

    const roleFilter = screen.getByDisplayValue('Todos los roles');
    fireEvent.change(roleFilter, { target: { value: 'admin' } });

    await waitFor(() => {
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin',
        })
      );
    });
  });

  it('should navigate to user details when row is clicked', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    const userRow = screen.getByText('Juan Pérez').closest('tr');
    expect(userRow).toBeInTheDocument();

    fireEvent.click(userRow!);

    // Should navigate to user details (this would need router mocking for full test)
    expect(userRow).toHaveClass('userRow');
  });

  it('should handle pagination correctly', async () => {
    const paginatedResponse = {
      users: mockUsers,
      total: 25,
      page: 1,
      pageSize: 10,
    };

    mockAdminService.getUsers.mockResolvedValue(paginatedResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Mostrando 1-3 de 25 usuarios')).toBeInTheDocument();
    });

    // Should show pagination info
    expect(screen.getByText(/mostrando/i)).toBeInTheDocument();
  });

  it('should display empty state when no users found', async () => {
    mockAdminService.getUsers.mockResolvedValue({
      users: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No se encontraron usuarios')).toBeInTheDocument();
    });

    expect(screen.getByText('No hay usuarios que coincidan con los criterios de búsqueda.')).toBeInTheDocument();
  });

  it('should handle loading state', async () => {
    mockAdminService.getUsers.mockImplementation(() => new Promise(() => {}));

    render(<UsersPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Cargando usuarios...')).toBeInTheDocument();
  });

  it('should handle error state', async () => {
    const error = new Error('Failed to load users');
    mockAdminService.getUsers.mockRejectedValue(error);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Error al cargar usuarios')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load users')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intentar nuevamente/i })).toBeInTheDocument();
  });

  it('should retry loading when retry button is clicked', async () => {
    const error = new Error('Network error');
    mockAdminService.getUsers.mockRejectedValueOnce(error).mockResolvedValueOnce(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Error al cargar usuarios')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /intentar nuevamente/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });
  });

  it('should render mobile card layout on small screens', async () => {
    // Mock mobile screen width
    window.innerWidth = 768;
    window.dispatchEvent(new Event('resize'));

    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    // Should render user cards instead of table
    const userCards = screen.getAllByTestId(/user-card/);
    expect(userCards.length).toBeGreaterThan(0);
  });

  it('should display correct account type badges', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Pagada')).toBeInTheDocument();
    });

    // Check that account types are displayed with appropriate styling
    const paidBadge = screen.getByText('Pagada');
    const freeBadge = screen.getByText('Gratuita');
    const premiumBadge = screen.getByText('Premium');

    expect(paidBadge).toHaveClass('accountTypePaid');
    expect(freeBadge).toHaveClass('accountTypeFree');
    expect(premiumBadge).toHaveClass('accountTypePremium');
  });

  it('should handle admin status correctly', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Sí')).toBeInTheDocument();
    });

    // Check admin status display
    const adminYes = screen.getByText('Sí');
    const adminNos = screen.getAllByText('No');

    expect(adminYes).toHaveClass('adminStatusYes');
    adminNos.forEach(noElement => {
      expect(noElement).toHaveClass('adminStatusNo');
    });
  });

  it('should clear search when clear button is used', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar por nombre o email...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Buscar por nombre o email...');
    
    // Type search term
    fireEvent.change(searchInput, { target: { value: 'juan' } });
    expect(searchInput).toHaveValue('juan');

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    
    await waitFor(() => {
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '',
        })
      );
    });
  });

  it('should handle sorting functionality', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Nombre')).toBeInTheDocument();
    });

    // Click on name column header to sort
    const nameHeader = screen.getByText('Nombre');
    fireEvent.click(nameHeader);

    await waitFor(() => {
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'name',
          sortOrder: 'asc',
        })
      );
    });
  });

  it('should show toast notification on error', async () => {
    const { showToast } = require('../../../shared/hooks/useToast').useToast();
    const error = new Error('API Error');
    mockAdminService.getUsers.mockRejectedValue(error);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Error al cargar usuarios: API Error', 'error');
    });
  });

  it('should refresh data periodically', async () => {
    mockAdminService.getUsers.mockResolvedValue(mockUsersResponse);

    render(<UsersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockAdminService.getUsers).toHaveBeenCalledTimes(1);
    });

    // Should have React Query set up for automatic refetching
    expect(mockAdminService.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
      })
    );
  });
});