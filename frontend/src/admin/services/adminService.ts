import axios from 'axios';

import { getCsrfToken } from './authService';

const api = axios.create({
  baseURL: '/api/admin',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'admin',
  },
  withCredentials: true,
});

export interface DashboardStats {
  statusCounts: Array<{ status: string; count: number }>;
  todayVerifications: {
    approved: number;
    rejected: number;
  };
  pendingVerifications: number;
  oxxoPaymentsPending?: number;
  todayPermits?: number;
}

export interface Application {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;  payment_verified_at?: string;
  payment_reference?: string;
  nombre_completo: string;
  marca: string;
  linea: string;
  ano_modelo: string | number;
  color?: string;
  curp_rfc?: string;
  applicant_email?: string;
  amount?: number;
  fecha_expedicion?: string;
  fecha_vencimiento?: string;
}

export interface PaginatedApplications {
  applications: Application[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApplicationDetails extends Application {
  domicilio: string;
  numero_serie: string;
  numero_motor: string;
  folio?: string;
  fecha_expedicion?: string;
  fecha_vencimiento?: string;
}

export interface PaymentProofDetails {
  id: string;
  application_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  payment_reference: string;
  notes?: string;
}

export interface VerificationHistoryItem {
  id: string;
  application_id: string;
  admin_id: string;
  admin_name: string;
  action: 'approved' | 'rejected';
  created_at: string;
  notes?: string;
  payment_reference?: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  account_type: string;
  is_admin_portal: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SecurityEvent {
  id: string;
  action_type: string;
  ip_address: string;
  user_agent: string;
  details: any;
  created_at: string;
}

export interface AdminUserDetails extends AdminUserListItem {
  role: string;
  created_by?: string;
  created_by_first_name?: string;
  created_by_last_name?: string;
  securityEvents?: SecurityEvent[];
}

export interface PaginatedUsers {
  users: AdminUserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get admin dashboard statistics
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const response = await api.get<any>('/dashboard-stats');

    if (import.meta.env.DEV) {
      console.log('[getDashboardStats] Raw API response:', response.data);
    }

    let stats: DashboardStats;

    if (response.data?.data) {
      if (import.meta.env.DEV) {
        console.debug('[getDashboardStats] Found stats in response.data.data');
      }
      stats = response.data.data;
    }
    else if (response.data && (response.data.statusCounts || response.data.pendingVerifications !== undefined)) {
      if (import.meta.env.DEV) {
        console.debug('[getDashboardStats] Found stats directly in response.data');
      }
      stats = response.data;
    }
    else {
      console.error('[getDashboardStats] Unexpected response structure:', response.data);
      throw new Error('Dashboard stats not found in response');
    }

    const statusCounts = stats.statusCounts || [];

    const oxxoPaymentsPending = statusCounts.find(s => s.status === 'AWAITING_OXXO_PAYMENT')?.count || 0;
    const todayPermits = statusCounts.find(s => s.status === 'PERMIT_READY')?.count || 0;

    return {
      ...stats,
      oxxoPaymentsPending,
      todayPermits,
    };
  } catch (error) {
    console.error('Failed to get dashboard stats:', error);
    throw new Error('Failed to get dashboard statistics');
  }
};

/**
 * Get all applications with optional filters and pagination
 */
export const getAllApplications = async (
  page: number = 1,
  limit: number = 10,
  status?: string,
  startDate?: string,
  endDate?: string,
  searchTerm?: string,
): Promise<PaginatedApplications> => {
  try {
    const params: Record<string, any> = { page, limit };

    if (status) params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (searchTerm) params.search = searchTerm;

    const response = await api.get<any>('/applications', { params });

    if (import.meta.env.DEV) {
      console.debug('[getAllApplications] Raw API response:', response.data);
      console.debug('[getAllApplications] Request params:', params);
    }

    if (response.data?.success && response.data?.data) {
      console.debug('[getAllApplications] Found ApiResponse.success format');
      const data = response.data.data;

      if (data.applications && Array.isArray(data.applications)) {
        console.debug('[getAllApplications] Found applications in response.data.data');
        return {
          applications: data.applications,
          pagination: {
            page: data.page || page,
            limit: data.limit || limit,
            total: data.total || data.applications.length,
            totalPages: data.totalPages || Math.ceil((data.total || data.applications.length) / (data.limit || limit)),
          },
        };
      }
    }

    if (response.data && response.data.applications && response.data.pagination) {
      console.debug('[getAllApplications] Found applications and pagination in response.data');
      return {
        applications: response.data.applications,
        pagination: response.data.pagination,
      };
    }

    if (Array.isArray(response.data)) {
      console.debug('[getAllApplications] Found applications as array in response.data');
      return {
        applications: response.data,
        pagination: {
          page: page,
          limit: limit,
          total: response.data.length,
          totalPages: Math.ceil(response.data.length / limit),
        },
      };
    }

    if (Array.isArray(response.data?.data)) {
      console.debug('[getAllApplications] Found applications as array in response.data.data');
      return {
        applications: response.data.data,
        pagination: {
          page: page,
          limit: limit,
          total: response.data.data.length,
          totalPages: Math.ceil(response.data.data.length / limit),
        },
      };
    }

    if (response.data?.applications && Array.isArray(response.data.applications)) {
      console.debug('[getAllApplications] Found applications array without pagination');
      return {
        applications: response.data.applications,
        pagination: {
          page: page,
          limit: limit,
          total: response.data.applications.length,
          totalPages: Math.ceil(response.data.applications.length / limit),
        },
      };
    }

    if (import.meta.env.DEV) {
      console.warn(
        '[getAllApplications] Could not find applications in response, returning empty data',
      );
    }
    return {
      applications: [],
      pagination: {
        page: page,
        limit: limit,
        total: 0,
        totalPages: 0,
      },
    };
  } catch (error) {
    console.error('Failed to get applications:', error);
    throw new Error('Failed to get applications');
  }
};

/**
 * Get pending payment verifications (deprecated)
 */
export const getPendingVerifications = async (
  page: number = 1,
  limit: number = 10,
): Promise<PaginatedApplications> => {
  console.warn(
    'Manual payment verification is no longer supported. Payment provider integration pending.',
  );
  return {
    applications: [],
    pagination: {
      page: page,
      limit: limit,
      total: 0,
      totalPages: 0,
    },
  };
};

/**
 * Get detailed application information by ID
 */
export const getApplicationDetails = async (id: string): Promise<ApplicationDetails> => {
  try {
    const response = await api.get<any>(`/applications/${id}`);

    if (response.data?.data) {
      console.debug('[getApplicationDetails] Found application data in response.data.data');
      return response.data.data;
    }
    else if (response.data && response.data.id) {
      console.debug('[getApplicationDetails] Found application data directly in response.data');
      return response.data;
    }
    else {
      console.error('[getApplicationDetails] Unexpected response structure:', response.data);
      throw new Error('Application data not found in response');
    }
  } catch (error) {
    console.error(`Failed to get application details for ID ${id}:`, error);
    throw new Error('Failed to get application details');
  }
};

/**
 * Get payment proof details (deprecated)
 */
export const getPaymentProofDetails = async (_id: string): Promise<PaymentProofDetails> => {
  console.warn(
    'Manual payment proof details are no longer supported. Payment provider integration pending.',
  );
  throw new Error(
    'Payment proof details are no longer available. System is being updated to use payment provider integration.',
  );
};

/**
 * Verify payment manually (deprecated)
 */
export const verifyPayment = async (
  _id: string,
  _notes?: string,
): Promise<{ success: boolean; message?: string }> => {
  console.warn(
    'Manual payment verification is no longer supported. Payment provider integration pending.',
  );
  return {
    success: false,
    message:
      'La verificación manual de pagos ya no está disponible. El sistema está siendo actualizado.',
  };
};

/**
 * Reject payment manually (deprecated)
 */
export const rejectPayment = async (
  _id: string,
  _reason: string,
): Promise<{ success: boolean; message?: string }> => {
  console.warn(
    'Manual payment rejection is no longer supported. Payment provider integration pending.',
  );
  return {
    success: false,
    message:
      'El rechazo manual de pagos ya no está disponible. El sistema está siendo actualizado.',
  };
};

/**
 * Get payment verification history with pagination
 */
export const getVerificationHistory = async (
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  action?: 'approved' | 'rejected',
): Promise<{ history: VerificationHistoryItem[]; total: number }> => {
  try {
    const params: Record<string, any> = { page, limit };

    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (action) params.action = action;

    const response = await api.get<any>('/verification-history', { params });

    console.debug('[getVerificationHistory] Raw API response:', response.data);

    if (response.data?.success === true && response.data?.data) {
      console.debug('[getVerificationHistory] Found success response format with data property');
      if (response.data.data.history && typeof response.data.data.total === 'number') {
        return response.data.data;
      }
      if (response.data.data.history) {
        return {
          history: response.data.data.history,
          total: response.data.data.total || response.data.data.history.length,
        };
      }
      if (Array.isArray(response.data.data)) {
        return {
          history: response.data.data,
          total: response.data.data.length,
        };
      }
      console.debug('[getVerificationHistory] Data property exists but no history found');
      return {
        history: [],
        total: 0,
      };
    }

    if (response.data?.history) {
      console.debug('[getVerificationHistory] Found history directly in response.data');
      return {
        history: response.data.history,
        total: response.data.total || response.data.history.length,
      };
    }

    if (Array.isArray(response.data)) {
      console.debug('[getVerificationHistory] Found history as array directly in response.data');
      return {
        history: response.data,
        total: response.data.length,
      };
    }

    if (import.meta.env.DEV) {
      console.warn('[getVerificationHistory] Unexpected response structure:', response.data);
    }
    return {
      history: [],
      total: 0,
    };
  } catch (error) {
    console.error('Failed to get verification history:', error);
    throw new Error('Failed to get verification history');
  }
};

/**
 * Get users with pagination and optional filters
 */
export const getUsers = async (
  page: number = 1,
  limit: number = 10,
  role?: string,
  search?: string,
): Promise<PaginatedUsers> => {
  try {
    const params: Record<string, any> = { page, limit };
    if (role) params.role = role;
    if (search) params.search = search;
    const response = await api.get('/users', { params });
    const responseData = response.data;

    if (responseData.data && Array.isArray(responseData.data.users)) {
      return responseData.data;
    } else if (responseData.users && Array.isArray(responseData.users)) {
      return responseData;
    } else if (Array.isArray(responseData)) {
      return {
        users: responseData,
        pagination: {
          page: page,
          limit: limit,
          total: responseData.length,
          totalPages: Math.ceil(responseData.length / limit),
        },
      };
    }
    if (import.meta.env.DEV) {
      console.warn('Unexpected users response format:', responseData);
    }
    return {
      users: [],
      pagination: { page: page, limit: limit, total: 0, totalPages: 0 },
    };
  } catch (error) {
    console.error('Failed to get users:', error);
    throw new Error('Failed to get users');
  }
};

/**
 * Get detailed user information by ID
 */
export const getUserDetails = async (id: string): Promise<{ user: AdminUserDetails }> => {
  try {
    const response = await api.get<any>(`/users/${id}`);
    if (response.data?.data?.user) {
      console.debug('[getUserDetails] Found user data in response.data.data.user');
      return { user: response.data.data.user };
    }
    else if (response.data?.user) {
      console.debug('[getUserDetails] Found user data directly in response.data.user');
      return { user: response.data.user };
    }
    else {
      console.error(
        '[getUserDetails] Unexpected response structure or user data missing:',
        response.data,
      );
      throw new Error('User data not found in response');
    }
  } catch (error: any) {
    console.error(`[getUserDetails] Failed to get user details for ID ${id}:`, error);
    throw error;
  }
};

/**
 * Get all applications for a specific user
 */
export const getUserApplications = async (
  userId: string,
): Promise<{ applications: Application[] }> => {
  try {
    const response = await api.get<any>(`/users/${userId}/applications`);
    if (response.data?.data?.applications) {
      console.debug('[getUserApplications] Found applications in response.data.data.applications');
      return { applications: response.data.data.applications };
    } else if (response.data?.applications) {
      console.debug(
        '[getUserApplications] Found applications directly in response.data.applications',
      );
      return { applications: response.data.applications };
    } else {
      console.error(
        '[getUserApplications] Unexpected response structure or applications data missing:',
        response.data,
      );
      return { applications: [] };
    }
  } catch (error: any) {
    console.error(`[getUserApplications] Failed to get applications for user ID ${userId}:`, error);
    throw error;
  }
};

/**
 * Enable user account
 */
export const enableUser = async (
  userId: string,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const csrfTokenVal = await getCsrfToken();
    const response = await api.patch(
      `/users/${userId}/enable`,
      {},
      { headers: { 'X-CSRF-Token': csrfTokenVal } },
    );
    if (response.data?.success !== undefined) {
      return {
        success: response.data.success,
        message: response.data.message || 'User account enabled successfully',
      };
    }
    return { success: true, message: 'User account enabled successfully' };
  } catch (error: any) {
    console.error(`[enableUser] Failed to enable user ID ${userId}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to enable user account');
  }
};

/**
 * Disable user account
 */
export const disableUser = async (
  userId: string,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const csrfTokenVal = await getCsrfToken();
    const response = await api.patch(
      `/users/${userId}/disable`,
      {},
      { headers: { 'X-CSRF-Token': csrfTokenVal } },
    );
    if (response.data?.success !== undefined) {
      return {
        success: response.data.success,
        message: response.data.message || 'User account disabled successfully',
      };
    }
    return { success: true, message: 'User account disabled successfully' };
  } catch (error: any) {
    console.error(`[disableUser] Failed to disable user ID ${userId}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to disable user account');
  }
};

const adminService = {
  getDashboardStats,
  getAllApplications,
  getPendingVerifications,
  getApplicationDetails,
  getPaymentProofDetails,
  verifyPayment,
  rejectPayment,
  getVerificationHistory,
  getUsers,
  getUserDetails,
  getUserApplications,
  enableUser,
  disableUser,
};

export default adminService;