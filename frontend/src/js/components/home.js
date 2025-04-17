/**
 * Home page component
 * Handles functionality specific to the home page
 */

/**
 * Initialize the home page
 */
export function initHome() {
  console.log('[Home] Initializing home page');
  
  // Initialize hero section animations
  initHeroAnimations();
  
  // Initialize benefits section
  initBenefitsSection();
  
  // Initialize How It Works section
  initHowItWorksSection();
  
  // Initialize CTA section
  initCtaSection();
}

/**
 * Initialize hero section animations
 */
function initHeroAnimations() {
  // Add decorative elements dynamically
  const heroSection = document.querySelector('.hero-section');
  
  if (!heroSection) {
    return;
  }
  
  // Create decorative elements container if it doesn't exist
  let decorativeElements = heroSection.querySelector('.hero-decorative-elements');
  if (!decorativeElements) {
    decorativeElements = document.createElement('div');
    decorativeElements.className = 'hero-decorative-elements';
    heroSection.appendChild(decorativeElements);
  }
  
  // Create decorative elements
  createDecorativeElements(decorativeElements);
  
  // Add subtle parallax effect on mouse movement
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    heroSection.addEventListener('mousemove', (e) => {
      const mouseX = e.clientX / window.innerWidth;
      const mouseY = e.clientY / window.innerHeight;
      
      // Move decorative elements based on mouse position
      const decorativeCircles = decorativeElements.querySelectorAll('.decorative-circle');
      const decorativeDots = decorativeElements.querySelectorAll('.decorative-dot');
      const decorativeLines = decorativeElements.querySelectorAll('.decorative-line');
      
      decorativeCircles.forEach((circle, index) => {
        const factor = (index + 1) * 5;
        const x = (mouseX - 0.5) * factor;
        const y = (mouseY - 0.5) * factor;
        circle.style.transform = `translate(${x}px, ${y}px)`;
      });
      
      decorativeDots.forEach((dot, index) => {
        const factor = (index + 1) * 3;
        const x = (mouseX - 0.5) * factor;
        const y = (mouseY - 0.5) * factor;
        dot.style.transform = `translate(${x}px, ${y}px)`;
      });
      
      decorativeLines.forEach((line, index) => {
        const factor = (index + 1) * 2;
        const x = (mouseX - 0.5) * factor;
        const y = (mouseY - 0.5) * factor;
        line.style.transform = `translate(${x}px, ${y}px) rotate(${line.dataset.rotation}deg)`;
      });
    });
  }
}

/**
 * Create decorative elements for the hero section
 * @param {HTMLElement} container - The container to add elements to
 */
function createDecorativeElements(container) {
  // Create decorative circles
  const circle1 = document.createElement('div');
  circle1.className = 'decorative-circle decorative-circle-1';
  container.appendChild(circle1);
  
  const circle2 = document.createElement('div');
  circle2.className = 'decorative-circle decorative-circle-2';
  container.appendChild(circle2);
  
  // Create decorative lines
  const line1 = document.createElement('div');
  line1.className = 'decorative-line decorative-line-1';
  line1.dataset.rotation = '-15';
  container.appendChild(line1);
  
  const line2 = document.createElement('div');
  line2.className = 'decorative-line decorative-line-2';
  line2.dataset.rotation = '10';
  container.appendChild(line2);
  
  // Create decorative dots
  const dot1 = document.createElement('div');
  dot1.className = 'decorative-dot decorative-dot-1';
  container.appendChild(dot1);
  
  const dot2 = document.createElement('div');
  dot2.className = 'decorative-dot decorative-dot-2';
  container.appendChild(dot2);
  
  const dot3 = document.createElement('div');
  dot3.className = 'decorative-dot decorative-dot-3';
  container.appendChild(dot3);
}

/**
 * Initialize benefits section
 */
function initBenefitsSection() {
  // Add animation on scroll
  const benefitItems = document.querySelectorAll('.benefit-item');
  
  if (benefitItems.length === 0) {
    return;
  }
  
  // Only set up animations if reduced motion is not preferred
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let delay = 0;
    
    benefitItems.forEach(item => {
      // Set initial state
      item.style.opacity = '0';
      item.style.transform = 'translateY(20px)';
      item.style.transition = `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`;
      
      // Increase delay for next item
      delay += 0.1;
    });
    
    // Function to check if element is in viewport
    const isInViewport = (element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.8 &&
        rect.bottom >= 0
      );
    };
    
    // Function to handle scroll
    const handleScroll = () => {
      benefitItems.forEach(item => {
        if (isInViewport(item)) {
          item.style.opacity = '1';
          item.style.transform = 'translateY(0)';
        }
      });
    };
    
    // Check on initial load
    handleScroll();
    
    // Listen for scroll events
    window.addEventListener('scroll', handleScroll);
  }
}

/**
 * Initialize How It Works section
 */
function initHowItWorksSection() {
  // Similar to benefits section, add animations on scroll
  const stepItems = document.querySelectorAll('.step-item');
  
  if (stepItems.length === 0) {
    return;
  }
  
  // Only set up animations if reduced motion is not preferred
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let delay = 0;
    
    stepItems.forEach(item => {
      // Set initial state
      item.style.opacity = '0';
      item.style.transform = 'translateY(20px)';
      item.style.transition = `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`;
      
      // Increase delay for next item
      delay += 0.1;
    });
    
    // Function to check if element is in viewport
    const isInViewport = (element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.8 &&
        rect.bottom >= 0
      );
    };
    
    // Function to handle scroll
    const handleScroll = () => {
      stepItems.forEach(item => {
        if (isInViewport(item)) {
          item.style.opacity = '1';
          item.style.transform = 'translateY(0)';
        }
      });
    };
    
    // Check on initial load
    handleScroll();
    
    // Listen for scroll events
    window.addEventListener('scroll', handleScroll);
  }
}

/**
 * Initialize CTA section
 */
function initCtaSection() {
  const ctaSection = document.querySelector('.final-cta-section');
  
  if (!ctaSection) {
    return;
  }
  
  // Add decorative elements
  let decorativeElements = ctaSection.querySelector('.decorative-elements');
  if (!decorativeElements) {
    decorativeElements = document.createElement('div');
    decorativeElements.className = 'decorative-elements';
    ctaSection.appendChild(decorativeElements);
  }
  
  // Create decorative elements
  const circle = document.createElement('div');
  circle.className = 'decorative-circle-cta';
  decorativeElements.appendChild(circle);
  
  const line = document.createElement('div');
  line.className = 'decorative-line-cta';
  decorativeElements.appendChild(line);
}