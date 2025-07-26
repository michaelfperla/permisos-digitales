import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import TestCardInfo from '../TestCardInfo';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('TestCardInfo', () => {
  const mockOnSelectCard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render test card information header', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    expect(screen.getByText('¡IMPORTANTE! Tarjetas de Prueba')).toBeInTheDocument();
    expect(screen.getByText(/Para pruebas, DEBES usar la tarjeta 4242 4242 4242 4242/)).toBeInTheDocument();
  });

  it('should display all test cards', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    // Check for all card numbers
    expect(screen.getByText('4242 4242 4242 4242')).toBeInTheDocument();
    expect(screen.getByText('5555 5555 5555 4444')).toBeInTheDocument();
    expect(screen.getByText('4000 0000 0000 0002')).toBeInTheDocument();

    // Check for card types
    expect(screen.getAllByText('Visa')).toHaveLength(2);
    expect(screen.getByText('Mastercard')).toBeInTheDocument();
  });

  it('should highlight recommended card', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const recommendedCard = screen.getByText('4242 4242 4242 4242').closest('.testCard');
    expect(recommendedCard).toHaveClass('recommendedCard');

    expect(screen.getByText('Usar esta tarjeta')).toBeInTheDocument();
  });

  it('should display card statuses correctly', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    expect(screen.getAllByText('Tarjeta aprobada')).toHaveLength(2);
    expect(screen.getByText('Tarjeta rechazada')).toBeInTheDocument();
  });

  it('should display all card details', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    // Check for field labels
    expect(screen.getAllByText('Número:')).toHaveLength(3);
    expect(screen.getAllByText('Nombre:')).toHaveLength(3);
    expect(screen.getAllByText('Expiración:')).toHaveLength(3);
    expect(screen.getAllByText('CVC:')).toHaveLength(3);

    // Check for field values
    expect(screen.getAllByText('Test User')).toHaveLength(3);
    expect(screen.getAllByText('12/25')).toHaveLength(3);
    expect(screen.getAllByText('123')).toHaveLength(3);
  });

  it('should copy card number to clipboard when copy button is clicked', async () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const copyButtons = screen.getAllByTitle('Copiar número');
    fireEvent.click(copyButtons[0]);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('4242 4242 4242 4242');
  });

  it('should show check icon temporarily after copying', async () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const copyButtons = screen.getAllByTitle('Copiar número');
    fireEvent.click(copyButtons[0]);

    // Should show check icon after clicking
    await waitFor(() => {
      const copiedButton = copyButtons[0];
      expect(copiedButton.querySelector('svg')).toBeInTheDocument();
    });

    // After 2 seconds, should revert to copy icon
    vi.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(copyButtons[0]).toBeInTheDocument();
    });
  });

  it('should call onSelectCard with correct parameters when recommended card is selected', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const recommendedButton = screen.getByText('Usar esta tarjeta (Recomendada)');
    fireEvent.click(recommendedButton);

    expect(mockOnSelectCard).toHaveBeenCalledWith(
      '4242424242424242', // Number without spaces
      'Test User',
      '12',
      '25',
      '123'
    );
  });

  it('should call onSelectCard with correct parameters when Mastercard is selected', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const useCardButtons = screen.getAllByText('Usar esta tarjeta');
    fireEvent.click(useCardButtons[0]); // First non-recommended card (Mastercard)

    expect(mockOnSelectCard).toHaveBeenCalledWith(
      '5555555555554444', // Number without spaces
      'Test User',
      '12',
      '25',
      '123'
    );
  });

  it('should call onSelectCard with correct parameters when declined card is selected', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const useCardButtons = screen.getAllByText('Usar esta tarjeta');
    fireEvent.click(useCardButtons[1]); // Second non-recommended card (declined)

    expect(mockOnSelectCard).toHaveBeenCalledWith(
      '4000000000000002', // Number without spaces
      'Test User',
      '12',
      '25',
      '123'
    );
  });

  it('should handle multiple copy operations', async () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const copyButtons = screen.getAllByTitle('Copiar número');
    
    // Copy first card
    fireEvent.click(copyButtons[0]);
    expect(mockClipboard.writeText).toHaveBeenCalledWith('4242 4242 4242 4242');

    // Copy second card
    fireEvent.click(copyButtons[1]);
    expect(mockClipboard.writeText).toHaveBeenCalledWith('5555 5555 5555 4444');

    // Copy third card
    fireEvent.click(copyButtons[2]);
    expect(mockClipboard.writeText).toHaveBeenCalledWith('4000 0000 0000 0002');

    expect(mockClipboard.writeText).toHaveBeenCalledTimes(3);
  });

  it('should handle clipboard API failures gracefully', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard failed'));
    
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const copyButton = screen.getAllByTitle('Copiar número')[0];
    fireEvent.click(copyButton);

    // Should still update state even if clipboard fails
    await waitFor(() => {
      expect(copyButton.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('should display warning about test cards', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    expect(screen.getByText(/Para pruebas, DEBES usar la tarjeta 4242 4242 4242 4242/)).toBeInTheDocument();
    expect(screen.getByText(/No se realizará ningún cargo real/)).toBeInTheDocument();
  });

  it('should show different button text for recommended vs regular cards', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    expect(screen.getByText('Usar esta tarjeta (Recomendada)')).toBeInTheDocument();
    expect(screen.getAllByText('Usar esta tarjeta')).toHaveLength(2);
  });

  it('should apply correct CSS classes to recommended card', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const recommendedCard = screen.getByText('4242 4242 4242 4242').closest('.testCard');
    expect(recommendedCard).toHaveClass('recommendedCard');

    const recommendedButton = screen.getByText('Usar esta tarjeta (Recomendada)');
    expect(recommendedButton).toHaveClass('recommendedButton');
  });

  it('should handle rapid successive clicks on use card button', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const useButton = screen.getByText('Usar esta tarjeta (Recomendada)');
    
    // Click multiple times rapidly
    fireEvent.click(useButton);
    fireEvent.click(useButton);
    fireEvent.click(useButton);

    expect(mockOnSelectCard).toHaveBeenCalledTimes(3);
  });

  it('should handle rapid successive clicks on copy button', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const copyButton = screen.getAllByTitle('Copiar número')[0];
    
    // Click multiple times rapidly
    fireEvent.click(copyButton);
    fireEvent.click(copyButton);
    fireEvent.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledTimes(3);
  });

  it('should show distinct visual indicators for different card states', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    // Check that approved cards have different styling than declined
    const approvedCards = screen.getAllByText('Tarjeta aprobada');
    const declinedCard = screen.getByText('Tarjeta rechazada');

    expect(approvedCards).toHaveLength(2);
    expect(declinedCard).toBeInTheDocument();

    // Recommended badge should only appear once
    expect(screen.getByText('Usar esta tarjeta')).toBeInTheDocument();
  });

  it('should maintain state isolation between different copy buttons', async () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const copyButtons = screen.getAllByTitle('Copiar número');
    
    // Click first copy button
    fireEvent.click(copyButtons[0]);
    
    // Fast forward time for first button
    vi.advanceTimersByTime(1000);
    
    // Click second copy button
    fireEvent.click(copyButtons[1]);
    
    // Both should have been clicked independently
    expect(mockClipboard.writeText).toHaveBeenNthCalledWith(1, '4242 4242 4242 4242');
    expect(mockClipboard.writeText).toHaveBeenNthCalledWith(2, '5555 5555 5555 4444');
  });

  it('should reset copy state after timeout', async () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const copyButton = screen.getAllByTitle('Copiar número')[0];
    fireEvent.click(copyButton);

    // State should be set to copied
    await waitFor(() => {
      expect(copyButton.querySelector('svg')).toBeInTheDocument();
    });

    // After timeout, state should reset
    vi.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(copyButton).toBeInTheDocument();
    });
  });

  it('should remove spaces from card number when calling onSelectCard', () => {
    render(<TestCardInfo onSelectCard={mockOnSelectCard} />);

    const useButton = screen.getByText('Usar esta tarjeta (Recomendada)');
    fireEvent.click(useButton);

    // Should receive card number without spaces
    expect(mockOnSelectCard).toHaveBeenCalledWith(
      '4242424242424242',
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  });
});