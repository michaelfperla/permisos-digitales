import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import OxxoPaymentSlipModal from '../OxxoPaymentSlipModal';

// Mock dependencies
vi.mock('../../shared/hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../ui/Modal', () => ({
  default: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    ) : null
}));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, {
  clipboard: mockClipboard,
});

// Mock window.print
const mockPrint = vi.fn();
Object.assign(window, {
  print: mockPrint,
});

describe('OxxoPaymentSlipModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    oxxoReference: '12345678901234',
    amount: 1250.50,
    currency: 'MXN',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render modal when isOpen is true', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Instrucciones para Pago en OXXO');
  });

  it('should not render modal when isOpen is false', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('should display OXXO reference number', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    expect(screen.getByText('12345678901234')).toBeInTheDocument();
    expect(screen.getByText('Referencia OXXO:')).toBeInTheDocument();
  });

  it('should format currency correctly in Mexican pesos', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    expect(screen.getByText('MX$1,250.50')).toBeInTheDocument();
    expect(screen.getByText('Monto a Pagar:')).toBeInTheDocument();
  });

  it('should format currency with different currency codes', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} amount={100} currency="USD" />);

    expect(screen.getByText('US$100.00')).toBeInTheDocument();
  });

  it('should handle string amount input', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} amount="500.75" />);

    expect(screen.getByText('MX$500.75')).toBeInTheDocument();
  });

  it('should display permit folio when provided', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} permitFolio="ABC123456" />);

    expect(screen.getByText('Pago para Permiso Nº: ABC123456')).toBeInTheDocument();
  });

  it('should not display permit folio when not provided', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    expect(screen.queryByText(/Pago para Permiso Nº:/)).not.toBeInTheDocument();
  });

  it('should display expiry date when provided', () => {
    const expiresAt = '2024-12-31T23:59:59Z';
    render(<OxxoPaymentSlipModal {...defaultProps} expiresAt={expiresAt} />);

    expect(screen.getByText('Pagar antes del:')).toBeInTheDocument();
    expect(screen.getByText('31 de diciembre de 2024 a las 23:59')).toBeInTheDocument();
  });

  it('should not display expiry section when date not provided', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    expect(screen.queryByText('Pagar antes del:')).not.toBeInTheDocument();
  });

  it('should copy reference to clipboard when copy button is clicked', async () => {
    const { showToast } = require('../../shared/hooks/useToast').useToast();
    
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    const copyButton = screen.getByRole('button', { name: /copiar referencia/i });
    fireEvent.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('12345678901234');
    expect(showToast).toHaveBeenCalledWith('Referencia copiada al portapapeles', 'success');
  });

  it('should show "Copiado" text temporarily after copying', async () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    const copyButton = screen.getByRole('button', { name: /copiar referencia/i });
    
    // Initially shows "Copiar"
    expect(copyButton).toHaveTextContent('Copiar');
    
    fireEvent.click(copyButton);
    
    // Should show "Copiado"
    expect(copyButton).toHaveTextContent('Copiado');
    
    // After 2 seconds, should revert to "Copiar"
    vi.advanceTimersByTime(2000);
    expect(copyButton).toHaveTextContent('Copiar');
  });

  it('should display payment instructions', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    expect(screen.getByText('Instrucciones de Pago')).toBeInTheDocument();
    expect(screen.getByText('Acude a cualquier tienda OXXO.')).toBeInTheDocument();
    expect(screen.getByText('Indica al cajero que deseas realizar un pago de servicio/OXXO Pay.')).toBeInTheDocument();
    expect(screen.getByText('Proporciona la Referencia OXXO mostrada arriba.')).toBeInTheDocument();
    expect(screen.getByText('Realiza el pago por el monto exacto.')).toBeInTheDocument();
    expect(screen.getByText('Conserva tu comprobante de pago.')).toBeInTheDocument();
  });

  it('should display barcode when barcodeUrl is provided', () => {
    const barcodeUrl = 'https://example.com/barcode.png';
    render(<OxxoPaymentSlipModal {...defaultProps} barcodeUrl={barcodeUrl} />);

    expect(screen.getByText('Código de Barras:')).toBeInTheDocument();
    
    const barcodeImage = screen.getByAltText('Código de barras para pago en OXXO');
    expect(barcodeImage).toBeInTheDocument();
    expect(barcodeImage).toHaveAttribute('src', barcodeUrl);
  });

  it('should not display barcode section when barcodeUrl is not provided', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    expect(screen.queryByText('Código de Barras:')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Código de barras para pago en OXXO')).not.toBeInTheDocument();
  });

  it('should call window.print when print button is clicked', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    const printButton = screen.getByRole('button', { name: /imprimir instrucciones/i });
    fireEvent.click(printButton);

    expect(mockPrint).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    render(<OxxoPaymentSlipModal {...defaultProps} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /cerrar/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should handle invalid date gracefully', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} expiresAt="invalid-date" />);

    expect(screen.getByText('Pagar antes del:')).toBeInTheDocument();
    expect(screen.getByText('Invalid Date')).toBeInTheDocument();
  });

  it('should handle empty expiry date', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} expiresAt="" />);

    // Should not display expiry section for empty string
    expect(screen.queryByText('Pagar antes del:')).not.toBeInTheDocument();
  });

  it('should handle zero amount', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} amount={0} />);

    expect(screen.getByText('MX$0.00')).toBeInTheDocument();
  });

  it('should handle negative amount', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} amount={-100} />);

    expect(screen.getByText('-MX$100.00')).toBeInTheDocument();
  });

  it('should handle very large amounts', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} amount={999999.99} />);

    expect(screen.getByText('MX$999,999.99')).toBeInTheDocument();
  });

  it('should handle copy functionality with multiple clicks', async () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    const copyButton = screen.getByRole('button', { name: /copiar referencia/i });
    
    // First click
    fireEvent.click(copyButton);
    expect(copyButton).toHaveTextContent('Copiado');
    
    // Second click before timeout
    fireEvent.click(copyButton);
    expect(mockClipboard.writeText).toHaveBeenCalledTimes(2);
    
    // Fast forward time
    vi.advanceTimersByTime(2000);
    expect(copyButton).toHaveTextContent('Copiar');
  });

  it('should handle clipboard API failures gracefully', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard failed'));
    
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    const copyButton = screen.getByRole('button', { name: /copiar referencia/i });
    fireEvent.click(copyButton);

    // Should still update UI even if clipboard fails
    expect(copyButton).toHaveTextContent('Copiado');
  });

  it('should display all required UI elements', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    // Check for all icons and labels
    expect(screen.getByText('Referencia OXXO:')).toBeInTheDocument();
    expect(screen.getByText('Monto a Pagar:')).toBeInTheDocument();
    expect(screen.getByText('Instrucciones de Pago')).toBeInTheDocument();
    
    // Check for buttons
    expect(screen.getByRole('button', { name: /copiar referencia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /imprimir instrucciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument();
  });

  it('should maintain accessibility attributes', () => {
    render(<OxxoPaymentSlipModal {...defaultProps} />);

    const copyButton = screen.getByRole('button', { name: /copiar referencia/i });
    expect(copyButton).toHaveAttribute('aria-label', 'Copiar referencia');
  });
});