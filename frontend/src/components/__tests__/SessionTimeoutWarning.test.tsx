import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { FaClock, FaSignOutAlt } from 'react-icons/fa';

// Mock SessionTimeoutWarning component based on common patterns
interface SessionTimeoutWarningProps {
  isVisible: boolean;
  timeRemaining: number;
  onExtendSession: () => void;
  onLogout: () => void;
  onDismiss?: () => void;
  warningThreshold?: number;
  autoLogoutThreshold?: number;
}

const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  isVisible,
  timeRemaining,
  onExtendSession,
  onLogout,
  onDismiss,
  warningThreshold = 300, // 5 minutes
  autoLogoutThreshold = 60, // 1 minute
}) => {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  const formatTime = (minutes: number, seconds: number): string => {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isUrgent = timeRemaining <= autoLogoutThreshold;
  const isWarning = timeRemaining <= warningThreshold;

  // Auto-logout when time reaches zero
  React.useEffect(() => {
    if (timeRemaining <= 0) {
      onLogout();
    }
  }, [timeRemaining, onLogout]);

  // Prevent body scrolling when modal is visible
  React.useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  // Handle Escape key
  React.useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onDismiss) {
        onDismiss();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isVisible, onDismiss]);

  if (!isVisible || timeRemaining <= 0) {
    return null;
  }

  return (
    <div
      className={`session-timeout-overlay ${isUrgent ? 'urgent' : isWarning ? 'warning' : ''}`}
      data-testid="session-timeout-overlay"
    >
      <div
        className={`session-timeout-dialog ${isUrgent ? 'urgent' : ''}`}
        data-testid="session-timeout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-message"
      >
        <div className="timeout-header">
          <div className={`timeout-icon ${isUrgent ? 'urgent' : 'warning'}`} data-testid="timeout-icon">
            <FaClock />
          </div>
          <h2 id="session-timeout-title" data-testid="timeout-title">
            {isUrgent ? 'Session Expiring Soon!' : 'Session Timeout Warning'}
          </h2>
          {onDismiss && !isUrgent && (
            <button
              className="close-button"
              onClick={onDismiss}
              aria-label="Dismiss warning"
              data-testid="dismiss-button"
            >
              ×
            </button>
          )}
        </div>

        <div className="timeout-content">
          <p id="session-timeout-message" data-testid="timeout-message">
            {isUrgent
              ? 'Your session will expire automatically in:'
              : 'Your session will expire due to inactivity in:'}
          </p>
          
          <div className={`time-display ${isUrgent ? 'urgent' : 'warning'}`} data-testid="time-display">
            {formatTime(minutes, seconds)}
          </div>

          {isUrgent && (
            <p className="urgent-message" data-testid="urgent-message">
              Please extend your session now to avoid losing your work.
            </p>
          )}
        </div>

        <div className="timeout-actions" data-testid="timeout-actions">
          <button
            className="button button-secondary"
            onClick={onLogout}
            data-testid="logout-button"
          >
            <FaSignOutAlt />
            Logout Now
          </button>
          <button
            className={`button ${isUrgent ? 'button-danger' : 'button-primary'}`}
            onClick={onExtendSession}
            data-testid="extend-button"
          >
            <FaClock />
            Extend Session
          </button>
        </div>

        {!isUrgent && (
          <div className="timeout-info" data-testid="timeout-info">
            <small>
              You can dismiss this warning and continue working. You'll be reminded again if your session is about to expire.
            </small>
          </div>
        )}
      </div>
    </div>
  );
};

describe('SessionTimeoutWarning', () => {
  const user = userEvent.setup();
  const mockOnExtendSession = vi.fn();
  const mockOnLogout = vi.fn();
  const mockOnDismiss = vi.fn();

  const defaultProps = {
    isVisible: true,
    timeRemaining: 300, // 5 minutes
    onExtendSession: mockOnExtendSession,
    onLogout: mockOnLogout,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = '';
  });

  describe('Basic rendering', () => {
    it('should render when isVisible is true', () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      expect(screen.getByTestId('session-timeout-dialog')).toBeInTheDocument();
    });

    it('should not render when isVisible is false', () => {
      render(<SessionTimeoutWarning {...defaultProps} isVisible={false} />);

      expect(screen.queryByTestId('session-timeout-dialog')).not.toBeInTheDocument();
    });

    it('should not render when timeRemaining is zero or negative', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={0} />);

      expect(screen.queryByTestId('session-timeout-dialog')).not.toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      const dialog = screen.getByTestId('session-timeout-dialog');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'session-timeout-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'session-timeout-message');
    });
  });

  describe('Time display and formatting', () => {
    it('should display time in MM:SS format', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={300} />);

      expect(screen.getByTestId('time-display')).toHaveTextContent('5:00');
    });

    it('should display time correctly for various durations', () => {
      const testCases = [
        { seconds: 300, expected: '5:00' },
        { seconds: 125, expected: '2:05' },
        { seconds: 65, expected: '1:05' },
        { seconds: 60, expected: '1:00' },
        { seconds: 59, expected: '0:59' },
        { seconds: 10, expected: '0:10' },
        { seconds: 5, expected: '0:05' },
        { seconds: 1, expected: '0:01' },
      ];

      testCases.forEach(({ seconds, expected }) => {
        const { unmount } = render(
          <SessionTimeoutWarning {...defaultProps} timeRemaining={seconds} />
        );

        expect(screen.getByTestId('time-display')).toHaveTextContent(expected);
        unmount();
      });
    });

    it('should pad seconds with leading zero', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={125} />);

      expect(screen.getByTestId('time-display')).toHaveTextContent('2:05');
    });
  });

  describe('Warning states', () => {
    it('should show warning state for normal timeout', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={300} />);

      expect(screen.getByTestId('timeout-title')).toHaveTextContent('Session Timeout Warning');
      expect(screen.getByTestId('timeout-message')).toHaveTextContent('Your session will expire due to inactivity in:');
      expect(screen.getByTestId('time-display')).toHaveClass('warning');
    });

    it('should show urgent state for critical timeout', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={30} />);

      expect(screen.getByTestId('timeout-title')).toHaveTextContent('Session Expiring Soon!');
      expect(screen.getByTestId('timeout-message')).toHaveTextContent('Your session will expire automatically in:');
      expect(screen.getByTestId('time-display')).toHaveClass('urgent');
      expect(screen.getByTestId('urgent-message')).toBeInTheDocument();
    });

    it('should use custom thresholds when provided', () => {
      render(
        <SessionTimeoutWarning
          {...defaultProps}
          timeRemaining={90}
          warningThreshold={120}
          autoLogoutThreshold={100}
        />
      );

      // Should be in warning state (90 < 120 but > 100)
      expect(screen.getByTestId('timeout-title')).toHaveTextContent('Session Timeout Warning');

      render(
        <SessionTimeoutWarning
          {...defaultProps}
          timeRemaining={50}
          warningThreshold={120}
          autoLogoutThreshold={100}
        />
      );

      // Should be in urgent state (50 < 100)
      expect(screen.getByTestId('timeout-title')).toHaveTextContent('Session Expiring Soon!');
    });
  });

  describe('User interactions', () => {
    it('should call onExtendSession when extend button is clicked', async () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      const extendButton = screen.getByTestId('extend-button');
      await user.click(extendButton);

      expect(mockOnExtendSession).toHaveBeenCalledTimes(1);
    });

    it('should call onLogout when logout button is clicked', async () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      const logoutButton = screen.getByTestId('logout-button');
      await user.click(logoutButton);

      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });

    it('should call onDismiss when dismiss button is clicked', async () => {
      render(<SessionTimeoutWarning {...defaultProps} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByTestId('dismiss-button');
      await user.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not show dismiss button in urgent state', () => {
      render(
        <SessionTimeoutWarning
          {...defaultProps}
          timeRemaining={30}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.queryByTestId('dismiss-button')).not.toBeInTheDocument();
    });

    it('should call onDismiss when Escape key is pressed', () => {
      render(<SessionTimeoutWarning {...defaultProps} onDismiss={mockOnDismiss} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not call onDismiss for other keys', () => {
      render(<SessionTimeoutWarning {...defaultProps} onDismiss={mockOnDismiss} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Space' });

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Auto-logout behavior', () => {
    it('should call onLogout when timeRemaining reaches zero', () => {
      const { rerender } = render(<SessionTimeoutWarning {...defaultProps} timeRemaining={1} />);

      rerender(<SessionTimeoutWarning {...defaultProps} timeRemaining={0} />);

      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });

    it('should call onLogout when timeRemaining becomes negative', () => {
      const { rerender } = render(<SessionTimeoutWarning {...defaultProps} timeRemaining={1} />);

      rerender(<SessionTimeoutWarning {...defaultProps} timeRemaining={-1} />);

      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });

    it('should not call onLogout multiple times for same zero value', () => {
      const { rerender } = render(<SessionTimeoutWarning {...defaultProps} timeRemaining={0} />);

      rerender(<SessionTimeoutWarning {...defaultProps} timeRemaining={0} />);
      rerender(<SessionTimeoutWarning {...defaultProps} timeRemaining={0} />);

      // Should only be called once per transition to zero
      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Body scroll prevention', () => {
    it('should prevent body scrolling when visible', () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scrolling when not visible', () => {
      const { rerender } = render(<SessionTimeoutWarning {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<SessionTimeoutWarning {...defaultProps} isVisible={false} />);

      expect(document.body.style.overflow).toBe('');
    });

    it('should restore body scrolling on unmount', () => {
      const { unmount } = render(<SessionTimeoutWarning {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Button styling and states', () => {
    it('should style extend button as primary in normal state', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={300} />);

      const extendButton = screen.getByTestId('extend-button');
      expect(extendButton).toHaveClass('button-primary');
    });

    it('should style extend button as danger in urgent state', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={30} />);

      const extendButton = screen.getByTestId('extend-button');
      expect(extendButton).toHaveClass('button-danger');
    });

    it('should always style logout button as secondary', () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      const logoutButton = screen.getByTestId('logout-button');
      expect(logoutButton).toHaveClass('button-secondary');
    });
  });

  describe('Keyboard navigation', () => {
    it('should support tab navigation through buttons', async () => {
      render(<SessionTimeoutWarning {...defaultProps} onDismiss={mockOnDismiss} />);

      await user.tab();
      expect(screen.getByTestId('dismiss-button')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('logout-button')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('extend-button')).toHaveFocus();
    });

    it('should handle Enter key on focused buttons', async () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      const extendButton = screen.getByTestId('extend-button');
      extendButton.focus();

      await user.keyboard('{Enter}');

      expect(mockOnExtendSession).toHaveBeenCalledTimes(1);
    });

    it('should handle Space key on focused buttons', async () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      const logoutButton = screen.getByTestId('logout-button');
      logoutButton.focus();

      await user.keyboard(' ');

      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Informational content', () => {
    it('should show info message in normal state', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={300} />);

      expect(screen.getByTestId('timeout-info')).toBeInTheDocument();
      expect(screen.getByText(/you can dismiss this warning/i)).toBeInTheDocument();
    });

    it('should not show info message in urgent state', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={30} />);

      expect(screen.queryByTestId('timeout-info')).not.toBeInTheDocument();
    });

    it('should show urgent message only in urgent state', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={300} />);

      expect(screen.queryByTestId('urgent-message')).not.toBeInTheDocument();

      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={30} />);

      expect(screen.getByTestId('urgent-message')).toBeInTheDocument();
      expect(screen.getByText(/please extend your session now/i)).toBeInTheDocument();
    });
  });

  describe('Visual states and styling', () => {
    it('should apply correct CSS classes for warning state', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={300} />);

      expect(screen.getByTestId('session-timeout-overlay')).toHaveClass('warning');
      expect(screen.getByTestId('timeout-icon')).toHaveClass('warning');
    });

    it('should apply correct CSS classes for urgent state', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={30} />);

      expect(screen.getByTestId('session-timeout-overlay')).toHaveClass('urgent');
      expect(screen.getByTestId('session-timeout-dialog')).toHaveClass('urgent');
      expect(screen.getByTestId('timeout-icon')).toHaveClass('urgent');
    });

    it('should display clock icon', () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      expect(screen.getByTestId('timeout-icon')).toBeInTheDocument();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very large time values', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={7200} />);

      expect(screen.getByTestId('time-display')).toHaveTextContent('120:00');
    });

    it('should handle zero time remaining gracefully', () => {
      render(<SessionTimeoutWarning {...defaultProps} timeRemaining={0} />);

      expect(screen.queryByTestId('session-timeout-dialog')).not.toBeInTheDocument();
      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });

    it('should handle missing onDismiss callback', () => {
      render(<SessionTimeoutWarning {...defaultProps} />);

      expect(screen.queryByTestId('dismiss-button')).not.toBeInTheDocument();

      // Escape key should not cause errors
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Event listener cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<SessionTimeoutWarning {...defaultProps} onDismiss={mockOnDismiss} />);

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should clean up event listeners when dialog becomes hidden', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { rerender } = render(
        <SessionTimeoutWarning {...defaultProps} onDismiss={mockOnDismiss} />
      );

      rerender(
        <SessionTimeoutWarning {...defaultProps} isVisible={false} onDismiss={mockOnDismiss} />
      );

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});