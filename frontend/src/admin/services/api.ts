import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Create a custom axios instance for the admin portal
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'admin'
  },
  withCredentials: true // Include cookies for session authentication
});

// Function to get CSRF token
export const getCsrfToken = async (): Promise<string> => {
  try {
    const response = await api.get<{ data: { csrfToken: string } }>('/auth/csrf-token');

    // Handle different response structures
    if (response.data.data && response.data.data.csrfToken) {
      return response.data.data.csrfToken;
    } else if (response.data.csrfToken) {
      return response.data.csrfToken;
    } else {
      console.error('Invalid CSRF token response structure:', response.data);
      throw new Error('Invalid CSRF token response structure');
    }
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    throw new Error('Failed to get CSRF token');
  }
};

// Request interceptor to add CSRF token to requests that need it
api.interceptors.request.use(
  async (config: AxiosRequestConfig) => {
    // Only add CSRF token for mutating requests (POST, PUT, PATCH, DELETE)
    if (
      config.method &&
      ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())
    ) {
      try {
        const token = await getCsrfToken();
        if (config.headers) {
          config.headers['X-CSRF-Token'] = token;
        } else {
          config.headers = { 'X-CSRF-Token': token };
        }
      } catch (error) {
        console.error('Error adding CSRF token to request:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    // Skip handling for canceled requests
    if (axios.isCancel(error)) {
      console.log('Request canceled:', error.message);
      return Promise.reject(error);
    }

    // Handle CSRF token errors
    if (
      error.response &&
      error.response.status === 403
    ) {
      // Check for CSRF error in various response formats
      const errorData = error.response.data;
      const isCsrfError =
        (typeof errorData === 'object' &&
          (errorData.error?.toLowerCase().includes('csrf') ||
           errorData.message?.toLowerCase().includes('csrf'))) ||
        (typeof errorData === 'string' &&
          errorData.toLowerCase().includes('csrf'));

      if (isCsrfError) {
        console.error('CSRF token error:', error.response.data);
        // You could implement retry logic here if needed
      } else {
        console.error('Forbidden error (non-CSRF):', error.response.data);
      }
    }

    // Handle session expiration
    if (error.response && error.response.status === 401) {
      console.error('Session expired or unauthorized:', error.response.data);
      // Redirect to login page
      window.location.href = '/admin/login';
    }

    return Promise.reject(error);
  }
);

export default api;
