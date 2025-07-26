/**
 * Main API module
 * Re-exports the configured API instance and setup function
 */
export { api as default, api } from './api-config-setup';
export { configureApi as initializeApi } from './api-config-setup';