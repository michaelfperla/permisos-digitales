import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { FaInbox, FaSearch, FaExclamationTriangle } from 'react-icons/fa';

// Mock EmptyState component based on MobileDataCards implementation
interface EmptyStateProps {
  icon?: React.ComponentType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconComponent,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`empty-state ${className}`} data-testid="empty-state">
      {IconComponent && (
        <div className="empty-icon" data-testid="empty-icon">
          <IconComponent />
        </div>
      )}
      <h3 className="empty-title" data-testid="empty-title">{title}</h3>
      <p className="empty-description" data-testid="empty-description">{description}</p>
      {action && (
        <button
          className="empty-action-button"
          onClick={action.onClick}
          data-testid="empty-action"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

describe('EmptyState', () => {
  const user = userEvent.setup();
  const mockAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render title and description', () => {
      render(
        <EmptyState
          title="No data found"
          description="There are no items to display at this time."
        />
      );

      expect(screen.getByTestId('empty-title')).toHaveTextContent('No data found');
      expect(screen.getByTestId('empty-description')).toHaveTextContent('There are no items to display at this time.');
    });

    it('should render without icon when not provided', () => {
      render(
        <EmptyState
          title="No results"
          description="Try adjusting your search criteria."
        />
      );

      expect(screen.queryByTestId('empty-icon')).not.toBeInTheDocument();
    });

    it('should render with icon when provided', () => {
      render(
        <EmptyState
          icon={FaInbox}
          title="Empty inbox"
          description="No messages to display."
        />
      );

      expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    });

    it('should render without action button when not provided', () => {
      render(
        <EmptyState
          title="No data"
          description="Nothing to show here."
        />
      );

      expect(screen.queryByTestId('empty-action')).not.toBeInTheDocument();
    });

    it('should render with action button when provided', () => {
      render(
        <EmptyState
          title="No results"
          description="No matches found."
          action={{
            label: 'Clear filters',
            onClick: mockAction,
          }}
        />
      );

      expect(screen.getByTestId('empty-action')).toHaveTextContent('Clear filters');
    });
  });

  describe('Icon rendering', () => {
    it('should render different types of icons', () => {
      const { rerender } = render(
        <EmptyState
          icon={FaInbox}
          title="Empty inbox"
          description="No messages."
        />
      );

      expect(screen.getByTestId('empty-icon')).toBeInTheDocument();

      rerender(
        <EmptyState
          icon={FaSearch}
          title="No search results"
          description="Try different keywords."
        />
      );

      expect(screen.getByTestId('empty-icon')).toBeInTheDocument();

      rerender(
        <EmptyState
          icon={FaExclamationTriangle}
          title="Error"
          description="Something went wrong."
        />
      );

      expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    });

    it('should handle custom icon components', () => {
      const CustomIcon = () => <div data-testid="custom-icon">Custom</div>;

      render(
        <EmptyState
          icon={CustomIcon}
          title="Custom empty state"
          description="With custom icon."
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('Action button interaction', () => {
    it('should call action onClick when button is clicked', async () => {
      render(
        <EmptyState
          title="No data"
          description="Nothing to display."
          action={{
            label: 'Reload',
            onClick: mockAction,
          }}
        />
      );

      const actionButton = screen.getByTestId('empty-action');
      await user.click(actionButton);

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple clicks on action button', async () => {
      render(
        <EmptyState
          title="No items"
          description="No items found."
          action={{
            label: 'Retry',
            onClick: mockAction,
          }}
        />
      );

      const actionButton = screen.getByTestId('empty-action');
      
      await user.click(actionButton);
      await user.click(actionButton);
      await user.click(actionButton);

      expect(mockAction).toHaveBeenCalledTimes(3);
    });

    it('should handle keyboard navigation to action button', async () => {
      render(
        <EmptyState
          title="No content"
          description="No content available."
          action={{
            label: 'Create new',
            onClick: mockAction,
          }}
        />
      );

      const actionButton = screen.getByTestId('empty-action');
      
      // Tab to focus the button
      await user.tab();
      expect(actionButton).toHaveFocus();

      // Press Enter to activate
      await user.keyboard('{Enter}');
      expect(mockAction).toHaveBeenCalledTimes(1);

      // Press Space to activate
      await user.keyboard(' ');
      expect(mockAction).toHaveBeenCalledTimes(2);
    });
  });

  describe('CSS classes and styling', () => {
    it('should apply default CSS classes', () => {
      render(
        <EmptyState
          title="Empty"
          description="Nothing here."
        />
      );

      const container = screen.getByTestId('empty-state');
      expect(container).toHaveClass('empty-state');
    });

    it('should apply custom className when provided', () => {
      render(
        <EmptyState
          title="No data"
          description="Custom styling."
          className="custom-empty-state"
        />
      );

      const container = screen.getByTestId('empty-state');
      expect(container).toHaveClass('empty-state', 'custom-empty-state');
    });

    it('should apply correct classes to child elements', () => {
      render(
        <EmptyState
          icon={FaInbox}
          title="Empty state"
          description="With all elements."
          action={{
            label: 'Action',
            onClick: mockAction,
          }}
        />
      );

      expect(screen.getByTestId('empty-icon')).toHaveClass('empty-icon');
      expect(screen.getByTestId('empty-title')).toHaveClass('empty-title');
      expect(screen.getByTestId('empty-description')).toHaveClass('empty-description');
      expect(screen.getByTestId('empty-action')).toHaveClass('empty-action-button');
    });
  });

  describe('Content variations', () => {
    it('should handle long titles gracefully', () => {
      const longTitle = 'This is a very long title that might wrap to multiple lines in the empty state component';
      
      render(
        <EmptyState
          title={longTitle}
          description="Short description."
        />
      );

      expect(screen.getByTestId('empty-title')).toHaveTextContent(longTitle);
    });

    it('should handle long descriptions gracefully', () => {
      const longDescription = 'This is a very long description that provides detailed information about why the empty state is being shown and what the user can do about it. It might span multiple lines and should be properly formatted.';
      
      render(
        <EmptyState
          title="No results"
          description={longDescription}
        />
      );

      expect(screen.getByTestId('empty-description')).toHaveTextContent(longDescription);
    });

    it('should handle empty strings for title and description', () => {
      render(
        <EmptyState
          title=""
          description=""
        />
      );

      expect(screen.getByTestId('empty-title')).toBeEmptyDOMElement();
      expect(screen.getByTestId('empty-description')).toBeEmptyDOMElement();
    });

    it('should handle special characters in content', () => {
      render(
        <EmptyState
          title="¡No hay datos!"
          description="No se encontraron elementos. Intenta con búsqueda diferente."
        />
      );

      expect(screen.getByTestId('empty-title')).toHaveTextContent('¡No hay datos!');
      expect(screen.getByTestId('empty-description')).toHaveTextContent('No se encontraron elementos. Intenta con búsqueda diferente.');
    });
  });

  describe('Accessibility', () => {
    it('should use semantic HTML elements', () => {
      render(
        <EmptyState
          title="No data"
          description="Nothing to show."
        />
      );

      const title = screen.getByTestId('empty-title');
      const description = screen.getByTestId('empty-description');

      expect(title.tagName).toBe('H3');
      expect(description.tagName).toBe('P');
    });

    it('should have accessible button when action is provided', () => {
      render(
        <EmptyState
          title="No items"
          description="No items found."
          action={{
            label: 'Add new item',
            onClick: mockAction,
          }}
        />
      );

      const button = screen.getByRole('button', { name: 'Add new item' });
      expect(button).toBeInTheDocument();
    });

    it('should maintain proper heading hierarchy', () => {
      render(
        <EmptyState
          title="Empty state"
          description="This is an empty state."
        />
      );

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Empty state');
    });

    it('should be screen reader friendly', () => {
      render(
        <EmptyState
          icon={FaInbox}
          title="No messages"
          description="Your inbox is empty."
          action={{
            label: 'Compose message',
            onClick: mockAction,
          }}
        />
      );

      // Screen readers should be able to navigate through all elements
      expect(screen.getByRole('heading')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Common use cases', () => {
    it('should render search results empty state', () => {
      render(
        <EmptyState
          icon={FaSearch}
          title="No search results"
          description="We couldn't find anything matching your search. Try different keywords."
          action={{
            label: 'Clear search',
            onClick: mockAction,
          }}
        />
      );

      expect(screen.getByText('No search results')).toBeInTheDocument();
      expect(screen.getByText(/couldn't find anything/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    });

    it('should render data loading empty state', () => {
      render(
        <EmptyState
          icon={FaInbox}
          title="No data available"
          description="There is no data to display at this time."
          action={{
            label: 'Refresh',
            onClick: mockAction,
          }}
        />
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });

    it('should render error empty state', () => {
      render(
        <EmptyState
          icon={FaExclamationTriangle}
          title="Something went wrong"
          description="We encountered an error while loading your data."
          action={{
            label: 'Try again',
            onClick: mockAction,
          }}
        />
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/encountered an error/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('should render first time user empty state', () => {
      render(
        <EmptyState
          icon={FaInbox}
          title="Welcome!"
          description="Get started by creating your first item."
          action={{
            label: 'Create item',
            onClick: mockAction,
          }}
        />
      );

      expect(screen.getByText('Welcome!')).toBeInTheDocument();
      expect(screen.getByText(/get started/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create item' })).toBeInTheDocument();
    });
  });

  describe('Component integration', () => {
    it('should work within different container contexts', () => {
      render(
        <div className="container">
          <EmptyState
            title="Container empty state"
            description="Inside a container."
          />
        </div>
      );

      const container = screen.getByTestId('empty-state');
      expect(container.parentElement).toHaveClass('container');
    });

    it('should handle multiple empty states in the same view', () => {
      render(
        <div>
          <EmptyState
            title="First empty state"
            description="First description."
          />
          <EmptyState
            title="Second empty state"
            description="Second description."
          />
        </div>
      );

      expect(screen.getByText('First empty state')).toBeInTheDocument();
      expect(screen.getByText('Second empty state')).toBeInTheDocument();
      expect(screen.getAllByTestId('empty-state')).toHaveLength(2);
    });

    it('should handle conditional rendering', () => {
      const { rerender } = render(
        <div>
          {true && (
            <EmptyState
              title="Conditional empty state"
              description="This should render."
            />
          )}
        </div>
      );

      expect(screen.getByText('Conditional empty state')).toBeInTheDocument();

      rerender(
        <div>
          {false && (
            <EmptyState
              title="Conditional empty state"
              description="This should not render."
            />
          )}
        </div>
      );

      expect(screen.queryByText('Conditional empty state')).not.toBeInTheDocument();
    });
  });
});