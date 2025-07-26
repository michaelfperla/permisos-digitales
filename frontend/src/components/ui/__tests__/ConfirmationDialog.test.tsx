import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { FaExclamationTriangle, FaTrash, FaCheck } from 'react-icons/fa';

// Mock ConfirmationDialog component based on Modal implementation
interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning';
  icon?: React.ComponentType;
  loading?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon: IconComponent,
  loading = false,
}) => {
  // Close modal when clicking outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close modal when pressing Escape key
  React.useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      data-testid="confirmation-overlay"
      onClick={handleOverlayClick}
    >
      <div
        className="modal-container confirmation-dialog"
        data-testid="confirmation-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          {IconComponent && (
            <div className={`dialog-icon dialog-icon-${variant}`} data-testid="dialog-icon">
              <IconComponent />
            </div>
          )}
          <h2 className="modal-title" data-testid="dialog-title">{title}</h2>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close dialog"
            data-testid="close-button"
            disabled={loading}
          >
            ×
          </button>
        </div>
        <div className="modal-content">
          <p className="dialog-message" data-testid="dialog-message">{message}</p>
        </div>
        <div className="modal-footer dialog-actions" data-testid="dialog-actions">
          <button
            className="button button-secondary"
            onClick={onClose}
            disabled={loading}
            data-testid="cancel-button"
          >
            {cancelText}
          </button>
          <button
            className={`button button-${variant === 'danger' ? 'danger' : 'primary'} ${loading ? 'loading' : ''}`}
            onClick={onConfirm}
            disabled={loading}
            data-testid="confirm-button"
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

describe('ConfirmationDialog', () => {
  const user = userEvent.setup();
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('Basic rendering', () => {
    it('should render when isOpen is true', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Confirm Action');
      expect(screen.getByTestId('dialog-message')).toHaveTextContent('Are you sure you want to proceed?');
    });

    it('should not render when isOpen is false', () => {
      render(<ConfirmationDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
    });

    it('should render default confirm and cancel buttons', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Confirm');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
    });

    it('should render custom button text when provided', () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          confirmText="Delete"
          cancelText="Keep"
        />
      );

      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Delete');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Keep');
    });

    it('should render close button', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', 'Close dialog');
    });
  });

  describe('Icon rendering', () => {
    it('should render without icon when not provided', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(screen.queryByTestId('dialog-icon')).not.toBeInTheDocument();
    });

    it('should render with icon when provided', () => {
      render(<ConfirmationDialog {...defaultProps} icon={FaExclamationTriangle} />);

      expect(screen.getByTestId('dialog-icon')).toBeInTheDocument();
    });

    it('should apply correct icon styling based on variant', () => {
      const { rerender } = render(
        <ConfirmationDialog
          {...defaultProps}
          icon={FaExclamationTriangle}
          variant="danger"
        />
      );

      expect(screen.getByTestId('dialog-icon')).toHaveClass('dialog-icon-danger');

      rerender(
        <ConfirmationDialog
          {...defaultProps}
          icon={FaExclamationTriangle}
          variant="warning"
        />
      );

      expect(screen.getByTestId('dialog-icon')).toHaveClass('dialog-icon-warning');
    });
  });

  describe('Button variants', () => {
    it('should apply default button styling', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toHaveClass('button-primary');
    });

    it('should apply danger button styling for danger variant', () => {
      render(<ConfirmationDialog {...defaultProps} variant="danger" />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toHaveClass('button-danger');
    });

    it('should apply primary button styling for warning variant', () => {
      render(<ConfirmationDialog {...defaultProps} variant="warning" />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toHaveClass('button-primary');
    });
  });

  describe('User interactions', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const confirmButton = screen.getByTestId('confirm-button');
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', async () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', async () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', async () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const overlay = screen.getByTestId('confirmation-overlay');
      await user.click(overlay);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when dialog content is clicked', async () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const dialog = screen.getByTestId('confirmation-dialog');
      await user.click(dialog);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose for other keys', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Space' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('should show loading state on confirm button when loading', () => {
      render(<ConfirmationDialog {...defaultProps} loading={true} />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toHaveTextContent('Processing...');
      expect(confirmButton).toHaveClass('loading');
      expect(confirmButton).toBeDisabled();
    });

    it('should disable all buttons when loading', () => {
      render(<ConfirmationDialog {...defaultProps} loading={true} />);

      expect(screen.getByTestId('confirm-button')).toBeDisabled();
      expect(screen.getByTestId('cancel-button')).toBeDisabled();
      expect(screen.getByTestId('close-button')).toBeDisabled();
    });

    it('should enable buttons when not loading', () => {
      render(<ConfirmationDialog {...defaultProps} loading={false} />);

      expect(screen.getByTestId('confirm-button')).not.toBeDisabled();
      expect(screen.getByTestId('cancel-button')).not.toBeDisabled();
      expect(screen.getByTestId('close-button')).not.toBeDisabled();
    });
  });

  describe('Body scroll prevention', () => {
    it('should prevent body scrolling when dialog is open', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scrolling when dialog is closed', () => {
      const { unmount } = render(<ConfirmationDialog {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });

    it('should restore body scrolling when isOpen changes to false', () => {
      const { rerender } = render(<ConfirmationDialog {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<ConfirmationDialog {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      expect(closeButton).toHaveAttribute('aria-label', 'Close dialog');
    });

    it('should support keyboard navigation', async () => {
      render(<ConfirmationDialog {...defaultProps} />);

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByTestId('close-button')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('cancel-button')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('confirm-button')).toHaveFocus();
    });

    it('should handle Enter key on focused buttons', async () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const confirmButton = screen.getByTestId('confirm-button');
      confirmButton.focus();

      await user.keyboard('{Enter}');

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should handle Space key on focused buttons', async () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-button');
      cancelButton.focus();

      await user.keyboard(' ');

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Common use cases', () => {
    it('should render delete confirmation dialog', () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          title="Delete Item"
          message="This action cannot be undone. Are you sure you want to delete this item?"
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          icon={FaTrash}
        />
      );

      expect(screen.getByText('Delete Item')).toBeInTheDocument();
      expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByTestId('dialog-icon')).toHaveClass('dialog-icon-danger');
    });

    it('should render save confirmation dialog', () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          title="Save Changes"
          message="Do you want to save your changes before leaving?"
          confirmText="Save"
          cancelText="Don't Save"
          variant="default"
          icon={FaCheck}
        />
      );

      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      expect(screen.getByText(/save your changes/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: "Don't Save" })).toBeInTheDocument();
    });

    it('should render warning confirmation dialog', () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          title="Warning"
          message="This action may have unintended consequences. Do you want to continue?"
          confirmText="Continue"
          cancelText="Cancel"
          variant="warning"
          icon={FaExclamationTriangle}
        />
      );

      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText(/unintended consequences/)).toBeInTheDocument();
      expect(screen.getByTestId('dialog-icon')).toHaveClass('dialog-icon-warning');
    });
  });

  describe('Edge cases', () => {
    it('should handle long titles gracefully', () => {
      const longTitle = 'This is a very long title that might wrap to multiple lines in the confirmation dialog';
      
      render(
        <ConfirmationDialog
          {...defaultProps}
          title={longTitle}
        />
      );

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(longTitle);
    });

    it('should handle long messages gracefully', () => {
      const longMessage = 'This is a very long message that provides detailed information about the action that is about to be performed and all the consequences that might result from it. The message should be properly displayed even when it contains a lot of text.';
      
      render(
        <ConfirmationDialog
          {...defaultProps}
          message={longMessage}
        />
      );

      expect(screen.getByTestId('dialog-message')).toHaveTextContent(longMessage);
    });

    it('should handle empty strings for button text', () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          confirmText=""
          cancelText=""
        />
      );

      expect(screen.getByTestId('confirm-button')).toBeEmptyDOMElement();
      expect(screen.getByTestId('cancel-button')).toBeEmptyDOMElement();
    });

    it('should handle rapid open/close cycles', async () => {
      const { rerender } = render(<ConfirmationDialog {...defaultProps} isOpen={false} />);

      rerender(<ConfirmationDialog {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();

      rerender(<ConfirmationDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();

      rerender(<ConfirmationDialog {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    });
  });

  describe('Event listener cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<ConfirmationDialog {...defaultProps} />);

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should clean up event listeners when dialog closes', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { rerender } = render(<ConfirmationDialog {...defaultProps} />);

      rerender(<ConfirmationDialog {...defaultProps} isOpen={false} />);

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should not re-render when props do not change', () => {
      const { rerender } = render(<ConfirmationDialog {...defaultProps} />);

      const firstDialog = screen.getByTestId('confirmation-dialog');

      rerender(<ConfirmationDialog {...defaultProps} />);

      const secondDialog = screen.getByTestId('confirmation-dialog');
      expect(firstDialog).toBe(secondDialog);
    });
  });
});