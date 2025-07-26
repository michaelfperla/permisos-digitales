/**
 * OxxoVoucherModal Component Tests
 * Comprehensive test coverage for OXXO payment voucher modal functionality
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import OxxoVoucherModal from '../OxxoVoucherModal';

// Mock the Modal component
vi.mock('../../ui/Modal', () => ({
  default: ({ isOpen, onClose, children, className, title }: any) => {
    if (!isOpen) return null;
    return (
      <div className={className} data-testid="modal-overlay">
        <div data-testid="modal-container">
          {title && <h2>{title}</h2>}
          <button onClick={onClose} data-testid="modal-close-button">Close</button>
          {children}
        </div>
      </div>
    );
  }
}));

// Mock react-icons
vi.mock('react-icons/fa', () => ({
  FaTimes: () => <span data-testid="fa-times">×</span>,
  FaStore: () => <span data-testid="fa-store">🏪</span>,
  FaDownload: () => <span data-testid="fa-download">⬇</span>,
  FaPrint: () => <span data-testid="fa-print">🖨</span>
}));

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen
});

describe('OxxoVoucherModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    oxxoReference: 'OXXO123456789',
    amount: 500,
    expirationDate: '2024-12-31',
    voucherUrl: 'https://example.com/voucher.pdf'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
      expect(screen.getByText('Ficha de Pago OXXO')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(<OxxoVoucherModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
    });

    it('should display instructions text', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      expect(screen.getByText(/Presenta este voucher en cualquier tienda OXXO/)).toBeInTheDocument();
      expect(screen.getByText(/El voucher es válido hasta la fecha de expiración/)).toBeInTheDocument();
      expect(screen.getByText(/Una vez realizado el pago/)).toBeInTheDocument();
    });

    it('should display warning message', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      expect(screen.getByText(/Importante: Conserva tu voucher/)).toBeInTheDocument();
      expect(screen.getByText(/necesario para realizar el pago/)).toBeInTheDocument();
    });
  });

  describe('OXXO Reference Display', () => {
    it('should show OXXO reference when provided', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      expect(screen.getByText('Referencia de Pago:')).toBeInTheDocument();
      expect(screen.getByText('OXXO123456789')).toBeInTheDocument();
      expect(screen.getByTestId('fa-store')).toBeInTheDocument();
    });

    it('should show "No disponible" when reference is missing', () => {
      render(<OxxoVoucherModal {...defaultProps} oxxoReference="" />);
      
      expect(screen.getByText('Referencia de Pago:')).toBeInTheDocument();
      expect(screen.getByText('No disponible')).toBeInTheDocument();
    });

    it('should handle undefined reference', () => {
      render(<OxxoVoucherModal {...defaultProps} oxxoReference={undefined} />);
      
      expect(screen.getByText('No disponible')).toBeInTheDocument();
    });
  });

  describe('Amount Display', () => {
    it('should format amount in MXN currency', () => {
      render(<OxxoVoucherModal {...defaultProps} amount={1500} />);
      
      expect(screen.getByText('Monto a Pagar:')).toBeInTheDocument();
      expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    });

    it('should handle string amount values', () => {
      render(<OxxoVoucherModal {...defaultProps} amount="750" />);
      
      expect(screen.getByText('$750.00')).toBeInTheDocument();
    });

    it('should show default amount when not provided', () => {
      render(<OxxoVoucherModal {...defaultProps} amount={undefined} />);
      
      expect(screen.getByText('$500.00')).toBeInTheDocument();
    });

    it('should handle zero amount', () => {
      render(<OxxoVoucherModal {...defaultProps} amount={0} />);
      
      expect(screen.getByText('$500.00')).toBeInTheDocument();
    });

    it('should handle decimal amounts correctly', () => {
      render(<OxxoVoucherModal {...defaultProps} amount={1234.56} />);
      
      expect(screen.getByText('$1,234.56')).toBeInTheDocument();
    });

    it('should handle very large amounts', () => {
      render(<OxxoVoucherModal {...defaultProps} amount={999999.99} />);
      
      expect(screen.getByText('$999,999.99')).toBeInTheDocument();
    });
  });

  describe('Expiration Date Display', () => {
    it('should format date in Spanish locale', () => {
      render(<OxxoVoucherModal {...defaultProps} expirationDate="2024-12-31" />);
      
      expect(screen.getByText('Vence:')).toBeInTheDocument();
      expect(screen.getByText(/31 de diciembre de 2024/)).toBeInTheDocument();
    });

    it('should show "No especificada" when date is missing', () => {
      render(<OxxoVoucherModal {...defaultProps} expirationDate="" />);
      
      expect(screen.getByText('Vence:')).toBeInTheDocument();
      expect(screen.getByText('No especificada')).toBeInTheDocument();
    });

    it('should handle undefined expiration date', () => {
      render(<OxxoVoucherModal {...defaultProps} expirationDate={undefined} />);
      
      expect(screen.getByText('No especificada')).toBeInTheDocument();
    });

    it('should handle invalid date strings gracefully', () => {
      render(<OxxoVoucherModal {...defaultProps} expirationDate="invalid-date" />);
      
      expect(screen.getByText('No especificada')).toBeInTheDocument();
    });
  });

  describe('Voucher Display', () => {
    it('should show iframe with voucher when URL is provided', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      const iframe = screen.getByTitle('Voucher OXXO');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', 'https://example.com/voucher.pdf');
    });

    it('should hide voucher section when URL is missing', () => {
      render(<OxxoVoucherModal {...defaultProps} voucherUrl="" />);
      
      expect(screen.queryByTitle('Voucher OXXO')).not.toBeInTheDocument();
    });

    it('should handle undefined voucher URL', () => {
      render(<OxxoVoucherModal {...defaultProps} voucherUrl={undefined} />);
      
      expect(screen.queryByTitle('Voucher OXXO')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should show print button when voucher URL exists', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      expect(screen.getByText('Imprimir/Descargar')).toBeInTheDocument();
      expect(screen.getByTestId('fa-print')).toBeInTheDocument();
    });

    it('should hide print button when voucher URL is missing', () => {
      render(<OxxoVoucherModal {...defaultProps} voucherUrl="" />);
      
      expect(screen.queryByText('Imprimir/Descargar')).not.toBeInTheDocument();
    });

    it('should always show close button', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      expect(screen.getByText('Cerrar')).toBeInTheDocument();
      expect(screen.getByTestId('fa-times')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<OxxoVoucherModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cerrar'));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should open voucher URL in new window when print button is clicked', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Imprimir/Descargar'));
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://example.com/voucher.pdf',
        '_blank'
      );
    });

    it('should call onClose when modal close button is clicked', () => {
      const onClose = vi.fn();
      render(<OxxoVoucherModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('modal-close'));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complete Props Scenario', () => {
    it('should render all elements with complete props', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      // Header
      expect(screen.getByText('Ficha de Pago OXXO')).toBeInTheDocument();
      
      // Reference
      expect(screen.getByText('Referencia de Pago:')).toBeInTheDocument();
      expect(screen.getByText('OXXO123456789')).toBeInTheDocument();
      
      // Amount
      expect(screen.getByText('Monto a Pagar:')).toBeInTheDocument();
      expect(screen.getByText('$500.00')).toBeInTheDocument();
      
      // Expiration
      expect(screen.getByText('Vence:')).toBeInTheDocument();
      expect(screen.getByText(/31 de diciembre de 2024/)).toBeInTheDocument();
      
      // Voucher
      expect(screen.getByTitle('Voucher OXXO')).toBeInTheDocument();
      
      // Buttons
      expect(screen.getByText('Imprimir/Descargar')).toBeInTheDocument();
      expect(screen.getByText('Cerrar')).toBeInTheDocument();
      
      // Instructions
      expect(screen.getByText(/Presenta este voucher en cualquier tienda OXXO/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long reference numbers', () => {
      const longReference = 'OXXO123456789012345678901234567890';
      render(<OxxoVoucherModal {...defaultProps} oxxoReference={longReference} />);
      
      expect(screen.getByText(longReference)).toBeInTheDocument();
    });

    it('should handle very large amounts', () => {
      render(<OxxoVoucherModal {...defaultProps} amount={99999999.99} />);
      
      expect(screen.getByText('$99,999,999.99')).toBeInTheDocument();
    });

    it('should handle negative amounts', () => {
      render(<OxxoVoucherModal {...defaultProps} amount={-100} />);
      
      // Should show default amount since negative is treated as falsy
      expect(screen.getByText('$500.00')).toBeInTheDocument();
    });

    it('should handle empty string values', () => {
      render(
        <OxxoVoucherModal 
          isOpen={true}
          onClose={vi.fn()}
          oxxoReference=""
          amount=""
          expirationDate=""
          voucherUrl=""
        />
      );
      
      expect(screen.getByText('No disponible')).toBeInTheDocument(); // reference
      expect(screen.getByText('$500.00')).toBeInTheDocument(); // amount
      expect(screen.getByText('No especificada')).toBeInTheDocument(); // date
      expect(screen.queryByTitle('Voucher OXXO')).not.toBeInTheDocument(); // voucher
    });

    it('should handle special characters in reference', () => {
      const specialReference = 'OXXO-123_456.789#ABC';
      render(<OxxoVoucherModal {...defaultProps} oxxoReference={specialReference} />);
      
      expect(screen.getByText(specialReference)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Voucher de Pago OXXO');
    });

    it('should have descriptive button labels', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /Imprimir\/Descargar/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cerrar/ })).toBeInTheDocument();
    });

    it('should have proper iframe title', () => {
      render(<OxxoVoucherModal {...defaultProps} />);
      
      const iframe = screen.getByTitle('Voucher OXXO');
      expect(iframe).toHaveAttribute('title', 'Voucher OXXO');
    });
  });

  describe('CSS Classes', () => {
    it('should apply CSS module classes correctly', () => {
      const { container } = render(<OxxoVoucherModal {...defaultProps} />);
      
      // Check that CSS classes are applied (they will be hashed in actual CSS modules)
      expect(container.querySelector('[class*="oxxoModal"]')).toBeInTheDocument();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle print button click when voucherUrl becomes undefined', () => {
      const { rerender } = render(<OxxoVoucherModal {...defaultProps} />);
      
      // Initially has print button
      expect(screen.getByText('Imprimir/Descargar')).toBeInTheDocument();
      
      // Remove voucher URL
      rerender(<OxxoVoucherModal {...defaultProps} voucherUrl={undefined} />);
      
      // Print button should be gone
      expect(screen.queryByText('Imprimir/Descargar')).not.toBeInTheDocument();
    });

    it('should handle date formatting errors gracefully', () => {
      // Test with various invalid date formats
      const invalidDates = ['not-a-date', '2024-13-45', '2024-02-30', 'abc-def-ghi'];
      
      invalidDates.forEach(invalidDate => {
        render(<OxxoVoucherModal {...defaultProps} expirationDate={invalidDate} />);
        expect(screen.getByText('No especificada')).toBeInTheDocument();
      });
    });

    it('should handle window.open failures gracefully', () => {
      mockWindowOpen.mockImplementation(() => null);
      
      render(<OxxoVoucherModal {...defaultProps} />);
      
      // Should not throw error when window.open fails
      fireEvent.click(screen.getByText('Imprimir/Descargar'));
      
      expect(mockWindowOpen).toHaveBeenCalled();
    });
  });

  describe('Performance Considerations', () => {
    it('should not re-render unnecessarily when isOpen is false', () => {
      const { rerender } = render(<OxxoVoucherModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
      
      // Change props while modal is closed - should still not render
      rerender(<OxxoVoucherModal {...defaultProps} isOpen={false} amount={999} />);
      
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
    });
  });
});