import React, { forwardRef } from 'react';
import { FaSpinner } from 'react-icons/fa';

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Fully accessible button component for admin portal
 * Meets WCAG 2.1 AA standards with proper ARIA support
 */
const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText = 'Procesando...',
    icon,
    iconPosition = 'left',
    fullWidth = false,
    children,
    disabled,
    className = '',
    ...props
  }, ref) => {
    const baseClasses = 'accessible-button';
    const variantClasses = `button-${variant}`;
    const sizeClasses = `button-${size}`;
    const stateClasses = [
      loading && 'button-loading',
      disabled && 'button-disabled',
      fullWidth && 'button-full-width'
    ].filter(Boolean).join(' ');

    const buttonClasses = [baseClasses, variantClasses, sizeClasses, stateClasses, className]
      .filter(Boolean)
      .join(' ');

    const isDisabled = disabled || loading;

    const renderContent = () => {
      if (loading) {
        return (
          <>
            <FaSpinner className="loading-spinner" aria-hidden="true" />
            <span className="button-text">{loadingText}</span>
          </>
        );
      }

      return (
        <>
          {icon && iconPosition === 'left' && (
            <span className="button-icon icon-left" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="button-text">{children}</span>
          {icon && iconPosition === 'right' && (
            <span className="button-icon icon-right" aria-hidden="true">
              {icon}
            </span>
          )}
        </>
      );
    };

    return (
      <>
        <button
          ref={ref}
          className={buttonClasses}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          aria-busy={loading}
          {...props}
        >
          {renderContent()}
        </button>

        <style jsx>{`
          .accessible-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            border: none;
            border-radius: 8px;
            font-family: inherit;
            font-size: 0.875rem;
            font-weight: 600;
            line-height: 1;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            text-decoration: none;
            white-space: nowrap;
            user-select: none;
            position: relative;
            overflow: hidden;
          }

          /* Focus styles for accessibility */
          .accessible-button:focus {
            outline: none;
          }

          .accessible-button:focus-visible {
            outline: 2px solid #a72b31;
            outline-offset: 2px;
            box-shadow: 0 0 0 4px rgba(167, 43, 49, 0.2);
          }

          /* Variant styles */
          .button-primary {
            background: linear-gradient(135deg, #a72b31, #852023);
            color: white;
            box-shadow: 0 2px 4px rgba(167, 43, 49, 0.3);
          }

          .button-primary:hover:not(:disabled) {
            background: linear-gradient(135deg, #852023, #6a1a1d);
            box-shadow: 0 4px 8px rgba(167, 43, 49, 0.4);
            transform: translateY(-1px);
          }

          .button-primary:active {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(167, 43, 49, 0.3);
          }

          .button-secondary {
            background: white;
            color: #495057;
            border: 2px solid #dee2e6;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .button-secondary:hover:not(:disabled) {
            background: #f8f9fa;
            border-color: #a72b31;
            color: #a72b31;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          }

          .button-danger {
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
            box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
          }

          .button-danger:hover:not(:disabled) {
            background: linear-gradient(135deg, #c82333, #a71e2a);
            box-shadow: 0 4px 8px rgba(220, 53, 69, 0.4);
            transform: translateY(-1px);
          }

          .button-success {
            background: linear-gradient(135deg, #198754, #146c43);
            color: white;
            box-shadow: 0 2px 4px rgba(25, 135, 84, 0.3);
          }

          .button-success:hover:not(:disabled) {
            background: linear-gradient(135deg, #146c43, #0f5132);
            box-shadow: 0 4px 8px rgba(25, 135, 84, 0.4);
            transform: translateY(-1px);
          }

          .button-warning {
            background: linear-gradient(135deg, #ffc107, #e0a800);
            color: #212529;
            box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3);
          }

          .button-warning:hover:not(:disabled) {
            background: linear-gradient(135deg, #e0a800, #c69500);
            box-shadow: 0 4px 8px rgba(255, 193, 7, 0.4);
            transform: translateY(-1px);
          }

          /* Size variants */
          .button-sm {
            padding: 0.5rem 0.75rem;
            font-size: 0.8125rem;
            border-radius: 6px;
          }

          .button-lg {
            padding: 1rem 1.5rem;
            font-size: 1rem;
            border-radius: 10px;
          }

          /* State styles */
          .button-loading {
            cursor: wait;
            pointer-events: none;
          }

          .button-disabled {
            opacity: 0.6;
            cursor: not-allowed;
            pointer-events: none;
            transform: none !important;
            box-shadow: none !important;
          }

          .button-full-width {
            width: 100%;
          }

          /* Icon styles */
          .button-icon {
            display: flex;
            align-items: center;
            font-size: 0.875em;
          }

          .loading-spinner {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          /* High contrast mode support */
          @media (prefers-contrast: high) {
            .accessible-button {
              border: 2px solid;
              font-weight: 700;
            }

            .button-primary {
              background: #000;
              color: #fff;
              border-color: #000;
            }

            .button-secondary {
              background: #fff;
              color: #000;
              border-color: #000;
            }
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .accessible-button {
              transition: none;
            }

            .loading-spinner {
              animation: none;
            }
          }

          /* Mobile optimizations */
          @media (max-width: 768px) {
            .accessible-button {
              min-height: 44px; /* iOS accessibility minimum */
              padding: 0.875rem 1rem;
            }

            .button-sm {
              min-height: 36px;
              padding: 0.625rem 0.875rem;
            }

            .button-lg {
              padding: 1.125rem 1.5rem;
            }
          }
        `}</style>
      </>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;