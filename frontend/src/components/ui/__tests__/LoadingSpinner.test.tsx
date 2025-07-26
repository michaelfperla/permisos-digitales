import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  beforeEach(() => {
    // Reset any global styles
    document.body.style.overflow = '';
  });

  describe('Page variant (default)', () => {
    it('should render page spinner by default', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('spinnerContainer');
    });

    it('should render page spinner when variant is explicitly set', () => {
      render(<LoadingSpinner variant="page" />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('spinnerContainer');
    });

    it('should contain the spinner element', () => {
      render(<LoadingSpinner variant="page" />);

      const container = screen.getByTestId('loading-spinner');
      const spinnerElement = container.querySelector('.spinner');
      expect(spinnerElement).toBeInTheDocument();
    });

    it('should be accessible for screen readers', () => {
      render(<LoadingSpinner variant="page" />);

      const container = screen.getByTestId('loading-spinner');
      // Page variant doesn't have ARIA attributes on container, but inner spinner should have proper role
      expect(container).toBeInTheDocument();
    });
  });

  describe('Inline variant', () => {
    it('should render inline spinner', () => {
      render(<LoadingSpinner variant="inline" />);

      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('inlineSpinner');
    });

    it('should have proper accessibility attributes', () => {
      render(<LoadingSpinner variant="inline" />);

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('role', 'status');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });

    it('should render with default medium size', () => {
      render(<LoadingSpinner variant="inline" />);

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('inlineSpinner', 'size-md');
    });

    it('should render with small size when specified', () => {
      render(<LoadingSpinner variant="inline" size="sm" />);

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('inlineSpinner', 'size-sm');
    });

    it('should render with large size when specified', () => {
      render(<LoadingSpinner variant="inline" size="lg" />);

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('inlineSpinner', 'size-lg');
    });

    it('should apply custom color when provided', () => {
      render(<LoadingSpinner variant="inline" color="#ff0000" />);

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveStyle({
        borderTopColor: '#ff0000',
        borderRightColor: '#ff0000',
      });
    });

    it('should not apply color styles when color is not provided', () => {
      render(<LoadingSpinner variant="inline" />);

      const spinner = screen.getByRole('status');
      expect(spinner).not.toHaveAttribute('style');
    });

    it('should handle different color formats', () => {
      const { rerender } = render(<LoadingSpinner variant="inline" color="red" />);

      let spinner = screen.getByRole('status');
      expect(spinner).toHaveStyle({
        borderTopColor: 'red',
        borderRightColor: 'red',
      });

      rerender(<LoadingSpinner variant="inline" color="rgb(255, 0, 0)" />);
      
      spinner = screen.getByRole('status');
      expect(spinner).toHaveStyle({
        borderTopColor: 'rgb(255, 0, 0)',
        borderRightColor: 'rgb(255, 0, 0)',
      });

      rerender(<LoadingSpinner variant="inline" color="var(--primary-color)" />);
      
      spinner = screen.getByRole('status');
      expect(spinner).toHaveStyle({
        borderTopColor: 'var(--primary-color)',
        borderRightColor: 'var(--primary-color)',
      });
    });
  });

  describe('Component props combinations', () => {
    it('should handle all size options for inline variant', () => {
      const sizes = ['sm', 'md', 'lg'] as const;

      sizes.forEach((size) => {
        const { unmount } = render(<LoadingSpinner variant="inline" size={size} />);
        
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('inlineSpinner', `size-${size}`);
        
        unmount();
      });
    });

    it('should ignore size prop for page variant', () => {
      render(<LoadingSpinner variant="page" size="lg" />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).not.toHaveClass('size-lg');
      expect(spinner).toHaveClass('spinnerContainer');
    });

    it('should ignore color prop for page variant', () => {
      render(<LoadingSpinner variant="page" color="#ff0000" />);

      const container = screen.getByTestId('loading-spinner');
      expect(container).not.toHaveAttribute('style');
    });
  });

  describe('Rendering edge cases', () => {
    it('should handle empty color string', () => {
      render(<LoadingSpinner variant="inline" color="" />);

      const spinner = screen.getByRole('status');
      expect(spinner).not.toHaveAttribute('style');
    });

    it('should handle undefined color', () => {
      render(<LoadingSpinner variant="inline" color={undefined} />);

      const spinner = screen.getByRole('status');
      expect(spinner).not.toHaveAttribute('style');
    });

    it('should render consistently with multiple instances', () => {
      render(
        <div>
          <LoadingSpinner variant="inline" size="sm" />
          <LoadingSpinner variant="page" />
          <LoadingSpinner variant="inline" size="lg" color="blue" />
        </div>
      );

      const inlineSpinners = screen.getAllByRole('status');
      const pageSpinner = screen.getByTestId('loading-spinner');

      expect(inlineSpinners).toHaveLength(2);
      expect(pageSpinner).toBeInTheDocument();

      expect(inlineSpinners[0]).toHaveClass('size-sm');
      expect(inlineSpinners[1]).toHaveClass('size-lg');
      expect(inlineSpinners[1]).toHaveStyle({
        borderTopColor: 'blue',
        borderRightColor: 'blue',
      });
    });
  });

  describe('Accessibility features', () => {
    it('should provide appropriate semantic markup for inline spinner', () => {
      render(<LoadingSpinner variant="inline" />);

      const spinner = screen.getByRole('status');
      expect(spinner.tagName).toBe('SPAN');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });

    it('should be keyboard accessible', () => {
      render(<LoadingSpinner variant="inline" />);

      const spinner = screen.getByRole('status');
      // Spinner should not be focusable as it's just a visual indicator
      expect(spinner).not.toHaveAttribute('tabIndex');
    });

    it('should work with screen readers', () => {
      render(<LoadingSpinner variant="inline" />);

      const spinner = screen.getByLabelText('Loading');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('role', 'status');
    });
  });

  describe('CSS classes and styling', () => {
    it('should apply correct CSS classes for page variant', () => {
      render(<LoadingSpinner variant="page" />);

      const container = screen.getByTestId('loading-spinner');
      const spinnerElement = container.querySelector('.spinner');

      expect(container).toHaveClass('spinnerContainer');
      expect(spinnerElement).toHaveClass('spinner');
    });

    it('should apply correct CSS classes for inline variant', () => {
      render(<LoadingSpinner variant="inline" size="md" />);

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('inlineSpinner', 'size-md');
    });

    it('should handle class combinations correctly', () => {
      render(<LoadingSpinner variant="inline" size="sm" />);

      const spinner = screen.getByRole('status');
      expect(spinner.className).toContain('inlineSpinner');
      expect(spinner.className).toContain('size-sm');
    });
  });

  describe('Performance considerations', () => {
    it('should not re-render unnecessarily with same props', () => {
      const { rerender } = render(<LoadingSpinner variant="inline" size="md" />);

      const firstSpinner = screen.getByRole('status');
      
      rerender(<LoadingSpinner variant="inline" size="md" />);
      
      const secondSpinner = screen.getByRole('status');
      expect(firstSpinner).toBe(secondSpinner);
    });

    it('should update when props change', () => {
      const { rerender } = render(<LoadingSpinner variant="inline" size="sm" />);

      let spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('size-sm');

      rerender(<LoadingSpinner variant="inline" size="lg" />);

      spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('size-lg');
      expect(spinner).not.toHaveClass('size-sm');
    });
  });

  describe('Integration scenarios', () => {
    it('should work inside buttons', () => {
      render(
        <button>
          <LoadingSpinner variant="inline" size="sm" />
          Loading...
        </button>
      );

      const button = screen.getByRole('button');
      const spinner = screen.getByRole('status');

      expect(button).toContainElement(spinner);
      expect(button).toHaveTextContent('Loading...');
    });

    it('should work in different container contexts', () => {
      render(
        <div style={{ backgroundColor: 'dark' }}>
          <LoadingSpinner variant="inline" color="white" />
        </div>
      );

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveStyle({
        borderTopColor: 'white',
        borderRightColor: 'white',
      });
    });

    it('should work with conditional rendering', () => {
      const { rerender } = render(
        <div>
          {true && <LoadingSpinner variant="inline" />}
        </div>
      );

      expect(screen.getByRole('status')).toBeInTheDocument();

      rerender(
        <div>
          {false && <LoadingSpinner variant="inline" />}
        </div>
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});