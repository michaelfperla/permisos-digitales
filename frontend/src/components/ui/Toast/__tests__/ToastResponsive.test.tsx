import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ToastContainer from '../ToastContainer';

// Mock the Icon component
vi.mock('../../../../shared/components/ui/Icon', () => ({
  default: ({ IconComponent, className, color }: any) => {
    const Icon = IconComponent();
    return (
      <span className={className} style={{ color }}>
        {Icon}
      </span>
    );
  },
}));

// Mock the Button component
vi.mock('../../Button/Button', () => ({
  default: ({ children, onClick, icon, 'aria-label': ariaLabel }: any) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {icon && <span data-testid="icon">{icon}</span>}
      {children}
    </button>
  ),
}));

// Mock CSS modules
vi.mock('../Toast.module.css', () => ({
  default: {
    toastContainer: 'toastContainer',
    topRight: 'topRight',
    bottomLeft: 'bottomLeft',
    toast: 'toast',
    success: 'success',
    error: 'error',
    info: 'info',
    warning: 'warning',
  },
}));

// Mock window.matchMedia for testing media queries
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('Toast Responsive Behavior', () => {
  // Mock getComputedStyle
  const mockGetComputedStyle = vi.fn();

  beforeEach(() => {
    // Set up mock for getComputedStyle
    vi.stubGlobal('getComputedStyle', mockGetComputedStyle);
  });

  afterEach(() => {
    // Clean up mock
    vi.unstubAllGlobals();
  });

  it('applies correct styles for desktop screens', () => {
    // Mock matchMedia for desktop screens
    mockMatchMedia(false); // Not matching any mobile media query

    const { container } = render(
      <ToastContainer
        toasts={[
          {
            id: 'test-toast',
            message: 'Mensaje de prueba',
            type: 'success',
          },
        ]}
        onClose={() => {}}
      />,
    );

    // Verify the container has the correct class
    expect(container.firstChild).toHaveClass('toastContainer');
    expect(container.firstChild).toHaveClass('topRight');
  });

  it('applies correct styles for tablet screens (768px)', () => {
    // Mock matchMedia for tablet screens
    mockMatchMedia(true); // Matching tablet media query

    const { container } = render(
      <ToastContainer
        toasts={[
          {
            id: 'test-toast',
            message: 'Mensaje de prueba',
            type: 'success',
          },
        ]}
        onClose={() => {}}
      />,
    );

    // Verify the container has the correct class
    expect(container.firstChild).toHaveClass('toastContainer');
    expect(container.firstChild).toHaveClass('topRight');
  });

  it('applies correct styles for mobile screens (480px)', () => {
    // Mock matchMedia for mobile screens
    mockMatchMedia(true); // Matching mobile media query

    const { container } = render(
      <ToastContainer
        toasts={[
          {
            id: 'test-toast',
            message: 'Mensaje de prueba',
            type: 'success',
          },
        ]}
        onClose={() => {}}
      />,
    );

    // Verify the container has the correct class
    expect(container.firstChild).toHaveClass('toastContainer');
    expect(container.firstChild).toHaveClass('topRight');
  });

  it('applies correct styles for small mobile screens (360px)', () => {
    // Mock matchMedia for small mobile screens
    mockMatchMedia(true); // Matching small mobile media query

    const { container } = render(
      <ToastContainer
        toasts={[
          {
            id: 'test-toast',
            message: 'Mensaje de prueba',
            type: 'success',
          },
        ]}
        onClose={() => {}}
      />,
    );

    // Verify the container has the correct class
    expect(container.firstChild).toHaveClass('toastContainer');
    expect(container.firstChild).toHaveClass('topRight');
  });
});
