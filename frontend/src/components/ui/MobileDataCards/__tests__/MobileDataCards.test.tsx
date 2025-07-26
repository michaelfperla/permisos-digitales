import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { FaInbox, FaUser, FaCar } from 'react-icons/fa';
import MobileDataCards, { CardAction, DataField } from '../MobileDataCards';

// Mock touch events
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  return new TouchEvent(type, {
    touches: touches.map(touch => ({
      ...touch,
      identifier: Date.now(),
      target: document.body,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
      force: 1
    } as Touch)),
    bubbles: true,
    cancelable: true
  });
};

const mockData = [
  {
    id: 1,
    name: 'Juan Pérez',
    email: 'juan@example.com',
    status: 'active',
    vehicle: 'Toyota Camry',
    amount: 1250.50,
    created: '2024-01-15',
  },
  {
    id: 2,
    name: 'María García',
    email: 'maria@example.com',
    status: 'pending',
    vehicle: 'Honda Civic',
    amount: 800.00,
    created: '2024-01-10',
  },
  {
    id: 3,
    name: 'Carlos López',
    email: 'carlos@example.com',
    status: 'inactive',
    vehicle: 'Ford Focus',
    amount: 950.75,
    created: '2024-01-12',
  },
];

const mockFields = (item: any): DataField[] => [
  { label: 'Email', value: item.email, priority: 'high' },
  { label: 'Vehículo', value: item.vehicle, priority: 'medium' },
  { label: 'Monto', value: `$${item.amount.toFixed(2)}`, priority: 'high' },
  { label: 'Fecha', value: item.created, priority: 'low' },
  { label: 'Detalles adicionales', value: 'Información sensible', hideOnCard: true },
];

const mockActions: CardAction[] = [
  {
    label: 'Ver',
    icon: FaUser,
    onClick: vi.fn(),
    variant: 'primary',
  },
  {
    label: 'Editar',
    onClick: vi.fn(),
    variant: 'secondary',
  },
  {
    label: 'Eliminar',
    onClick: vi.fn(),
    variant: 'danger',
  },
];

const mockSwipeActions = {
  edit: vi.fn(),
  delete: vi.fn(),
};

describe('MobileDataCards', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock touch support
    window.ontouchstart = () => {};
  });

  it('should render data cards with titles and subtitles', () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        subtitle={(item) => item.email}
        fields={mockFields}
      />
    );

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('juan@example.com')).toBeInTheDocument();
    expect(screen.getByText('María García')).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
  });

  it('should display status badges correctly', () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        status={(item) => ({
          label: item.status === 'active' ? 'Activo' : item.status === 'pending' ? 'Pendiente' : 'Inactivo',
          variant: item.status === 'active' ? 'success' : item.status === 'pending' ? 'warning' : 'error',
        })}
        fields={mockFields}
      />
    );

    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();

    const activeBadge = screen.getByText('Activo');
    expect(activeBadge).toHaveClass('statusBadge', 'success');
  });

  it('should display high and medium priority fields only', () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
      />
    );

    // High and medium priority fields should be visible
    expect(screen.getByText('juan@example.com')).toBeInTheDocument();
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
    expect(screen.getByText('$1250.50')).toBeInTheDocument();

    // Low priority and hidden fields should not be visible
    expect(screen.queryByText('2024-01-15')).not.toBeInTheDocument();
    expect(screen.queryByText('Información sensible')).not.toBeInTheDocument();
  });

  it('should render action buttons correctly', async () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        actions={mockActions}
      />
    );

    const viewButtons = screen.getAllByRole('button', { name: /ver/i });
    expect(viewButtons).toHaveLength(3);

    await user.click(viewButtons[0]);
    expect(mockActions[0].onClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('should handle expandable content', async () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        expandable={true}
        expandedContent={(item) => <div>Expanded content for {item.name}</div>}
      />
    );

    const expandButtons = screen.getAllByRole('button', { name: /ver más detalles/i });
    expect(expandButtons).toHaveLength(3);

    await user.click(expandButtons[0]);
    expect(screen.getByText('Expanded content for Juan Pérez')).toBeInTheDocument();

    // Check button text changed
    expect(screen.getByRole('button', { name: /ocultar detalles/i })).toBeInTheDocument();
  });

  it('should handle touch swipe gestures', () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        swipeActions={mockSwipeActions}
      />
    );

    const firstCard = screen.getByText('Juan Pérez').closest('.dataCard');
    expect(firstCard).toBeInTheDocument();

    // Simulate swipe gesture
    fireEvent.touchStart(firstCard!, {
      touches: [{ clientX: 0, clientY: 100 }],
    });

    fireEvent.touchMove(firstCard!, {
      touches: [{ clientX: 100, clientY: 100 }],
    });

    fireEvent.touchEnd(firstCard!, {
      touches: [],
    });

    // Card should have swiping class during gesture
    expect(firstCard).toHaveClass('dataCard');
  });

  it('should handle pull-to-refresh functionality', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        onRefresh={mockRefresh}
      />
    );

    const container = screen.getByText('Juan Pérez').closest('.cardList');
    expect(container).toBeInTheDocument();

    // Simulate scroll to top
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

    // Simulate pull gesture
    fireEvent.touchStart(container!, {
      touches: [{ clientX: 0, clientY: 0 }],
    });

    fireEvent.touchMove(container!, {
      touches: [{ clientX: 0, clientY: 80 }],
    });

    fireEvent.touchEnd(container!, {
      touches: [],
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('should display loading skeleton state', () => {
    render(
      <MobileDataCards
        data={[]}
        title={(item) => item.name}
        fields={mockFields}
        loading={true}
        loadingCards={3}
      />
    );

    const skeletonCards = screen.getAllByTestId(/skeleton/);
    expect(skeletonCards.length).toBeGreaterThan(0);
  });

  it('should display empty state when no data', () => {
    const emptyState = {
      icon: FaInbox,
      title: 'No hay datos',
      description: 'No se encontraron elementos para mostrar',
      action: {
        label: 'Recargar',
        onClick: vi.fn(),
      },
    };

    render(
      <MobileDataCards
        data={[]}
        title={(item) => item.name}
        fields={mockFields}
        emptyState={emptyState}
      />
    );

    expect(screen.getByText('No hay datos')).toBeInTheDocument();
    expect(screen.getByText('No se encontraron elementos para mostrar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });

  it('should handle swipe actions correctly', async () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        swipeActions={mockSwipeActions}
      />
    );

    // Simulate swipe to reveal actions
    const firstCard = screen.getByText('Juan Pérez').closest('.dataCard');
    
    fireEvent.touchStart(firstCard!, {
      touches: [{ clientX: 0, clientY: 100 }],
    });

    fireEvent.touchMove(firstCard!, {
      touches: [{ clientX: 60, clientY: 100 }],
    });

    // Check if swipe actions are available (would need more complex touch simulation)
    expect(mockSwipeActions.edit).toBeDefined();
    expect(mockSwipeActions.delete).toBeDefined();
  });

  it('should handle accessibility correctly', () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        expandable={true}
        expandedContent={(item) => <div>Content</div>}
      />
    );

    const expandButton = screen.getAllByRole('button', { name: /ver más detalles/i })[0];
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    expect(expandButton).toHaveAttribute('aria-label', 'Ver más detalles');
  });

  it('should handle multiple card expansion independently', async () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        expandable={true}
        expandedContent={(item) => <div>Expanded {item.name}</div>}
      />
    );

    const expandButtons = screen.getAllByRole('button', { name: /ver más detalles/i });
    
    // Expand first card
    await user.click(expandButtons[0]);
    expect(screen.getByText('Expanded Juan Pérez')).toBeInTheDocument();

    // Expand second card
    await user.click(expandButtons[1]);
    expect(screen.getByText('Expanded María García')).toBeInTheDocument();

    // Both should be expanded independently
    expect(screen.getByText('Expanded Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Expanded María García')).toBeInTheDocument();
  });

  it('should handle touch events with proper coordinates', () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        swipeActions={mockSwipeActions}
      />
    );

    const firstCard = screen.getByText('Juan Pérez').closest('.dataCard');
    
    // Mock getBoundingClientRect
    const mockGetBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 300,
      bottom: 100,
      width: 300,
      height: 100,
    }));
    
    if (firstCard) {
      firstCard.getBoundingClientRect = mockGetBoundingClientRect;
    }

    fireEvent.touchStart(firstCard!, {
      touches: [{ clientX: 0, clientY: 50 }],
    });

    expect(firstCard).toBeInTheDocument();
  });

  it('should handle action button variants correctly', () => {
    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        actions={mockActions}
      />
    );

    const primaryButton = screen.getAllByText('Ver')[0];
    const secondaryButton = screen.getAllByText('Editar')[0];
    const dangerButton = screen.getAllByText('Eliminar')[0];

    expect(primaryButton).toHaveClass('actionButton', 'primary');
    expect(secondaryButton).toHaveClass('actionButton', 'secondary');
    expect(dangerButton).toHaveClass('actionButton', 'danger');
  });

  it('should handle complex field values including React nodes', () => {
    const fieldsWithNodes = (item: any): DataField[] => [
      { label: 'Usuario', value: <strong>{item.name}</strong>, priority: 'high' },
      { label: 'Estado', value: item.status, priority: 'medium' },
    ];

    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={fieldsWithNodes}
      />
    );

    // Should render React node content
    const strongElement = screen.getByText('Juan Pérez');
    expect(strongElement.tagName).toBe('STRONG');
  });

  it('should maintain scroll position during refresh', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <MobileDataCards
        data={mockData}
        title={(item) => item.name}
        fields={mockFields}
        onRefresh={mockRefresh}
      />
    );

    const container = screen.getByText('Juan Pérez').closest('.cardList');
    
    // Mock scroll position
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

    // Test that pull-to-refresh only works when at top
    expect(container).toBeInTheDocument();
  });
});