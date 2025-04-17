/**
 * Accessibility utilities
 * Enhances the user experience for users with disabilities
 */

/**
 * Initialize accessibility features
 */
export function setupAccessibility() {
  setupFocusVisible();
  setupSkipLinks();
  setupReducedMotion();
  setupAriaAttributes();
  setupFormLabels();
  
  console.log('[Accessibility] Features initialized');
}

/**
 * Setup focus visible behavior
 * Helps distinguish keyboard focus from mouse clicks
 */
function setupFocusVisible() {
  // Add class to body to indicate JS is enabled
  document.body.classList.add('js-focus-visible');
  
  // Track whether the user is using keyboard or mouse
  let usingMouse = false;
  
  // When the user presses a key, they're using keyboard navigation
  document.addEventListener('keydown', (event) => {
    // Only handle Tab key to detect keyboard navigation
    if (event.key === 'Tab') {
      usingMouse = false;
      document.body.classList.remove('using-mouse');
    }
  });
  
  // When the user clicks, they're using mouse navigation
  document.addEventListener('mousedown', () => {
    usingMouse = true;
    document.body.classList.add('using-mouse');
  });
  
  // Add special class for focus events to distinguish keyboard focus
  document.addEventListener('focusin', (event) => {
    if (!usingMouse) {
      event.target.classList.add('focus-visible');
    }
  });
  
  document.addEventListener('focusout', (event) => {
    event.target.classList.remove('focus-visible');
  });
}

/**
 * Set up skip links functionality
 * Allows keyboard users to skip navigation and go straight to content
 */
function setupSkipLinks() {
  const skipLinks = document.querySelectorAll('.sr-only-focusable');
  
  skipLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      // Prevent default if it's an anchor link
      if (link.getAttribute('href').startsWith('#')) {
        event.preventDefault();
        
        // Get the target element
        const targetId = link.getAttribute('href').slice(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          // Set focus to the target and ensure it's focusable
          if (!targetElement.hasAttribute('tabindex')) {
            targetElement.setAttribute('tabindex', '-1');
          }
          
          targetElement.focus();
          
          // Scroll to the element
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

/**
 * Set up reduced motion detection and handling
 * Respects user preferences for reduced motion
 */
function setupReducedMotion() {
  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (prefersReducedMotion) {
    // Add a class to the body to allow CSS targeting
    document.body.classList.add('reduced-motion');
    
    // Disable animations
    const animatedElements = document.querySelectorAll('.animate, .animation, [data-animation]');
    
    animatedElements.forEach(element => {
      element.style.animationDuration = '0.001s';
      element.style.transitionDuration = '0.001s';
    });
    
    // Pause the ticker animation if it exists
    const tickerWrap = document.querySelector('.ticker-wrap');
    if (tickerWrap) {
      tickerWrap.style.animationPlayState = 'paused';
    }
  }
  
  // Listen for changes to the prefers-reduced-motion setting
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => {
    if (event.matches) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  });
}

/**
 * Set up ARIA attributes for dynamic elements
 * Improves screen reader experience
 */
function setupAriaAttributes() {
  // Update aria-expanded for dropdown toggles
  const dropdownToggles = document.querySelectorAll('[data-toggle="dropdown"]');
  
  dropdownToggles.forEach(toggle => {
    toggle.setAttribute('aria-expanded', 'false');
    
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', (!expanded).toString());
    });
  });
  
  // Setup mobile menu accessibility
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenuClose = document.getElementById('mobile-menu-close');
  const headerNav = document.getElementById('header-nav');
  
  if (mobileMenuToggle && headerNav) {
    mobileMenuToggle.addEventListener('click', () => {
      const expanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
      mobileMenuToggle.setAttribute('aria-expanded', (!expanded).toString());
      
      if (!expanded) {
        headerNav.classList.add('active');
        document.getElementById('mobile-menu-overlay')?.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
      }
    });
  }
  
  if (mobileMenuClose && headerNav) {
    mobileMenuClose.addEventListener('click', () => {
      headerNav.classList.remove('active');
      mobileMenuToggle?.setAttribute('aria-expanded', 'false');
      document.getElementById('mobile-menu-overlay')?.classList.remove('active');
      document.body.style.overflow = ''; // Restore scrolling
    });
  }
  
  // Close mobile menu when overlay is clicked
  const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
  if (mobileMenuOverlay && headerNav) {
    mobileMenuOverlay.addEventListener('click', () => {
      headerNav.classList.remove('active');
      mobileMenuToggle?.setAttribute('aria-expanded', 'false');
      mobileMenuOverlay.classList.remove('active');
      document.body.style.overflow = ''; // Restore scrolling
    });
  }
}

/**
 * Set up form label associations for better accessibility
 */
function setupFormLabels() {
  // Find all inputs without explicit labels
  const inputs = document.querySelectorAll('input, select, textarea');
  
  inputs.forEach(input => {
    // Skip inputs that already have labels or don't need them
    if (
      input.id && document.querySelector(`label[for="${input.id}"]`) ||
      input.type === 'hidden' ||
      input.type === 'submit' ||
      input.type === 'button' ||
      input.type === 'reset'
    ) {
      return;
    }
    
    // If input has placeholder but no accessible name, add arialabel
    if (input.placeholder && !input.getAttribute('aria-label')) {
      input.setAttribute('aria-label', input.placeholder);
    }
    
    // Ensure inputs in error state are announced to screen readers
    if (input.classList.contains('is-invalid')) {
      const errorMessage = input.nextElementSibling?.classList.contains('invalid-feedback')
        ? input.nextElementSibling.textContent
        : 'Error en este campo';
      
      input.setAttribute('aria-invalid', 'true');
      
      // Connect error message with input
      const errorId = `error-${input.name || Math.random().toString(36).substring(2, 9)}`;
      input.setAttribute('aria-describedby', errorId);
      
      if (input.nextElementSibling?.classList.contains('invalid-feedback')) {
        input.nextElementSibling.id = errorId;
      }
    }
  });
}
