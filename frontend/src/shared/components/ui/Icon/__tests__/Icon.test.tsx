import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import Icon from '../Icon';

// Mock a simple react-icon component
const MockIcon = vi.fn(() => <svg data-testid="mock-svg">Mock SVG</svg>);

describe('Icon Component', () => {
  it('renders with default props', () => {
    render(<Icon IconComponent={MockIcon} />);
    const iconElement = screen.getByTestId('mock-svg');
    expect(iconElement).toBeInTheDocument();

    // Check that the parent span has aria-hidden="true" by default
    const spanElement = iconElement.parentElement;
    expect(spanElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the correct size class for predefined sizes', () => {
    const { rerender } = render(<Icon IconComponent={MockIcon} size="xs" />);
    let spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).toHaveClass('sizeXs');

    rerender(<Icon IconComponent={MockIcon} size="sm" />);
    spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).toHaveClass('sizeSm');

    rerender(<Icon IconComponent={MockIcon} size="md" />);
    spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).toHaveClass('sizeMd');

    rerender(<Icon IconComponent={MockIcon} size="lg" />);
    spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).toHaveClass('sizeLg');

    rerender(<Icon IconComponent={MockIcon} size="xl" />);
    spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).toHaveClass('sizeXl');
  });

  it('applies custom size as inline style', () => {
    render(<Icon IconComponent={MockIcon} size="2rem" />);
    const spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).toHaveStyle('font-size: 2rem');
  });

  it('applies color as inline style', () => {
    render(<Icon IconComponent={MockIcon} color="var(--color-primary)" />);
    const spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).toHaveStyle('color: var(--color-primary)');
  });

  it('applies additional className', () => {
    render(<Icon IconComponent={MockIcon} className="custom-class" />);
    const spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).toHaveClass('custom-class');
  });

  it('handles non-decorative icons with aria-label', () => {
    render(<Icon IconComponent={MockIcon} decorative={false} ariaLabel="Warning icon" />);
    const spanElement = screen.getByTestId('mock-svg').parentElement;
    expect(spanElement).not.toHaveAttribute('aria-hidden');
    expect(spanElement).toHaveAttribute('aria-label', 'Warning icon');
    expect(spanElement).toHaveAttribute('role', 'img');
  });

  it('falls back to decorative when non-decorative but no ariaLabel provided', () => {
    // Mock console.warn to avoid test output noise
    const originalWarn = console.warn;
    console.warn = vi.fn();

    render(<Icon IconComponent={MockIcon} decorative={false} />);
    const spanElement = screen.getByTestId('mock-svg').parentElement;

    // Should fall back to aria-hidden="true"
    expect(spanElement).toHaveAttribute('aria-hidden', 'true');
    expect(console.warn).toHaveBeenCalled();

    // Restore console.warn
    console.warn = originalWarn;
  });
});
