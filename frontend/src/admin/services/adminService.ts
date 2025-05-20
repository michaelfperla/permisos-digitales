import axios from 'axios';
import { getCsrfToken } from './authService';

// Create an axios instance with default config
const api = axios.create({
  baseURL: '/api/admin',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'admin' // Always include admin portal flag
  },
  withCredentials: true // Include cookies for session authentication
});

// Define types for API responses and data
export interface DashboardStats {
  statusCounts: Array<{ status: string; count: number }>;
  todayVerifications: {
    approved: number;
    rejected: number;
  };
  pendingVerifications: number;
}

export interface Application {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  payment_proof_uploaded_at?: string;
  payment_verified_at?: string;
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
  data: Application[];
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
  payment_rejection_reason?: string;
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
 * Get dashboard statistics
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const response = await api.get<any>('/dashboard-stats');

    // Check if the data is nested within response.data.data
    if (response.data?.data) {
      console.log('[getDashboardStats] Found stats in response.data.data');
      return response.data.data;
    }
    // Check if the data is directly in response.data
    else if (response.data && (response.data.statusCounts || response.data.pendingVerifications)) {
      console.log('[getDashboardStats] Found stats directly in response.data');
      return response.data;
    }
    // If stats data is not found in expected locations
    else {
      console.error('[getDashboardStats] Unexpected response structure:', response.data);
      throw new Error('Dashboard stats not found in response');
    }
  } catch (error) {
    console.error('Failed to get dashboard stats:', error);
    throw new Error('Failed to get dashboard statistics');
  }
};

/**
 * Get all applications with optional filters
 */
export const getAllApplications = async (
  page: number = 1,
  limit: number = 10,
  status?: string,
  startDate?: string,
  endDate?: string,
  searchTerm?: string
): Promise<PaginatedApplications> => {
  try {
    const params: Record<string, any> = { page, limit };

    if (status) params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (searchTerm) params.search = searchTerm;

    const response = await api.get<any>('/applications', { params });
    console.log('[getAllApplications] Raw API response:', response.data);
    console.log('[getAllApplications] Request params:', params);

    // Handle the new API response format (applications + pagination)
    if (response.data && response.data.applications && response.data.pagination) {
      console.log('[getAllApplications] Found applications and pagination in response.data');
      return {
        applications: response.data.applications,
        pagination: response.data.pagination
      };
    }

    // Handle nested data structure (data.applications + data.pagination)
    if (response.data?.data && response.data.data.applications && response.data.data.pagination) {
      console.log('[getAllApplications] Found applications and pagination in response.data.data');
      return {
        applications: response.data.data.applications,
        pagination: response.data.data.pagination
      };
    }

    // Handle array response (legacy format)
    if (Array.isArray(response.data)) {
      console.log('[getAllApplications] Found applications as array in response.data');
      return {
        applications: response.data,
        pagination: {
          page: page,
          limit: limit,
          total: response.data.length,
          totalPages: Math.ceil(response.data.length / limit)
        }
      };
    }

    // Handle array in data property (legacy format)
    if (Array.isArray(response.data?.data)) {
      console.log('[getAllApplications] Found applications as array in response.data.data');
      return {
        applications: response.data.data,
        pagination: {
          page: page,
          limit: limit,
          total: response.data.data.length,
          totalPages: Math.ceil(response.data.data.length / limit)
        }
      };
    }

    // Handle applications array without pagination
    if (response.data?.applications && Array.isArray(response.data.applications)) {
      console.log('[getAllApplications] Found applications array without pagination');
      return {
        applications: response.data.applications,
        pagination: {
          page: page,
          limit: limit,
          total: response.data.applications.length,
          totalPages: Math.ceil(response.data.applications.length / limit)
        }
      };
    }

    // Default empty response
    console.warn('[getAllApplications] Could not find applications in response, returning empty data');
    return {
      applications: [],
      pagination: {
        page: page,
        limit: limit,
        total: 0,
        totalPages: 0
      }
    };
  } catch (error) {
    console.error('Failed to get applications:', error);
    throw new Error('Failed to get applications');
  }
};

/**
 * Get applications pending payment verification with pagination
 *
 * This function is a placeholder since manual payment verification has been replaced
 * by automated payment provider integration.
 */

// Temporary placeholder function until payment provider integration is implemented
export const getPendingVerifications = async (
  page: number = 1,
  limit: number = 10
): Promise<PaginatedApplications> => {
  console.warn('Manual payment verification is no longer supported. Payment provider integration pending.');
  return {
    data: [],
    pagination: {
      page: page,
      limit: limit,
      total: 0,
      totalPages: 0
    }
  };
};

/**
 * Get application details by ID
 */
export const getApplicationDetails = async (id: string): Promise<ApplicationDetails> => {
  try {
    // Make the API call with 'any' type to handle different response structures
    const response = await api.get<any>(`/applications/${id}`);

    // Check if the data is nested within response.data.data
    if (response.data?.data) {
      console.log('[getApplicationDetails] Found application data in response.data.data');
      return response.data.data;
    }
    // Check if the data is directly in response.data
    else if (response.data && response.data.id) {
      console.log('[getApplicationDetails] Found application data directly in response.data');
      return response.data;
    }
    // If application data is not found in expected locations
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
 * Get payment proof details for an application
 *
 * This function is a placeholder since manual payment verification has been replaced
 * by automated payment provider integration.
 */

// Temporary placeholder function until payment provider integration is implemented
export const getPaymentProofDetails = async (id: string): Promise<PaymentProofDetails> => {
  console.warn('Manual payment proof details are no longer supported. Payment provider integration pending.');
  throw new Error('Payment proof details are no longer available. System is being updated to use payment provider integration.');
};

/**
 * Verify payment for an application
 *
 * This function is a placeholder since manual payment verification has been replaced
 * by automated payment provider integration.
 */

// Temporary placeholder function until payment provider integration is implemented
export const verifyPayment = async (id: string, notes?: string): Promise<{ success: boolean; message?: string }> => {
  console.warn('Manual payment verification is no longer supported. Payment provider integration pending.');
  return {
    success: false,
    message: 'La verificación manual de pagos ya no está disponible. El sistema está siendo actualizado.'
  };
};

/**
 * Reject payment proof for an application
 *
 * This function is a placeholder since manual payment verification has been replaced
 * by automated payment provider integration.
 */

// Temporary placeholder function until payment provider integration is implemented
export const rejectPayment = async (
  id: string,
  reason: string
): Promise<{ success: boolean; message?: string }> => {
  console.warn('Manual payment rejection is no longer supported. Payment provider integration pending.');
  return {
    success: false,
    message: 'El rechazo manual de pagos ya no está disponible. El sistema está siendo actualizado.'
  };
};

/**
 * Get verification history with optional filters
 */
export const getVerificationHistory = async (
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  action?: 'approved' | 'rejected'
): Promise<{ history: VerificationHistoryItem[]; total: number }> => {
  try {
    const params: Record<string, any> = { page, limit };

    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (action) params.action = action;

    const response = await api.get<any>(
      '/verification-history',
      { params }
    );

    console.log('[getVerificationHistory] Raw API response:', response.data);

    // Check if the response has success and data properties (API success response format)
    if (response.data?.success === true && response.data?.data) {
      console.log('[getVerificationHistory] Found success response format with data property');

      // If data contains history and total
      if (response.data.data.history && typeof response.data.data.total === 'number') {
        return response.data.data;
      }

      // If data.history exists
      if (response.data.data.history) {
        return {
          history: response.data.data.history,
          total: response.data.data.total || response.data.data.history.length
        };
      }

      // If data is the history array
      if (Array.isArray(response.data.data)) {
        return {
          history: response.data.data,
          total: response.data.data.length
        };
      }

      // Handle case where data might be an empty object or null
      console.log('[getVerificationHistory] Data property exists but no history found');
      return {
        history: [],
        total: 0
      };
    }

    // Check if history is directly in response.data
    if (response.data?.history) {
      console.log('[getVerificationHistory] Found history directly in response.data');
      return {
        history: response.data.history,
        total: response.data.total || response.data.history.length
      };
    }

    // If the response is an array directly
    if (Array.isArray(response.data)) {
      console.log('[getVerificationHistory] Found history as array directly in response.data');
      return {
        history: response.data,
        total: response.data.length
      };
    }

    // Default fallback for unexpected response structure
    console.warn('[getVerificationHistory] Unexpected response structure:', response.data);
    return {
      history: [],
      total: 0
    };
  } catch (error) {
    console.error('Failed to get verification history:', error);
    throw new Error('Failed to get verification history');
  }
};

/**
 * Get users with pagination and filtering
 */
export const getUsers = async (
  page: number = 1,
  limit: number = 10,
  role?: string,
  search?: string
): Promise<PaginatedUsers> => {
  try {
    const params: Record<string, any> = { page, limit };

    if (role) params.role = role;
    if (search) params.search = search;

    const response = await api.get('/users', { params });

    // Check if the response has the expected structure
    const responseData = response.data;

    // Handle different response structures
    if (responseData.data && Array.isArray(responseData.data.users)) {
      // ApiResponse.success format: { data: { users: [], pagination: {} } }
      return responseData.data;
    } else if (responseData.users && Array.isArray(responseData.users)) {
      // Direct format: { users: [], pagination: {} }
      return responseData;
    } else if (Array.isArray(responseData)) {
      // Just an array of users
      return {
        users: responseData,
        pagination: {
          page: page,
          limit: limit,
          total: responseData.length,
          totalPages: Math.ceil(responseData.length / limit)
        }
      };
    }

    // Default fallback
    console.warn('Unexpected users response format:', responseData);
    return {
      users: [],
      pagination: {
        page: page,
        limit: limit,
        total: 0,
        totalPages: 0
      }
    };
  } catch (error) {
    console.error('Failed to get users:', error);
    throw new Error('Failed to get users');
  }
};

/**
 * Get user details by ID
 */
export const getUserDetails = async (id: string): Promise<{ user: AdminUserDetails }> => {
  try {
    // Make the API call (response type 'any' initially to handle potential structures)
    const response = await api.get<any>(`/users/${id}`);

    // Check if the data is nested within response.data.data.user
    if (response.data?.data?.user) {
      console.log('[getUserDetails] Found user data in response.data.data.user');
      return { user: response.data.data.user }; // Return in the expected { user: ... } format
    }
    // Check if the data is directly in response.data.user
    else if (response.data?.user) {
      console.log('[getUserDetails] Found user data directly in response.data.user');
      return { user: response.data.user }; // Return in the expected { user: ... } format
    }
    // If user data is not found in expected locations
    else {
      console.error('[getUserDetails] Unexpected response structure or user data missing:', response.data);
      // Treat missing user data in a success response as 'not found' conceptually
      // Throwing an error here allows useQuery to catch it and set isError=true
      throw new Error('User data not found in response');
    }
  } catch (error: any) { // Catch any error, including the one thrown above or Axios errors
    console.error(`[getUserDetails] Failed to get user details for ID ${id}:`, error);
    // Re-throw the error so useQuery can handle it (e.g., set isError state)
    // This preserves the original error (like a 404 from the backend fix)
    throw error;
  }
};

/**
 * Get applications for a specific user
 */
export const getUserApplications = async (userId: string): Promise<{ applications: Application[] }> => {
  try {
    // Make the API call
    const response = await api.get<any>(`/users/${userId}/applications`);

    // Handle different response structures
    if (response.data?.data?.applications) {
      console.log('[getUserApplications] Found applications in response.data.data.applications');
      return { applications: response.data.data.applications };
    } else if (response.data?.applications) {
      console.log('[getUserApplications] Found applications directly in response.data.applications');
      return { applications: response.data.applications };
    } else {
      console.error('[getUserApplications] Unexpected response structure or applications data missing:', response.data);
      // Return empty array if no applications found
      return { applications: [] };
    }
  } catch (error: any) {
    console.error(`[getUserApplications] Failed to get applications for user ID ${userId}:`, error);
    throw error;
  }
};

/**
 * Enable a user account
 */
export const enableUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.patch(
      `/users/${userId}/enable`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    // Handle different response structures
    if (response.data?.success !== undefined) {
      return {
        success: response.data.success,
        message: response.data.message || 'User account enabled successfully'
      };
    }

    // Default success response if structure is unexpected
    return { success: true, message: 'User account enabled successfully' };
  } catch (error: any) {
    console.error(`[enableUser] Failed to enable user ID ${userId}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to enable user account');
  }
};

/**
 * Disable a user account
 */
export const disableUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.patch(
      `/users/${userId}/disable`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    // Handle different response structures
    if (response.data?.success !== undefined) {
      return {
        success: response.data.success,
        message: response.data.message || 'User account disabled successfully'
      };
    }

    // Default success response if structure is unexpected
    return { success: true, message: 'User account disabled successfully' };
  } catch (error: any) {
    console.error(`[disableUser] Failed to disable user ID ${userId}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to disable user account');
  }
};

// Export all functions as default object
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
  disableUser
};

export default adminService;
