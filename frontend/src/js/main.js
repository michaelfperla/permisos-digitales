/**
 * Main JavaScript Entry Point
 * Permisos Digitales Application
 */

// Import global styles
import '../scss/main.scss';

// Import utility modules
import { initRouter } from './utils/router';
import { setupForms } from './utils/forms';
import { setupAccessibility } from './utils/accessibility';
import { initializeComponents } from './utils/components';

// When the DOM is loaded, initialize the application
document.addEventListener('DOMContentLoaded', () => {
  console.log('Permisos Digitales application starting...');
  
  // Initialize the router
  initRouter();
  
  // Setup form handling
  setupForms();
  
  // Setup accessibility features
  setupAccessibility();
  
  // Initialize all page components
  initializeComponents();
});

// Enable hot module replacement for development
if (module.hot) {
  module.hot.accept();
}