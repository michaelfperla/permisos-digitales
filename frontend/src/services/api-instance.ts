import axios from 'axios';

/**
 * Base axios instance without any interceptors or configuration
 * This prevents circular dependencies by keeping the instance separate
 */
export const apiInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

export default apiInstance;